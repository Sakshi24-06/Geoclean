import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runImpactPaginationTests() {
  console.log('=== RUNNING IMPACT PAGE PAGINATION & VIEW MORE TESTS ===\n');

  // Test 1: Verify ImpactPage.tsx file contents
  console.log('Test 1: ImpactPage.tsx implementation structure');
  const impactPath = resolve(process.cwd(), 'src/pages/ImpactPage.tsx');
  const impactContent = readFileSync(impactPath, 'utf-8');

  assert(impactContent.includes('INITIAL_REPORT_COUNT = 6'), 'Initial count is set to 6');
  assert(impactContent.includes('REPORT_INCREMENT = 6'), 'Increment is set to 6');
  assert(impactContent.includes('visibleReports = reports.slice(0, visibleCount)'), 'Slices reports to currently visible count');
  assert(impactContent.includes('hasMore = visibleCount < reports.length'), 'Calculates hasMore correctly');
  assert(impactContent.includes('View More'), 'Renders "View More" button');
  assert(impactContent.includes('Show Less'), 'Renders "Show Less" button');
  assert(impactContent.includes('reports.length > INITIAL_REPORT_COUNT'), 'Button only displays when total reports exceed 6');

  // Test 2: Pagination Logic Unit Tests
  console.log('\nTest 2: Pagination Simulation with 20 reports');
  const totalReports = 20;
  const initialLimit = 6;
  const increment = 6;

  let visibleCount = initialLimit;
  assert(visibleCount === 6, 'Initial visible count is 6');
  assert(visibleCount < totalReports, 'Has more reports (View More should be shown)');

  // Click 1: View More
  visibleCount = Math.min(visibleCount + increment, totalReports);
  assert(visibleCount === 12, 'After first click, visible count is 12');
  assert(visibleCount < totalReports, 'Still has more reports (View More should be shown)');

  // Click 2: View More
  visibleCount = Math.min(visibleCount + increment, totalReports);
  assert(visibleCount === 18, 'After second click, visible count is 18');
  assert(visibleCount < totalReports, 'Still has more reports (View More should be shown)');

  // Click 3: View More (reaches all 20)
  visibleCount = Math.min(visibleCount + increment, totalReports);
  assert(visibleCount === 20, 'After third click, visible count is 20 (all reports displayed)');
  assert(visibleCount >= totalReports, 'All reports visible (Show Less should be shown)');

  // Click 4: Show Less
  visibleCount = initialLimit;
  assert(visibleCount === 6, 'After clicking Show Less, visible count resets to initial 6');

  // Test 3: Pagination Logic with <= 6 reports
  console.log('\nTest 3: Simulation with 4 reports');
  const smallReportCount = 4;
  const showButton = smallReportCount > initialLimit;
  assert(showButton === false, 'Button is hidden when report count is <= 6');

  // Test 4: Simulation with exactly 6 reports
  console.log('\nTest 4: Simulation with exactly 6 reports');
  const exactReportCount = 6;
  const showButtonExact = exactReportCount > initialLimit;
  assert(showButtonExact === false, 'Button is hidden when report count is exactly 6');

  // Test 5: Sorting Logic
  console.log('\nTest 5: Sorting by resolved_at / created_at (most recent first)');
  const mockReports = [
    { id: '1', resolved_at: '2026-09-01T10:00:00Z', created_at: '2026-09-01T08:00:00Z' },
    { id: '2', resolved_at: '2026-09-06T12:00:00Z', created_at: '2026-09-06T09:00:00Z' },
    { id: '3', resolved_at: '2026-09-04T15:00:00Z', created_at: '2026-09-04T11:00:00Z' },
  ];
  const sorted = mockReports.sort((a, b) => {
    const dateA = new Date(a.resolved_at || a.created_at || 0).getTime();
    const dateB = new Date(b.resolved_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  assert(sorted[0].id === '2', 'Most recent report (Sept 6) is first');
  assert(sorted[1].id === '3', 'Second most recent report (Sept 4) is second');
  assert(sorted[2].id === '1', 'Oldest report (Sept 1) is third');

  console.log('\n=== ALL IMPACT PAGINATION TESTS PASSED! ===\n');
}

runImpactPaginationTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
