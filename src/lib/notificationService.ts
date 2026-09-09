import { supabase } from '../utils/supabase';
import type { Notice, NotificationType, Report, ReportStatus } from './types';
import { normalizeReportStatus } from './reportData';

export function getIconForNotificationType(type: NotificationType): Notice['icon'] {
  switch (type) {
    case 'REPORT_SUBMITTED':
      return 'check';
    case 'REPORT_ASSIGNED':
      return 'truck';
    case 'REPORT_IN_PROGRESS':
      return 'progress';
    case 'REPORT_RESOLVING':
      return 'resolving';
    case 'REPORT_RESOLVED':
      return 'check';
    case 'REPORT_DELETED':
      return 'alert';
    case 'COMMUNITY_UPDATE':
      return 'leaf';
    default:
      return 'leaf';
  }
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return 'Just now';
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hr' : 'hrs'} ago`;
  }

  // Check if calendar day is yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export type NotificationSections = {
  today: Notice[];
  yesterday: Notice[];
  earlier: Notice[];
};

export function groupNoticesBySection(notices: Notice[]): NotificationSections {
  const today: Notice[] = [];
  const yesterday: Notice[] = [];
  const earlier: Notice[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  for (const notice of notices) {
    const rawTime = notice.createdAt ? new Date(notice.createdAt).getTime() : NaN;
    const time = isNaN(rawTime) ? startOfToday : rawTime;

    if (time >= startOfToday) {
      today.push(notice);
    } else if (time >= startOfYesterday) {
      yesterday.push(notice);
    } else {
      earlier.push(notice);
    }
  }

  return { today, yesterday, earlier };
}

export function getPersistentReadIds(userId: string): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`geoclean-read-notices-${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    }
  } catch {}
  return new Set<string>();
}

export function addPersistentReadId(userId: string, idOrKey: string): void {
  if (!userId || !idOrKey) return;
  try {
    if (typeof localStorage !== 'undefined') {
      const set = getPersistentReadIds(userId);
      set.add(idOrKey);
      localStorage.setItem(`geoclean-read-notices-${userId}`, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export type DbNotificationRow = {
  id: string;
  user_id: string;
  report_id: string | null;
  report_code?: string | null;
  title: string;
  message: string;
  type?: string | null;
  read?: boolean | null;
  is_read?: boolean | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Maps a database notification row or constructed payload into a UI Notice
 */
export function mapDbNotificationToNotice(row: DbNotificationRow, persistentReadIds?: Set<string>): Notice {
  const typeStr = (row.type || 'COMMUNITY_UPDATE').toUpperCase() as NotificationType;
  const validTypes: NotificationType[] = [
    'REPORT_SUBMITTED',
    'REPORT_ASSIGNED',
    'REPORT_IN_PROGRESS',
    'REPORT_RESOLVING',
    'REPORT_RESOLVED',
    'REPORT_DELETED',
    'COMMUNITY_UPDATE',
  ];
  const type: NotificationType = validTypes.includes(typeStr) ? typeStr : 'COMMUNITY_UPDATE';

  const meta = (row.metadata || {}) as Record<string, unknown>;
  const reportCode = (row.report_code || meta.reportCode || meta.report_code || '') as string;
  const location = (meta.location || meta.address || '') as string;
  const ngoName = (meta.ngoName || meta.ngo_name || '') as string;
  const createdAt = row.created_at || new Date().toISOString();

  const isExplicitlyRead = Boolean(row.is_read || row.read);
  const isCacheRead = Boolean(
    persistentReadIds && (
      persistentReadIds.has(row.id) ||
      (reportCode && persistentReadIds.has(`${type}_${reportCode}`)) ||
      (row.report_id && persistentReadIds.has(`${type}_${row.report_id}`))
    )
  );
  const isRead = isExplicitlyRead || isCacheRead;

  return {
    id: row.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId: row.user_id,
    title: row.title || 'Notification',
    detail: row.message || '',
    time: formatRelativeTime(createdAt),
    createdAt,
    read: isRead,
    is_read: isRead,
    icon: getIconForNotificationType(type),
    type,
    reportId: row.report_id || undefined,
    reportCode: reportCode || (row.report_id?.startsWith('GC-') ? row.report_id : undefined),
    location: location || undefined,
    ngoName: ngoName || undefined,
    metadata: meta,
  };
}

/**
 * Fetch notifications for a citizen from Supabase, backfilling missing report notifications
 */
export async function fetchCitizenNotifications(userId: string): Promise<Notice[]> {
  if (!userId) return [];

  const persistentReadIds = getPersistentReadIds(userId);
  const noticesMap = new Map<string, Notice>();

  // 1. Fetch from Supabase notifications table
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, report_id, report_code, title, message, type, read, is_read, created_at, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      for (const row of data as DbNotificationRow[]) {
        const notice = mapDbNotificationToNotice(row, persistentReadIds);
        noticesMap.set(notice.id, notice);
      }
    }
  } catch (err) {
    console.warn('Error fetching notifications from DB:', err);
  }

  // 2. Inspect citizen reports from Supabase & LocalStorage and automatically backfill notifications for any existing reports that lack notifications
  try {
    const allReportsMap = new Map<string, {
      id: string;
      report_code: string;
      waste_type: string;
      address: string;
      status: string;
      assigned_ngo_id?: string | null;
      created_at: string;
      resolved_at?: string | null;
      deleted?: boolean | null;
      ngo_name?: string;
    }>();

    // A. From Supabase
    const { data: userReports } = await supabase
      .from('waste_reports')
      .select('id, report_code, title, waste_type, address, status, assigned_ngo_id, created_at, resolved_at, deleted, deleted_at, deletion_reason, ngos(ngo_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (Array.isArray(userReports)) {
      for (const rep of userReports) {
        if (!rep.deleted) {
          allReportsMap.set(rep.report_code || rep.id, {
            id: rep.id,
            report_code: rep.report_code || rep.id,
            waste_type: rep.waste_type || 'waste',
            address: rep.address || 'Pune',
            status: rep.status,
            assigned_ngo_id: rep.assigned_ngo_id,
            created_at: rep.created_at,
            resolved_at: rep.resolved_at,
            deleted: rep.deleted,
            ngo_name: (rep.ngos as { ngo_name?: string } | null)?.ngo_name || (rep.assigned_ngo_id ? 'Green Earth NGO' : undefined),
          });
        }
      }
    }

    // B. From LocalStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const localRaw = localStorage.getItem('geoclean-reports');
        if (localRaw) {
          const localReports = JSON.parse(localRaw) as Report[];
          for (const lr of localReports) {
            if (!lr.deleted && (lr.reporterId === userId || !lr.reporterId)) {
              const code = lr.id;
              if (!allReportsMap.has(code)) {
                allReportsMap.set(code, {
                  id: lr.dbId || lr.id,
                  report_code: code,
                  waste_type: lr.issueType || 'waste',
                  address: lr.readableLocation || lr.location || 'Pune',
                  status: lr.status,
                  assigned_ngo_id: lr.assignedNgoId,
                  created_at: lr.createdAt,
                  resolved_at: lr.resolvedAt,
                  deleted: lr.deleted,
                  ngo_name: lr.assignedNgoName || lr.assignedTo || (lr.status !== 'Submitted' ? 'Green Earth NGO' : undefined),
                });
              }
            }
          }
        }
      }
    } catch {}

    const combinedReports = Array.from(allReportsMap.values());
    if (combinedReports.length > 0) {
      const existingNotices = Array.from(noticesMap.values());

      for (const rep of combinedReports) {
        if (rep.deleted) continue;

        const code = rep.report_code || rep.id;
        const shortLoc = rep.address ? rep.address.split(',')[0].trim() : 'Wakad';
        const normStatus = normalizeReportStatus(rep.status);
        const ngoName = rep.ngo_name || (rep.assigned_ngo_id ? 'Green Earth NGO' : 'Green Earth NGO');

        // A. Check REPORT_SUBMITTED notification
        const hasSubmitted = existingNotices.some(
          (n) => (n.reportId === rep.id || n.reportCode === code) && n.type === 'REPORT_SUBMITTED'
        );
        if (!hasSubmitted) {
          const isRead = persistentReadIds.has(`sub-${rep.id}`) || persistentReadIds.has(`REPORT_SUBMITTED_${code}`);
          const submittedNotice: DbNotificationRow = {
            id: `sub-${rep.id}`,
            user_id: userId,
            report_id: rep.id,
            report_code: code,
            type: 'REPORT_SUBMITTED',
            title: 'Report Submitted',
            message: `Your ${rep.waste_type} issue at ${shortLoc} has been successfully submitted.`,
            read: isRead,
            is_read: isRead,
            created_at: rep.created_at || new Date().toISOString(),
            metadata: {
              reportCode: code,
              location: rep.address,
              wasteType: rep.waste_type,
            },
          };
          noticesMap.set(submittedNotice.id, mapDbNotificationToNotice(submittedNotice, persistentReadIds));

          // Asynchronously persist to database
          void supabase.from('notifications').insert({
            id: submittedNotice.id,
            user_id: userId,
            report_id: rep.id,
            report_code: code,
            type: 'REPORT_SUBMITTED',
            title: submittedNotice.title,
            message: submittedNotice.message,
            read: isRead,
            is_read: isRead,
            created_at: rep.created_at,
            metadata: submittedNotice.metadata,
          });
        }

        // B. Check ASSIGNED notification
        if (normStatus === 'Assigned' || normStatus === 'In Progress' || normStatus === 'Resolving' || normStatus === 'Resolved') {
          const hasAssigned = existingNotices.some(
            (n) => (n.reportId === rep.id || n.reportCode === code) && n.type === 'REPORT_ASSIGNED'
          );
          if (!hasAssigned) {
            const isRead = persistentReadIds.has(`asg-${rep.id}`) || persistentReadIds.has(`REPORT_ASSIGNED_${code}`);
            const assignedTime = new Date(new Date(rep.created_at).getTime() + 45 * 60 * 1000).toISOString();
            const assignedNotice: DbNotificationRow = {
              id: `asg-${rep.id}`,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_ASSIGNED',
              title: 'Cleanup Assigned',
              message: `${ngoName} has been assigned to clean your reported garbage issue.`,
              read: isRead,
              is_read: isRead,
              created_at: assignedTime,
              metadata: {
                reportCode: code,
                location: rep.address,
                ngoName,
              },
            };
            noticesMap.set(assignedNotice.id, mapDbNotificationToNotice(assignedNotice, persistentReadIds));

            void supabase.from('notifications').insert({
              id: assignedNotice.id,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_ASSIGNED',
              title: assignedNotice.title,
              message: assignedNotice.message,
              read: isRead,
              is_read: isRead,
              created_at: assignedTime,
              metadata: assignedNotice.metadata,
            });
          }
        }

        // C. Check IN_PROGRESS notification
        if (normStatus === 'In Progress' || normStatus === 'Resolving' || normStatus === 'Resolved') {
          const hasProgress = existingNotices.some(
            (n) => (n.reportId === rep.id || n.reportCode === code) && n.type === 'REPORT_IN_PROGRESS'
          );
          if (!hasProgress) {
            const isRead = persistentReadIds.has(`prog-${rep.id}`) || persistentReadIds.has(`REPORT_IN_PROGRESS_${code}`);
            const progTime = new Date(new Date(rep.created_at).getTime() + 2 * 60 * 60 * 1000).toISOString();
            const progNotice: DbNotificationRow = {
              id: `prog-${rep.id}`,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_IN_PROGRESS',
              title: 'Cleanup In Progress',
              message: `${ngoName} is currently cleaning your reported location.`,
              read: isRead,
              is_read: isRead,
              created_at: progTime,
              metadata: {
                reportCode: code,
                location: rep.address,
                ngoName,
              },
            };
            noticesMap.set(progNotice.id, mapDbNotificationToNotice(progNotice, persistentReadIds));

            void supabase.from('notifications').insert({
              id: progNotice.id,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_IN_PROGRESS',
              title: progNotice.title,
              message: progNotice.message,
              read: isRead,
              is_read: isRead,
              created_at: progTime,
              metadata: progNotice.metadata,
            });
          }
        }

        // D. Check RESOLVING notification
        if (normStatus === 'Resolving' || normStatus === 'Resolved') {
          const hasResolving = existingNotices.some(
            (n) => (n.reportId === rep.id || n.reportCode === code) && n.type === 'REPORT_RESOLVING'
          );
          if (!hasResolving) {
            const isRead = persistentReadIds.has(`rslv-${rep.id}`) || persistentReadIds.has(`REPORT_RESOLVING_${code}`);
            const resTime = new Date(new Date(rep.created_at).getTime() + 4 * 60 * 60 * 1000).toISOString();
            const resolvingNotice: DbNotificationRow = {
              id: `rslv-${rep.id}`,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_RESOLVING',
              title: 'Cleanup Being Completed',
              message: 'Your reported garbage issue is currently being resolved.',
              read: isRead,
              is_read: isRead,
              created_at: resTime,
              metadata: {
                reportCode: code,
                location: rep.address,
                ngoName,
              },
            };
            noticesMap.set(resolvingNotice.id, mapDbNotificationToNotice(resolvingNotice, persistentReadIds));

            void supabase.from('notifications').insert({
              id: resolvingNotice.id,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_RESOLVING',
              title: resolvingNotice.title,
              message: resolvingNotice.message,
              read: isRead,
              is_read: isRead,
              created_at: resTime,
              metadata: resolvingNotice.metadata,
            });
          }
        }

        // E. Check RESOLVED notification
        if (normStatus === 'Resolved') {
          const hasResolved = existingNotices.some(
            (n) => (n.reportId === rep.id || n.reportCode === code) && n.type === 'REPORT_RESOLVED'
          );
          if (!hasResolved) {
            const isRead = persistentReadIds.has(`res-${rep.id}`) || persistentReadIds.has(`REPORT_RESOLVED_${code}`);
            const resTime = rep.resolved_at || new Date(new Date(rep.created_at).getTime() + 6 * 60 * 60 * 1000).toISOString();
            const resolvedNotice: DbNotificationRow = {
              id: `res-${rep.id}`,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_RESOLVED',
              title: 'Issue Resolved',
              message: 'Your reported garbage issue has been resolved.',
              read: isRead,
              is_read: isRead,
              created_at: resTime,
              metadata: {
                reportCode: code,
                location: rep.address,
                ngoName,
                resolvedAt: resTime,
              },
            };
            noticesMap.set(resolvedNotice.id, mapDbNotificationToNotice(resolvedNotice, persistentReadIds));

            void supabase.from('notifications').insert({
              id: resolvedNotice.id,
              user_id: userId,
              report_id: rep.id,
              report_code: code,
              type: 'REPORT_RESOLVED',
              title: resolvedNotice.title,
              message: resolvedNotice.message,
              read: isRead,
              is_read: isRead,
              created_at: resTime,
              metadata: resolvedNotice.metadata,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error verifying report notifications:', err);
  }

  // 3. Ensure Welcome Community Notification exists once for citizen
  const hasWelcome = Array.from(noticesMap.values()).some((n) => n.type === 'COMMUNITY_UPDATE');
  if (!hasWelcome) {
    const isRead = persistentReadIds.has(`welcome-${userId}`) || persistentReadIds.has('COMMUNITY_UPDATE_welcome');
    const welcomeNotice: DbNotificationRow = {
      id: `welcome-${userId}`,
      user_id: userId,
      report_id: null,
      type: 'COMMUNITY_UPDATE',
      title: 'Welcome to GeoClean 🌱',
      message: 'Welcome to GeoClean! Thank you for helping keep Pune clean. Together, we can build a cleaner, greener community.',
      read: isRead,
      is_read: isRead,
      created_at: new Date().toISOString(),
      metadata: { source: 'onboarding' },
    };
    noticesMap.set(welcomeNotice.id, mapDbNotificationToNotice(welcomeNotice, persistentReadIds));

    void supabase.from('notifications').insert({
      id: welcomeNotice.id,
      user_id: userId,
      type: 'COMMUNITY_UPDATE',
      title: welcomeNotice.title,
      message: welcomeNotice.message,
      read: isRead,
      is_read: isRead,
      created_at: welcomeNotice.created_at,
      metadata: welcomeNotice.metadata,
    });
  }

  // Convert to sorted array (newest first)
  const sorted = Array.from(noticesMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Save to localStorage for instant offline access
  try {
    localStorage.setItem(`geoclean-notices-${userId}`, JSON.stringify(sorted));
    localStorage.setItem('geoclean-notices', JSON.stringify(sorted));
  } catch {}

  return sorted;
}

/**
 * Inserts a new notification in Supabase and updates local storage
 */
export async function createNotification(params: {
  userId: string;
  reportId?: string;
  reportCode?: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): Promise<Notice | null> {
  const now = params.createdAt || new Date().toISOString();

  // Deduplication check
  try {
    if (params.reportId && params.type !== 'COMMUNITY_UPDATE') {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', params.userId)
        .eq('type', params.type)
        .or(`report_id.eq.${params.reportId},report_code.eq.${params.reportCode || params.reportId}`)
        .limit(1);

      if (existing && existing.length > 0) {
        return null;
      }
    }
  } catch {}

  const row: DbNotificationRow = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    user_id: params.userId,
    report_id: params.reportId || null,
    report_code: params.reportCode || null,
    type: params.type,
    title: params.title,
    message: params.message,
    read: false,
    created_at: now,
    metadata: params.metadata || null,
  };

  try {
    await supabase.from('notifications').insert({
      id: row.id,
      user_id: row.user_id,
      report_id: row.report_id,
      report_code: row.report_code,
      type: row.type,
      title: row.title,
      message: row.message,
      read: false,
      created_at: row.created_at,
      metadata: row.metadata,
    });
  } catch (err) {
    console.error('Failed to insert notification in Supabase:', err);
  }

  const notice = mapDbNotificationToNotice(row);

  // Update local storage and dispatch event
  try {
    const raw = localStorage.getItem(`geoclean-notices-${params.userId}`) || '[]';
    const list = JSON.parse(raw) as Notice[];
    const next = [notice, ...list.filter((n) => n.id !== notice.id)];
    localStorage.setItem(`geoclean-notices-${params.userId}`, JSON.stringify(next));
    localStorage.setItem('geoclean-notices', JSON.stringify(next));
  } catch {}

  window.dispatchEvent(new CustomEvent('geoclean-notifications-updated'));
  return notice;
}

/**
 * Creates Report Submitted notification for a citizen
 */
export async function createReportSubmittedNotification(params: {
  userId: string;
  reportId: string;
  reportCode: string;
  wasteType?: string;
  location?: string;
}) {
  const shortLoc = params.location ? params.location.split(',')[0].trim() : 'Wakad';
  return createNotification({
    userId: params.userId,
    reportId: params.reportId,
    reportCode: params.reportCode,
    type: 'REPORT_SUBMITTED',
    title: 'Report Submitted',
    message: `Your garbage issue at ${shortLoc} has been successfully submitted.`,
    metadata: {
      reportCode: params.reportCode,
      location: params.location,
      wasteType: params.wasteType,
    },
  });
}

/**
 * Create cleanup status transition notification
 */
export async function createStatusChangeNotification(params: {
  userId: string;
  reportId: string;
  reportCode: string;
  newStatus: ReportStatus;
  location?: string;
  ngoName?: string;
}) {
  const norm = normalizeReportStatus(params.newStatus);
  let type: NotificationType;
  let title: string;
  let message: string;

  const ngo = params.ngoName || 'Green Earth NGO';

  switch (norm) {
    case 'Assigned':
      type = 'REPORT_ASSIGNED';
      title = 'Cleanup Assigned';
      message = `${ngo} has been assigned to clean your reported garbage issue.`;
      break;
    case 'In Progress':
      type = 'REPORT_IN_PROGRESS';
      title = 'Cleanup In Progress';
      message = `${ngo} is currently cleaning your reported location.`;
      break;
    case 'Resolving':
      type = 'REPORT_RESOLVING';
      title = 'Cleanup Being Completed';
      message = 'Your reported garbage issue is currently being resolved.';
      break;
    case 'Resolved':
      type = 'REPORT_RESOLVED';
      title = 'Issue Resolved';
      message = 'Your reported garbage issue has been resolved.';
      break;
    default:
      return null;
  }

  return createNotification({
    userId: params.userId,
    reportId: params.reportId,
    reportCode: params.reportCode,
    type,
    title,
    message,
    metadata: {
      reportCode: params.reportCode,
      location: params.location,
      ngoName: params.ngoName,
      status: norm,
    },
  });
}

/**
 * Mark a single notification as read in database and local cache
 */
export async function markNotificationRead(notificationId: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
  if (userId) {
    addPersistentReadId(userId, notificationId);
  }

  // 1. Update in local storage
  if (userId) {
    try {
      const raw = localStorage.getItem(`geoclean-notices-${userId}`) || '[]';
      const list = JSON.parse(raw) as Notice[];
      const next = list.map((n) => {
        if (n.id === notificationId) {
          if (n.reportCode) addPersistentReadId(userId, `${n.type}_${n.reportCode}`);
          if (n.reportId) addPersistentReadId(userId, `${n.type}_${n.reportId}`);
          return { ...n, read: true, is_read: true };
        }
        return n;
      });
      localStorage.setItem(`geoclean-notices-${userId}`, JSON.stringify(next));
      localStorage.setItem('geoclean-notices', JSON.stringify(next));
    } catch {}
  }

  // 2. Dispatch UI event immediately
  window.dispatchEvent(new CustomEvent('geoclean-notifications-updated'));

  // 3. Update in Supabase
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('id', notificationId);

    if (error && userId) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read: true })
        .eq('user_id', userId)
        .or(`id.eq.${notificationId},report_code.eq.${notificationId}`);
    }
    return { ok: true };
  } catch (err) {
    console.warn('Error marking notification read in DB:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Database sync failed' };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: true };

  // 1. Mark all local notices and cache all their IDs in persistent read set
  try {
    const raw = localStorage.getItem(`geoclean-notices-${userId}`) || '[]';
    const list = JSON.parse(raw) as Notice[];
    const next = list.map((n) => {
      addPersistentReadId(userId, n.id);
      if (n.reportCode) addPersistentReadId(userId, `${n.type}_${n.reportCode}`);
      if (n.reportId) addPersistentReadId(userId, `${n.type}_${n.reportId}`);
      return { ...n, read: true, is_read: true };
    });
    localStorage.setItem(`geoclean-notices-${userId}`, JSON.stringify(next));
    localStorage.setItem('geoclean-notices', JSON.stringify(next));
  } catch {}

  // 2. Dispatch UI event immediately
  window.dispatchEvent(new CustomEvent('geoclean-notifications-updated'));

  // 3. Update in Supabase
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('user_id', userId);
    return { ok: true };
  } catch (err) {
    console.warn('Error marking all notifications read in DB:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Database sync failed' };
  }
}

type RealtimeChannelInstance = ReturnType<typeof supabase.channel>;
let activeRealtimeChannel: RealtimeChannelInstance | null = null;
let activeRealtimeUserId: string | null = null;
const realtimeCallbacks = new Set<() => void>();

/**
 * Subscribe to Supabase Realtime changes on notifications & reports for instantaneous updates.
 * Manages a single active channel per user and supports multiple concurrent component subscribers safely.
 */
export function subscribeToRealtimeNotifications(userId: string, onUpdate: () => void): () => void {
  if (!userId) return () => {};

  realtimeCallbacks.add(onUpdate);

  // If channel is already established for this exact user, do not recreate or call .on() on an already-subscribed channel
  if (!activeRealtimeChannel || activeRealtimeUserId !== userId) {
    if (activeRealtimeChannel) {
      try {
        void supabase.removeChannel(activeRealtimeChannel);
      } catch {}
      activeRealtimeChannel = null;
    }

    activeRealtimeUserId = userId;

    try {
      const channelTopic = `citizen-rt-${userId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
      const channel = supabase.channel(channelTopic);

      // Register ALL postgres_changes callbacks BEFORE .subscribe()
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            realtimeCallbacks.forEach((cb) => {
              try {
                cb();
              } catch (e) {
                console.warn('Realtime callback error:', e);
              }
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'waste_reports',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            realtimeCallbacks.forEach((cb) => {
              try {
                cb();
              } catch (e) {
                console.warn('Realtime callback error:', e);
              }
            });
            window.dispatchEvent(new CustomEvent('geoclean-reports-updated'));
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.warn('Supabase Realtime subscription notice (non-fatal):', err);
          }
        });

      activeRealtimeChannel = channel;
    } catch (err) {
      console.warn('Failed to initialize Supabase Realtime channel (falling back to events):', err);
    }
  }

  const handleCustomEvent = () => onUpdate();
  window.addEventListener('geoclean-notifications-updated', handleCustomEvent);
  window.addEventListener('geoclean-reports-updated', handleCustomEvent);

  return () => {
    realtimeCallbacks.delete(onUpdate);
    window.removeEventListener('geoclean-notifications-updated', handleCustomEvent);
    window.removeEventListener('geoclean-reports-updated', handleCustomEvent);

    if (realtimeCallbacks.size === 0 && activeRealtimeChannel) {
      try {
        void supabase.removeChannel(activeRealtimeChannel);
      } catch {}
      activeRealtimeChannel = null;
      activeRealtimeUserId = null;
    }
  };
}

