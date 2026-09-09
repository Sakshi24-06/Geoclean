import {
  formatRelativeTime,
  groupNoticesBySection,
  getIconForNotificationType,
  mapDbNotificationToNotice,
  type DbNotificationRow,
} from '../src/lib/notificationService';
import { normalizeReportStatus, statusLabel, STATUS_FLOW } from '../src/lib/reportData';
import type { Notice, NotificationType } from '../src/lib/types';

function runNotificationTests() {
  console.log('=== RUNNING NOTIFICATION SYSTEM UNIT TESTS ===\n');

  // Test 1: Icon mapping
  const types: NotificationType[] = [
    'REPORT_SUBMITTED',
    'REPORT_ASSIGNED',
    'REPORT_IN_PROGRESS',
    'REPORT_RESOLVING',
    'REPORT_RESOLVED',
    'REPORT_DELETED',
    'COMMUNITY_UPDATE',
  ];

  console.log('Test 1: Icon mapping for all 7 types:');
  for (const t of types) {
    const icon = getIconForNotificationType(t);
    console.log(`  ${t} => icon: ${icon}`);
    if (!icon) throw new Error(`Missing icon for ${t}`);
  }

  // Test 2: Status normalization & single source of truth
  console.log('\nTest 2: Status normalization across variations:');
  console.log('  "pending" =>', normalizeReportStatus('pending'), '(Label:', statusLabel('pending') + ')');
  console.log('  "submitted" =>', normalizeReportStatus('submitted'), '(Label:', statusLabel('submitted') + ')');
  console.log('  "assigned" =>', normalizeReportStatus('assigned'), '(Label:', statusLabel('assigned') + ')');
  console.log('  "in_progress" =>', normalizeReportStatus('in_progress'), '(Label:', statusLabel('in_progress') + ')');
  console.log('  "resolving" =>', normalizeReportStatus('resolving'), '(Label:', statusLabel('resolving') + ')');
  console.log('  "resolved" =>', normalizeReportStatus('resolved'), '(Label:', statusLabel('resolved') + ')');
  if (normalizeReportStatus('resolving') !== 'Resolving') throw new Error('Resolving status normalization failed');
  if (normalizeReportStatus('in_progress') !== 'In Progress') throw new Error('In Progress status normalization failed');

  // Test 3: Relative time formatting
  console.log('\nTest 3: Relative time formatting:');
  const now = new Date();
  const justNow = formatRelativeTime(now.toISOString());
  const tenMinAgo = formatRelativeTime(new Date(now.getTime() - 10 * 60 * 1000).toISOString());
  const twoHoursAgo = formatRelativeTime(new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString());
  const yesterday = formatRelativeTime(new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString());
  console.log('  0s ago =>', justNow);
  console.log('  10m ago =>', tenMinAgo);
  console.log('  2h ago =>', twoHoursAgo);
  console.log('  26h ago =>', yesterday);

  // Test 4: Notification row mapping
  console.log('\nTest 4: Database row to Notice mapping:');
  const dbRow: DbNotificationRow = {
    id: 'notif-1',
    user_id: 'usr-123',
    report_id: 'rep-456',
    report_code: 'GC-2026-001248',
    title: 'Report Submitted',
    message: 'Your garbage report near Wakad has been received.',
    type: 'REPORT_SUBMITTED',
    read: false,
    created_at: now.toISOString(),
    metadata: {
      location: 'Wakad, Pune',
      wasteType: 'Garbage Dump',
    },
  };
  const notice = mapDbNotificationToNotice(dbRow);
  console.log('  Mapped notice:', {
    id: notice.id,
    title: notice.title,
    detail: notice.detail,
    type: notice.type,
    icon: notice.icon,
    reportCode: notice.reportCode,
    read: notice.read,
  });

  if (notice.reportCode !== 'GC-2026-001248' || notice.type !== 'REPORT_SUBMITTED') {
    throw new Error('Notice mapping validation failed');
  }

  // Test 5: Time Grouping
  console.log('\nTest 5: Section Grouping (TODAY, YESTERDAY, EARLIER):');
  const sampleNotices: Notice[] = [
    {
      id: '1',
      title: 'Submitted today',
      detail: 'Detail 1',
      time: '10 min ago',
      createdAt: now.toISOString(),
      read: false,
      icon: 'check',
      type: 'REPORT_SUBMITTED',
    },
    {
      id: '2',
      title: 'Assigned yesterday',
      detail: 'Detail 2',
      time: 'Yesterday',
      createdAt: new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(),
      read: true,
      icon: 'truck',
      type: 'REPORT_ASSIGNED',
    },
    {
      id: '3',
      title: 'Welcome community earlier',
      detail: 'Detail 3',
      time: '3 days ago',
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
      read: true,
      icon: 'leaf',
      type: 'COMMUNITY_UPDATE',
    },
  ];

  const grouped = groupNoticesBySection(sampleNotices);
  console.log('  Today count:', grouped.today.length, '(expected 1)');
  console.log('  Yesterday count:', grouped.yesterday.length, '(expected 1)');
  console.log('  Earlier count:', grouped.earlier.length, '(expected 1)');

  if (grouped.today.length !== 1 || grouped.yesterday.length !== 1 || grouped.earlier.length !== 1) {
    throw new Error('Section grouping failed');
  }

  console.log('\n=== ALL NOTIFICATION SYSTEM UNIT TESTS PASSED ===');
}

runNotificationTests();
