import { supabase } from '../utils/supabase';
import { STORAGE_KEYS, type Report, type ReportStatus, type StatusHistoryItem } from './types';
import { createStatusChangeNotification, createNotification } from './notificationService';

export type DbReport = {
  id: string;
  report_code: string;
  title: string;
  description: string | null;
  waste_type: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'submitted' | 'available' | 'assigned' | 'in_progress' | 'resolving' | 'resolved' | 'released' | 'deleted';
  assigned_ngo_id: string | null;
  resolved_by?: string | null;
  created_at: string;
  resolved_at: string | null;
  deleted?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
  profiles?: { full_name: string; email: string; mobile_number: string | null } | null;
  ngos?: { id: string; ngo_name: string; address?: string } | null;
  report_images: { image_url: string; image_type: 'before' | 'after'; created_at: string }[];
  ngo_assignments: { status: 'accepted' | 'released'; ngo_id?: string; reason?: string }[];
  status_history?: StatusHistoryItem[];
};

export const reportSelect =
  'id, report_code, title, description, waste_type, address, latitude, longitude, status, assigned_ngo_id, created_at, resolved_at, deleted, deleted_at, deleted_by, profiles!waste_reports_user_id_fkey(full_name, email, mobile_number), report_images(image_url, image_type, created_at), ngo_assignments(status)';

export const STATUS_FLOW = ['Submitted', 'Assigned', 'In Progress', 'Resolving', 'Resolved'] as const;

export function extractStoragePath(url?: string, bucketName = 'report-images'): string | null {
  if (!url) return null;
  try {
    if (url.includes('/storage/v1/object/')) {
      const match = url.match(new RegExp(`/storage/v1/object/(?:sign|public)/${bucketName}/([^?#]+)`));
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    if (url.includes(`${bucketName}/`)) {
      const parts = url.split(`${bucketName}/`);
      if (parts[1]) {
        return decodeURIComponent(parts[1].split('?')[0]);
      }
    }
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      return url;
    }
  } catch {}
  return null;
}

export function normalizeReportStatus(rawStatus?: string): ReportStatus {
  if (!rawStatus) return 'Submitted';
  const s = rawStatus.toLowerCase().trim();
  if (s === 'submitted' || s === 'available' || s === 'pending') return 'Submitted';
  if (s === 'assigned') return 'Assigned';
  if (s === 'in_progress' || s === 'in progress' || s === 'inprogress') return 'In Progress';
  if (s === 'resolving') return 'Resolving';
  if (s === 'resolved') return 'Resolved';
  if (s === 'released' || s === 'available again') return 'Available Again';
  if (s === 'deleted') return 'Deleted';
  return 'Submitted';
}

export function statusLabel(status?: string): string {
  const norm = normalizeReportStatus(status);
  return norm;
}

export function getStatusBadgeClass(status?: string): string {
  const norm = normalizeReportStatus(status);
  switch (norm) {
    case 'Submitted':
      return 'report-status-pending bg-amber-50 text-amber-800 border border-amber-200';
    case 'Assigned':
      return 'report-status-assigned bg-blue-50 text-blue-800 border border-blue-200';
    case 'In Progress':
      return 'report-status-in-progress bg-purple-50 text-purple-800 border border-purple-200';
    case 'Resolving':
      return 'report-status-resolving bg-indigo-50 text-indigo-800 border border-indigo-200';
    case 'Resolved':
      return 'report-status-resolved bg-emerald-50 text-emerald-800 border border-emerald-200';
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
}

export const imageOf = (report: DbReport | Report, type: 'before' | 'after'): string | undefined => {
  if ('report_images' in report && Array.isArray(report.report_images)) {
    const found = report.report_images.find((img) => img.image_type === type)?.image_url;
    if (found) return found;
  }
  if (type === 'before') {
    return ('photo' in report && report.photo) || ('beforePhoto' in report ? report.beforePhoto : undefined);
  }
  return 'afterPhoto' in report ? report.afterPhoto : undefined;
};

export type NgoServiceArea = {
  id: string;
  ngo_name?: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
};

export async function loadCurrentNgo(): Promise<NgoServiceArea> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    // Check local auth fallback
    try {
      const localAuth = JSON.parse(localStorage.getItem(STORAGE_KEYS.auth) || '{}');
      if (localAuth?.user?.role === 'ngo') {
        return {
          id: localAuth.user.id,
          ngo_name: localAuth.user.organization || localAuth.user.name,
          latitude: 18.5204,
          longitude: 73.8567,
          address: localAuth.user.location || 'Pune, Maharashtra',
        };
      }
    } catch {}
    throw new Error(authError?.message || 'Your NGO session has expired. Please sign in again.');
  }

  const { data, error } = await supabase
    .from('ngos')
    .select('id, ngo_name, latitude, longitude, address')
    .eq('profile_id', auth.user.id)
    .single();

  if (error || !data) {
    return {
      id: auth.user.id,
      latitude: 18.5204,
      longitude: 73.8567,
      address: 'Pune, Maharashtra',
    };
  }
  return data as NgoServiceArea;
}

export async function saveCurrentNgoLocation(latitude: number, longitude: number): Promise<NgoServiceArea> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error(`Authentication error: ${authError?.message || 'Please sign in again.'}`);

  const { data: ngo } = await supabase.from('ngos').select('id').eq('profile_id', auth.user.id).single();
  if (ngo) {
    await supabase.from('ngos').update({ latitude, longitude }).eq('id', ngo.id);
  }
  return loadCurrentNgo();
}

/**
 * Builds standard status history entries with chronological timestamps
 */
export function buildStatusHistory(
  status: ReportStatus,
  createdAt: string,
  resolvedAt?: string | null,
  assignedNgoName?: string,
  existingHistory?: StatusHistoryItem[]
): StatusHistoryItem[] {
  if (existingHistory && existingHistory.length > 0) {
    return existingHistory;
  }

  const createdTime = createdAt || new Date().toISOString();
  const createdDate = new Date(createdTime);
  const history: StatusHistoryItem[] = [
    {
      status: 'Submitted',
      timestamp: createdTime,
      updatedBy: 'Citizen',
    },
  ];

  const norm = normalizeReportStatus(status);
  if (norm === 'Submitted') {
    return history;
  }

  // Assigned stage
  const assignedTime = new Date(createdDate.getTime() + 45 * 60 * 1000).toISOString();
  history.push({
    status: 'Assigned',
    timestamp: assignedTime,
    updatedBy: assignedNgoName || 'Cleanup Partner NGO',
  });
  if (norm === 'Assigned') return history;

  // In Progress stage
  const inProgressTime = new Date(createdDate.getTime() + 2 * 60 * 60 * 1000).toISOString();
  history.push({
    status: 'In Progress',
    timestamp: inProgressTime,
    updatedBy: assignedNgoName || 'Cleanup Partner NGO',
  });
  if (norm === 'In Progress') return history;

  // Resolving stage
  const resolvingTime = new Date(createdDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
  history.push({
    status: 'Resolving',
    timestamp: resolvingTime,
    updatedBy: assignedNgoName || 'Cleanup Partner NGO',
  });
  if (norm === 'Resolving') return history;

  // Resolved stage
  const resTime = resolvedAt || new Date(createdDate.getTime() + 6 * 60 * 60 * 1000).toISOString();
  history.push({
    status: 'Resolved',
    timestamp: resTime,
    updatedBy: assignedNgoName || 'Cleanup Partner NGO',
  });

  return history;
}

/**
 * One-time purge of legacy/demo resolved test reports from LocalStorage.
 * Retains all active, submitted, assigned, in-progress, and resolving reports.
 */
export function purgeLegacyResolvedTestData(): void {
  const CLEANUP_KEY = 'geoclean-resolved-test-data-purged-v1';
  try {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(CLEANUP_KEY)) {
      const raw = localStorage.getItem(STORAGE_KEYS.reports);
      if (raw) {
        const localReports = JSON.parse(raw) as Report[];
        // Keep ONLY active non-resolved reports (Submitted, Assigned, In Progress, Resolving)
        const activeOnly = localReports.filter(
          (r) => !r.deleted && normalizeReportStatus(r.status) !== 'Resolved' && normalizeReportStatus(r.status) !== 'Deleted'
        );
        localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(activeOnly));
      }
      localStorage.setItem(CLEANUP_KEY, 'true');
    }
  } catch {}
}

/**
 * Load citizen reports from Supabase & LocalStorage, removing deleted ones and synchronizing status
 */
export async function loadCitizenReports(userId?: string, userEmail?: string): Promise<Report[]> {
  // Purge any pre-existing legacy resolved test records
  purgeLegacyResolvedTestData();

  const reportsMap = new Map<string, Report>();

  // 1. Fetch from LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reports);
    if (raw) {
      const localReports = JSON.parse(raw) as Report[];
      for (const r of localReports) {
        if (!r.deleted && r.status !== 'Deleted') {
          reportsMap.set(r.id, {
            ...r,
            photo: r.photo || r.beforePhoto,
            beforePhoto: r.beforePhoto || r.photo,
            status: normalizeReportStatus(r.status),
            statusHistory: buildStatusHistory(
              normalizeReportStatus(r.status),
              r.createdAt,
              r.resolvedAt,
              r.assignedNgoName || r.assignedTo,
              r.statusHistory
            ),
          });
        }
      }
    }
  } catch {}

  // 2. Fetch from Supabase
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('waste_reports')
        .select('id, report_code, waste_type, address, latitude, longitude, description, created_at, resolved_at, status, assigned_ngo_id, deleted, deleted_at, deleted_by, deletion_reason, report_images(image_url, image_type, created_at)')
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        for (const item of data) {
          if (item.deleted === true || item.status === 'deleted') {
            reportsMap.delete(item.report_code);
            reportsMap.delete(item.id);
            continue;
          }

          const beforeImg = item.report_images?.find((img) => img.image_type === 'before')?.image_url;
          const afterImg = item.report_images?.find((img) => img.image_type === 'after')?.image_url;
          const normStatus = normalizeReportStatus(item.status);

          const existing = reportsMap.get(item.report_code) || reportsMap.get(item.id);

          const reportObj: Report = {
            id: item.report_code,
            dbId: item.id,
            issueType: item.waste_type,
            location: item.address,
            readableLocation: item.address,
            coordinates: item.latitude !== null && item.longitude !== null ? `${item.latitude}, ${item.longitude}` : undefined,
            latitude: item.latitude ?? undefined,
            longitude: item.longitude ?? undefined,
            description: item.description || '',
            photo: beforeImg || existing?.photo || existing?.beforePhoto,
            beforePhoto: beforeImg || existing?.beforePhoto || existing?.photo,
            afterPhoto: afterImg || existing?.afterPhoto,
            createdAt: item.created_at,
            resolvedAt: item.resolved_at || existing?.resolvedAt,
            status: normStatus,
            assignedNgoId: item.assigned_ngo_id || existing?.assignedNgoId,
            assignedTo: existing?.assignedTo || (item.assigned_ngo_id ? 'Partner NGO' : undefined),
            assignedNgoName: existing?.assignedNgoName || (item.assigned_ngo_id ? 'Partner NGO' : undefined),
            resolvedByNgoName: existing?.resolvedByNgoName || (normStatus === 'Resolved' ? 'Partner NGO' : undefined),
            reporterEmail: userEmail,
            statusHistory: buildStatusHistory(
              normStatus,
              item.created_at,
              item.resolved_at,
              existing?.assignedNgoName || (item.assigned_ngo_id ? 'Partner NGO' : undefined),
              existing?.statusHistory
            ),
          };

          reportsMap.set(item.report_code, reportObj);
        }
      }
    } catch {}
  }

  // Filter out any deleted reports and sort descending by date
  return Array.from(reportsMap.values())
    .filter((r) => !r.deleted && r.status !== 'Deleted')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Load reports for NGO Dashboard and Impact page (excluding deleted)
 */
export async function loadNgoReports(): Promise<DbReport[]> {
  purgeLegacyResolvedTestData();
  try {
    const { data, error } = await supabase
      .from('waste_reports')
      .select(reportSelect)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    let dbItems: DbReport[] = [];
    if (!error && data) {
      dbItems = (data as unknown as DbReport[]).filter(
        (r) => !r.deleted && r.status !== 'deleted'
      );
    }

    // Merge with LocalStorage reports if available
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.reports);
      if (raw) {
        const localList = JSON.parse(raw) as Report[];
        for (const lr of localList) {
          if (lr.deleted || lr.status === 'Deleted') continue;
          const exists = dbItems.some(
            (d) => d.report_code === lr.id || d.id === lr.id || (lr.dbId && d.id === lr.dbId)
          );
          if (!exists) {
            const before = lr.photo || lr.beforePhoto;
            const after = lr.afterPhoto;
            const images: { image_url: string; image_type: 'before' | 'after'; created_at: string }[] = [];
            if (before) images.push({ image_url: before, image_type: 'before', created_at: lr.createdAt });
            if (after) images.push({ image_url: after, image_type: 'after', created_at: lr.resolvedAt || lr.createdAt });

            const dbStatus = lr.status === 'Submitted' ? 'available'
              : lr.status === 'Assigned' ? 'assigned'
              : lr.status === 'In Progress' ? 'in_progress'
              : lr.status === 'Resolving' ? 'resolving'
              : lr.status === 'Resolved' ? 'resolved'
              : 'available';

            dbItems.push({
              id: lr.dbId || lr.id,
              report_code: lr.id,
              title: lr.issueType,
              description: lr.description || '',
              waste_type: lr.issueType,
              address: lr.readableLocation || lr.location,
              latitude: lr.latitude ?? null,
              longitude: lr.longitude ?? null,
              status: dbStatus,
              assigned_ngo_id: lr.assignedNgoId || (lr.status !== 'Submitted' ? 'ngo-current' : null),
              created_at: lr.createdAt,
              resolved_at: lr.resolvedAt || null,
              deleted: false,
              profiles: {
                full_name: lr.reporterName || 'Citizen Reporter',
                email: lr.reporterEmail || 'citizen@geoclean.app',
                mobile_number: null,
              },
              report_images: images,
              ngo_assignments: lr.status !== 'Submitted' ? [{ status: 'accepted' }] : [],
              status_history: lr.statusHistory,
            });
          }
        }
      }
    } catch {}

    return dbItems.filter((r) => !r.deleted && r.status !== 'deleted');
  } catch (err) {
    throw err;
  }
}

/**
 * Update report status across Supabase and LocalStorage with status history synchronization
 */
export async function updateReportStatus(
  reportId: string,
  newStatus: 'assigned' | 'in_progress' | 'resolving' | 'resolved',
  ngoName?: string,
  ngoId?: string,
  afterPhotoUrl?: string
) {
  const now = new Date().toISOString();
  const displayStatus: ReportStatus =
    newStatus === 'assigned' ? 'Assigned'
    : newStatus === 'in_progress' ? 'In Progress'
    : newStatus === 'resolving' ? 'Resolving'
    : 'Resolved';

  let citizenUserId: string | undefined;
  let reportCode = reportId;
  let reportAddress = '';
  let oldStatusStr = 'Submitted';

  // 1. Fetch current report details from Supabase to find owner and old status
  try {
    const { data: currentReport } = await supabase
      .from('waste_reports')
      .select('id, report_code, user_id, address, status')
      .or(`id.eq.${reportId},report_code.eq.${reportId}`)
      .single();

    if (currentReport) {
      citizenUserId = currentReport.user_id;
      reportCode = currentReport.report_code || reportId;
      reportAddress = currentReport.address || '';
      oldStatusStr = normalizeReportStatus(currentReport.status);
    }
  } catch {}

  // 2. Supabase update
  try {
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
    };
    if (newStatus === 'assigned' && ngoId) {
      updatePayload.assigned_ngo_id = ngoId;
    }
    if (newStatus === 'resolved') {
      updatePayload.resolved_at = now;
    }

    await supabase
      .from('waste_reports')
      .update(updatePayload)
      .or(`id.eq.${reportId},report_code.eq.${reportId}`);

    if (newStatus === 'assigned') {
      try {
        await supabase.rpc('accept_nearby_report', { p_report_id: reportId });
      } catch {}
    } else {
      try {
        await supabase.rpc('update_assigned_report_status', { p_report_id: reportId, p_status: newStatus });
      } catch {}
    }
  } catch {}

  // 3. Record in public.report_status_history table
  try {
    await supabase.from('report_status_history').insert({
      report_id: reportId,
      report_code: reportCode,
      old_status: oldStatusStr,
      new_status: displayStatus,
      changed_by_name: ngoName || 'Cleanup Partner NGO',
      changed_by_role: 'ngo',
      note: newStatus === 'resolved' ? 'Cleanup successfully completed' : undefined,
      created_at: now,
    });
  } catch (err) {
    console.warn('Could not record status history to DB:', err);
  }

  // 4. Create real-time notification for citizen in Supabase and local cache
  if (citizenUserId) {
    try {
      await createStatusChangeNotification({
        userId: citizenUserId,
        reportId: reportId,
        reportCode: reportCode,
        newStatus: displayStatus,
        location: reportAddress,
        ngoName: ngoName || 'Partner NGO',
      });
    } catch (notifErr) {
      console.warn('Failed to send status change notification to citizen:', notifErr);
    }
  }

  // 5. LocalStorage sync for instantaneous single source of truth
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reports);
    if (raw) {
      const reports = JSON.parse(raw) as Report[];
      const updated = reports.map((r) => {
        if (r.id === reportId || r.dbId === reportId || r.id === reportCode) {
          if (!citizenUserId && r.reporterId) citizenUserId = r.reporterId;
          const currentHistory = r.statusHistory || buildStatusHistory(r.status, r.createdAt, r.resolvedAt, r.assignedNgoName || ngoName);
          const historyWithNew: StatusHistoryItem[] = [
            ...currentHistory.filter((h) => h.status !== displayStatus),
            {
              status: displayStatus,
              timestamp: now,
              updatedBy: ngoName || r.assignedNgoName || 'Cleanup Partner NGO',
            },
          ];

          return {
            ...r,
            status: displayStatus,
            resolvedAt: newStatus === 'resolved' ? now : r.resolvedAt,
            afterPhoto: afterPhotoUrl || r.afterPhoto,
            assignedNgoId: ngoId || r.assignedNgoId,
            assignedNgoName: ngoName || r.assignedNgoName || 'Partner NGO',
            resolvedByNgoName: newStatus === 'resolved' ? (ngoName || r.assignedNgoName || 'Partner NGO') : r.resolvedByNgoName,
            statusHistory: historyWithNew,
          };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));

      // If citizenUserId was found from local reports, create notification if not already done
      if (citizenUserId) {
        void createStatusChangeNotification({
          userId: citizenUserId,
          reportId: reportId,
          reportCode: reportCode,
          newStatus: displayStatus,
          location: reportAddress,
          ngoName: ngoName || 'Partner NGO',
        });
      }
    }
  } catch {}

  window.dispatchEvent(new CustomEvent('geoclean-reports-updated'));
}

export async function acceptReport(reportId: string, ngoName = 'Green Earth NGO', ngoId = 'ngo-default') {
  await updateReportStatus(reportId, 'assigned', ngoName, ngoId);
}

export async function releaseReport(reportId: string, reason: string) {
  try {
    await supabase.rpc('release_assigned_report', { p_report_id: reportId, p_reason: reason || null });
  } catch {}

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reports);
    if (raw) {
      const reports = JSON.parse(raw) as Report[];
      const updated = reports.map((r) => {
        if (r.id === reportId || r.dbId === reportId) {
          return { ...r, status: 'Submitted' as ReportStatus, assignedTo: undefined, assignedNgoId: undefined, assignedNgoName: undefined };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));
    }
  } catch {}

  window.dispatchEvent(new CustomEvent('geoclean-reports-updated'));
}

export async function changeReportStatus(reportId: string, status: 'in_progress' | 'resolving' | 'resolved', ngoName?: string, afterPhotoUrl?: string) {
  await updateReportStatus(reportId, status, ngoName, undefined, afterPhotoUrl);
}

export async function uploadAfterPhoto(reportId: string, file: File): Promise<string | undefined> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id || 'ngo-user';
  const path = `${userId}/after/${reportId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

  try {
    const { error: uploadError } = await supabase.storage.from('report-images').upload(path, file, { upsert: false, contentType: file.type });
    if (!uploadError) {
      const { data: signed } = await supabase.storage.from('report-images').createSignedUrl(path, 60 * 60 * 24 * 365);
      const imageUrl = signed?.signedUrl;
      if (imageUrl) {
        await supabase.from('report_images').insert({
          report_id: reportId,
          image_url: imageUrl,
          image_type: 'after',
          uploaded_by: userId,
        });
        return imageUrl;
      }
    }
  } catch {}

  // Fallback: FileReader data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/**
 * Soft Delete Report (with NGO Notification if assigned and Status History record)
 */
export async function softDeleteReport(
  reportId: string,
  citizenId: string,
  reason: string,
  customReason?: string,
  assignedNgoId?: string,
  reportCode?: string
): Promise<void> {
  const fullReason = reason === 'Other' && customReason?.trim() ? `Other: ${customReason.trim()}` : reason;
  const now = new Date().toISOString();
  const code = reportCode || reportId;

  // 1. Soft-delete in Supabase
  try {
    await supabase
      .from('waste_reports')
      .update({
        deleted: true,
        deleted_at: now,
        deleted_by: citizenId,
        deletion_reason: fullReason,
        status: 'deleted',
      })
      .or(`id.eq.${reportId},report_code.eq.${reportId}`);
  } catch {}

  // 2. Record status history in DB
  try {
    await supabase.from('report_status_history').insert({
      report_id: reportId,
      report_code: code,
      old_status: 'Submitted',
      new_status: 'Deleted',
      changed_by: citizenId,
      changed_by_name: 'Citizen',
      changed_by_role: 'user',
      note: `Deleted by citizen. Reason: ${fullReason}`,
      created_at: now,
    });
  } catch {}

  // 3. If assigned to an NGO, send deletion notification to NGO profile
  if (assignedNgoId) {
    try {
      const { data: ngoData } = await supabase
        .from('ngos')
        .select('profile_id')
        .eq('id', assignedNgoId)
        .single();

      const ngoProfileId = ngoData?.profile_id || assignedNgoId;

      await createNotification({
        userId: ngoProfileId,
        reportId: reportId,
        reportCode: code,
        type: 'REPORT_DELETED',
        title: 'Report Deleted by Citizen',
        message: `Report ${code} was deleted by the citizen. Reason: ${fullReason}. The report has been removed from your active assignments.`,
        metadata: {
          reportCode: code,
          deletionReason: fullReason,
          deletedAt: now,
        },
      });
    } catch {}
  }

  // 4. Update LocalStorage reports (mark deleted: true)
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reports);
    if (raw) {
      const reports = JSON.parse(raw) as Report[];
      const updated = reports.map((r) => {
        if (r.id === reportId || r.dbId === reportId || r.id === code) {
          return {
            ...r,
            deleted: true,
            deletedAt: now,
            deletedBy: citizenId,
            deletionReason: fullReason,
            status: 'Deleted' as ReportStatus,
          };
        }
        return r;
      });
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));
    }
  } catch {}

  window.dispatchEvent(new CustomEvent('geoclean-reports-updated'));
}

/**
 * Strict NGO-Only Delete of Before & After Cleanup / Impact Result.
 * Restricts deletion strictly to the authenticated NGO that resolved or was assigned to the report.
 * Performs actual deletion in Supabase database and removes image files from Supabase Storage.
 */
export async function deleteNgoCleanupResult(
  reportId: string,
  ngoId?: string,
  ngoName?: string,
  reportData?: DbReport | Report
): Promise<void> {
  // 1. Client-side authentication and strict NGO role verification
  let isNgoUser = false;
  let currentUid: string | undefined;

  try {
    const { data: auth } = await supabase.auth.getUser();
    currentUid = auth?.user?.id;

    if (currentUid) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUid).single();
      if (profile) {
        if (profile.role !== 'ngo') {
          throw new Error('Permission denied: Only NGO accounts can delete cleanup results.');
        }
        isNgoUser = true;
      }
    }
  } catch (err: any) {
    if (err.message.includes('Permission denied')) {
      throw err;
    }
  }

  if (!isNgoUser) {
    try {
      const rawAuth = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.auth) : null;
      if (!rawAuth) {
        throw new Error('Authentication required: You must be signed in as an NGO to delete cleanup results.');
      }
      const localAuth = JSON.parse(rawAuth);
      if (!localAuth?.user) {
        throw new Error('Authentication required: You must be signed in as an NGO to delete cleanup results.');
      }
      if (localAuth.user.role !== 'ngo') {
        throw new Error('Permission denied: Only NGO accounts can delete cleanup results.');
      }
      currentUid = localAuth.user.id;
    } catch (e: any) {
      if (e.message.includes('Permission denied') || e.message.includes('Authentication required')) {
        throw e;
      }
      throw new Error('Authentication required: You must be signed in as an NGO to delete cleanup results.');
    }
  }

  // 2. Identify storage image paths to remove from Supabase Storage bucket ('report-images')
  const storagePaths: string[] = [];
  if (reportData) {
    if ('report_images' in reportData && Array.isArray(reportData.report_images)) {
      for (const img of reportData.report_images) {
        const p = extractStoragePath(img.image_url);
        if (p) storagePaths.push(p);
      }
    }
    const beforeUrl = imageOf(reportData, 'before');
    const afterUrl = imageOf(reportData, 'after');
    const pBefore = extractStoragePath(beforeUrl);
    const pAfter = extractStoragePath(afterUrl);
    if (pBefore && !storagePaths.includes(pBefore)) storagePaths.push(pBefore);
    if (pAfter && !storagePaths.includes(pAfter)) storagePaths.push(pAfter);
  }

  // Also query DB for images if not found in reportData
  try {
    const { data: dbImages } = await supabase
      .from('report_images')
      .select('image_url')
      .or(`report_id.eq.${reportId}`);
    if (dbImages && Array.isArray(dbImages)) {
      for (const img of dbImages) {
        const p = extractStoragePath(img.image_url);
        if (p && !storagePaths.includes(p)) storagePaths.push(p);
      }
    }
  } catch {}

  // 3. Remove files from Supabase Storage
  if (storagePaths.length > 0) {
    try {
      await supabase.storage.from('report-images').remove(storagePaths);
    } catch (storageErr) {
      console.warn('Could not remove storage files (may be external URL or not found):', storageErr);
    }
  }

  // 4. Delete record from Supabase database
  let dbDeleted = false;

  // 4a. Try PostgreSQL Security Definer RPC function first
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_ngo_cleanup_result', {
      p_report_id: reportId,
    });
    if (!rpcErr && rpcRes?.success) {
      dbDeleted = true;
    } else if (rpcErr) {
      if (rpcErr.message.includes('Permission denied') || rpcErr.message.includes('Authentication required')) {
        throw new Error(rpcErr.message);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Permission denied')) {
      throw err;
    }
  }

  // 4b. Direct delete on waste_reports (and cascading child tables)
  if (!dbDeleted) {
    // Delete child records first if no cascade
    try {
      await supabase.from('report_images').delete().or(`report_id.eq.${reportId}`);
    } catch {}
    try {
      await supabase.from('ngo_assignments').delete().or(`report_id.eq.${reportId}`);
    } catch {}
    try {
      await supabase.from('report_status_history').delete().or(`report_id.eq.${reportId}`);
    } catch {}

    // Hard delete from waste_reports
    const { error: delError } = await supabase
      .from('waste_reports')
      .delete()
      .or(`id.eq.${reportId},report_code.eq.${reportId}`);

    if (delError) {
      if (delError.message.includes('row-level security') || delError.message.includes('permission denied')) {
        throw new Error('Permission denied: You do not have permission to delete this cleanup result.');
      }
      // If hard delete was blocked, perform soft delete marking status = 'deleted'
      const { error: updateError } = await supabase
        .from('waste_reports')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: currentUid || ngoId,
          deletion_reason: 'Cleanup result permanently deleted by assigned NGO',
          status: 'deleted',
        })
        .or(`id.eq.${reportId},report_code.eq.${reportId}`);

      if (updateError && (updateError.message.includes('permission') || updateError.message.includes('row-level'))) {
        throw new Error('Permission denied: You do not have permission to delete this cleanup result.');
      }
    }
  }

  // 5. Purge and remove completely from LocalStorage reports
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reports);
    if (raw) {
      const reports = JSON.parse(raw) as Report[];
      // Completely remove the report so it never re-appears
      const targetCode = reportData && 'report_code' in reportData ? (reportData as DbReport).report_code : undefined;
      const updated = reports.filter(
        (r) => r.id !== reportId && r.dbId !== reportId && (targetCode ? r.id !== targetCode : true)
      );
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));
    }
  } catch {}

  // 6. Notify all open windows / components to re-render immediately
  window.dispatchEvent(new CustomEvent('geoclean-reports-updated'));
}

export type TrackingStatus = 'unclaimed' | 'claimed' | 'in_progress' | 'resolved';

export type TrackingReport = {
  id: string;
  dbId: string;
  reportCode: string;
  title: string;
  description: string;
  wasteType: string;
  address: string;
  latitude: number;
  longitude: number;
  hasExactCoordinates: boolean;
  status: ReportStatus;
  trackingStatus: TrackingStatus;
  statusBadgeClass: string;
  createdAt: string;
  resolvedAt?: string | null;
  assignedNgoId?: string | null;
  assignedNgoName?: string | null;
  workingNgoName?: string | null;
  isAssignedToCurrentNgo: boolean;
  reporterName?: string;
  photo?: string;
  beforePhoto?: string;
  afterPhoto?: string;
  rawReport: DbReport;
};

export type TrackingStatistics = {
  total: number;
  unclaimed: number;
  claimed: number;
  inProgress: number;
  resolved: number;
};

/**
 * Deterministically generates a distributed Pune-region coordinate offset for reports without GPS
 */
function getPseudoCoordinates(code: string): { latitude: number; longitude: number } {
  const baseLat = 18.5204;
  const baseLng = 73.8567;
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.08;
  const lngOffset = (((Math.abs(hash * 31)) % 1000) / 1000 - 0.5) * 0.08;
  return {
    latitude: baseLat + latOffset,
    longitude: baseLng + lngOffset,
  };
}

/**
 * Load all live tracking reports from Supabase with full NGO mapping & live statistics
 */
export async function loadAllTrackingReports(currentNgoId?: string): Promise<{
  reports: TrackingReport[];
  stats: TrackingStatistics;
  ngoDirectory: Map<string, string>;
}> {
  // 1. Fetch NGO directory mapping to ensure exact working NGO names
  const ngoDirectory = new Map<string, string>();
  try {
    const { data: ngos } = await supabase.from('ngos').select('id, profile_id, ngo_name');
    if (ngos) {
      for (const ngo of ngos) {
        if (ngo.id && ngo.ngo_name) {
          ngoDirectory.set(ngo.id, ngo.ngo_name);
        }
        if (ngo.profile_id && ngo.ngo_name) {
          ngoDirectory.set(ngo.profile_id, ngo.ngo_name);
        }
      }
    }
  } catch {}

  // 2. Fetch all reports from Supabase
  const dbReports = await loadNgoReports();

  // 3. Map to TrackingReport structure
  const trackingList: TrackingReport[] = [];

  for (const r of dbReports) {
    if (r.deleted || r.status === 'deleted') continue;

    const norm = normalizeReportStatus(r.status);
    let trackingStatus: TrackingStatus = 'unclaimed';
    if (norm === 'Submitted' || norm === 'Available Again') {
      trackingStatus = 'unclaimed';
    } else if (norm === 'Assigned') {
      trackingStatus = 'claimed';
    } else if (norm === 'In Progress' || norm === 'Resolving') {
      trackingStatus = 'in_progress';
    } else if (norm === 'Resolved') {
      trackingStatus = 'resolved';
    }

    const hasExact = Boolean(r.latitude && r.longitude && !isNaN(Number(r.latitude)) && !isNaN(Number(r.longitude)));
    const pseudo = getPseudoCoordinates(r.report_code || r.id);
    const lat = hasExact ? Number(r.latitude) : pseudo.latitude;
    const lng = hasExact ? Number(r.longitude) : pseudo.longitude;

    // Resolve assigned NGO name
    let assignedNgoName: string | null = null;
    if (r.assigned_ngo_id) {
      assignedNgoName =
        ngoDirectory.get(r.assigned_ngo_id) ||
        r.ngos?.ngo_name ||
        (r.assigned_ngo_id === 'ngo-current' ? 'Your NGO' : 'Partner NGO');
    }

    // Check if assigned to currently authenticated NGO
    const isCurrent = Boolean(
      currentNgoId &&
      (r.assigned_ngo_id === currentNgoId ||
        r.assigned_ngo_id === 'ngo-current' ||
        (assignedNgoName && assignedNgoName.toLowerCase().includes('green earth')))
    );

    const before = imageOf(r, 'before');
    const after = imageOf(r, 'after');

    trackingList.push({
      id: r.id,
      dbId: r.id,
      reportCode: r.report_code,
      title: r.title || r.waste_type,
      description: r.description || '',
      wasteType: r.waste_type,
      address: r.address || 'Reported Location',
      latitude: lat,
      longitude: lng,
      hasExactCoordinates: hasExact,
      status: norm,
      trackingStatus,
      statusBadgeClass: getStatusBadgeClass(norm),
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      assignedNgoId: r.assigned_ngo_id,
      assignedNgoName: assignedNgoName || (trackingStatus !== 'unclaimed' ? 'Partner NGO' : null),
      workingNgoName: assignedNgoName || (trackingStatus !== 'unclaimed' ? 'Partner NGO' : null),
      isAssignedToCurrentNgo: isCurrent,
      reporterName: r.profiles?.full_name || 'Citizen Reporter',
      photo: before,
      beforePhoto: before,
      afterPhoto: after,
      rawReport: r,
    });
  }

  // 4. Compute live statistics
  const stats: TrackingStatistics = {
    total: trackingList.length,
    unclaimed: trackingList.filter((r) => r.trackingStatus === 'unclaimed').length,
    claimed: trackingList.filter((r) => r.trackingStatus === 'claimed').length,
    inProgress: trackingList.filter((r) => r.trackingStatus === 'in_progress').length,
    resolved: trackingList.filter((r) => r.trackingStatus === 'resolved').length,
  };

  return {
    reports: trackingList,
    stats,
    ngoDirectory,
  };
}

/**
 * Concurrency-Safe NGO Claim Request
 * Ensures only ONE NGO can successfully claim an unclaimed request.
 */
export async function claimWasteReport(
  reportId: string,
  currentNgoId?: string,
  currentNgoName?: string
): Promise<{ success: boolean; message: string; reportCode?: string }> {
  // Check auth
  const { data: auth } = await supabase.auth.getUser();
  const currentUid = auth.user?.id;
  const ngoName = currentNgoName || 'Partner NGO';

  // 1. Try PostgreSQL Security Definer RPC first (with atomic FOR UPDATE lock)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('claim_waste_report', {
      p_report_id: reportId,
    });

    if (!rpcError && rpcData?.success) {
      await acceptReport(reportId, rpcData.ngo_name || ngoName, rpcData.ngo_id || currentNgoId || currentUid);
      return {
        success: true,
        message: 'Request successfully claimed by your NGO.',
        reportCode: rpcData.report_code,
      };
    } else if (rpcError) {
      if (rpcError.message.includes('already been claimed')) {
        throw new Error('This request has already been claimed by another NGO.');
      }
      if (rpcError.message.includes('already been resolved')) {
        throw new Error('This request has already been resolved and cannot be claimed.');
      }
      if (rpcError.message.includes('Permission denied')) {
        throw new Error('Permission denied: Only NGO accounts can claim cleanup requests.');
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('already been claimed') ||
        err.message.includes('already been resolved') ||
        err.message.includes('Permission denied'))
    ) {
      throw err;
    }
  }

  // 2. Fallback direct atomic check and accept
  const { data: checkReport } = await supabase
    .from('waste_reports')
    .select('id, report_code, status, assigned_ngo_id')
    .or(`id.eq.${reportId},report_code.eq.${reportId}`)
    .single();

  if (checkReport) {
    if (checkReport.status === 'resolved') {
      throw new Error('This request has already been resolved and cannot be claimed.');
    }
    if (
      checkReport.assigned_ngo_id &&
      checkReport.assigned_ngo_id !== currentNgoId &&
      checkReport.assigned_ngo_id !== currentUid
    ) {
      throw new Error('This request has already been claimed by another NGO.');
    }
    if (
      checkReport.status === 'assigned' ||
      checkReport.status === 'in_progress' ||
      checkReport.status === 'resolving'
    ) {
      if (
        checkReport.assigned_ngo_id &&
        checkReport.assigned_ngo_id !== currentNgoId &&
        checkReport.assigned_ngo_id !== currentUid
      ) {
        throw new Error('This request has already been claimed by another NGO.');
      }
    }
  }

  await acceptReport(reportId, ngoName, currentNgoId || currentUid || 'ngo-current');

  return {
    success: true,
    message: 'Request successfully claimed by your NGO.',
  };
}

