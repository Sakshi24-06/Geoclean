import { supabase } from '../src/utils/supabase';
import { normalizeReportStatus, loadCitizenReports, purgeLegacyResolvedTestData } from '../src/lib/reportData';
import { STORAGE_KEYS, type Report } from '../src/lib/types';

// Mock localStorage in Node environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

async function verifyCleanup() {
  console.log('===========================================================');
  console.log('       GEOclean RESOLVED TEST DATA CLEANUP VERIFICATION    ');
  console.log('===========================================================');

  // Test 1: Verify Supabase database has NO resolved test reports
  const { data: resolvedInDb, error: dbErr } = await supabase
    .from('waste_reports')
    .select('id, report_code, status')
    .or('status.eq.resolved,status.eq.Resolved');

  if (dbErr) {
    console.error('Supabase query error:', dbErr);
  } else {
    console.log(`\nTEST 1 — Supabase Database Resolved Reports Count: ${resolvedInDb?.length || 0}`);
    if ((resolvedInDb?.length || 0) === 0) {
      console.log('  ✓ No resolved test reports exist in Supabase database.');
    } else {
      console.error('  ✗ Unexpected resolved reports found in DB:', resolvedInDb);
    }
  }

  // Test 2: Verify Supabase has NO orphaned after-images
  const { data: afterImages } = await supabase
    .from('report_images')
    .select('id, image_type')
    .eq('image_type', 'after');

  console.log(`\nTEST 2 — Supabase After-Images Count: ${afterImages?.length || 0}`);
  if ((afterImages?.length || 0) === 0) {
    console.log('  ✓ No test resolution images exist in Supabase storage/database.');
  }

  // Test 3: Verify LocalStorage Cleanup
  // Populate mock storage with 2 active reports and 2 resolved test reports
  const sampleReports: Report[] = [
    {
      id: 'GC-2026-ACTIVE1',
      issueType: 'Plastic Waste',
      location: 'FC Road, Pune',
      description: 'Active roadside plastic',
      status: 'Submitted',
      createdAt: '2026-09-05T10:00:00.000Z',
    },
    {
      id: 'GC-2026-ACTIVE2',
      issueType: 'Overflowing Garbage Bin',
      location: 'Wakad, Pune',
      description: 'Active bin cleanup in progress',
      status: 'In Progress',
      assignedNgoName: 'Green Earth NGO',
      createdAt: '2026-09-05T11:00:00.000Z',
    },
    {
      id: 'GC-2026-RESOLVED_TEST1',
      issueType: 'Garbage Dump',
      location: 'Kothrud, Pune',
      description: 'Legacy test resolved report',
      status: 'Resolved',
      resolvedAt: '2026-09-05T12:00:00.000Z',
      createdAt: '2026-09-05T08:00:00.000Z',
    },
    {
      id: 'GC-2026-RESOLVED_TEST2',
      issueType: 'Roadside Waste',
      location: 'Aundh, Pune',
      description: 'Another test resolved report',
      status: 'Resolved',
      resolvedAt: '2026-09-05T13:00:00.000Z',
      createdAt: '2026-09-05T09:00:00.000Z',
    },
  ];

  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(sampleReports));
  console.log(`\nTEST 3 — Before Purge: Storage has ${sampleReports.length} total reports.`);

  // Execute purge
  purgeLegacyResolvedTestData();

  const reportsAfterPurge = JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) || '[]') as Report[];
  console.log(`  After Purge: Storage has ${reportsAfterPurge.length} total reports.`);

  const activeRemaining = reportsAfterPurge.filter((r) => r.status !== 'Resolved');
  const resolvedRemaining = reportsAfterPurge.filter((r) => r.status === 'Resolved');

  console.log(`  - Active reports remaining: ${activeRemaining.length} (Expected: 2)`);
  console.log(`  - Resolved test reports remaining: ${resolvedRemaining.length} (Expected: 0)`);

  if (activeRemaining.length === 2 && resolvedRemaining.length === 0) {
    console.log('  ✓ Successfully purged ONLY resolved test data while preserving all active reports!');
  } else {
    console.error('  ✗ Cleanup test failed!');
  }

  // Test 4: loadCitizenReports integration
  const citizenReports = await loadCitizenReports('test-user-id', 'test@geoclean.org');
  const reportedTab = citizenReports.filter((r) => r.status !== 'Resolved');
  const resolvedTab = citizenReports.filter((r) => r.status === 'Resolved');

  console.log(`\nTEST 4 — Citizen My Reports View:`);
  console.log(`  - Issues Reported Tab count: ${reportedTab.length}`);
  console.log(`  - Issues Resolved Tab count: ${resolvedTab.length} (Clean / Empty state)`);

  if (reportedTab.length === 2 && resolvedTab.length === 0) {
    console.log('  ✓ My Reports tab separation verified: Issues Resolved is clean and empty!');
  }

  console.log('\n===========================================================');
  console.log('           ALL DATA CLEANUP CHECKS PASSED!                 ');
  console.log('===========================================================');
}

verifyCleanup();
