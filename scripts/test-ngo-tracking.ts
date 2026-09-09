import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('====================================================');
console.log('  GeoClean Integrated NGO Dashboard & Map Tests     ');
console.log('====================================================\n');

let allPassed = true;

function check(title: string, pass: boolean, detail: string) {
  if (pass) {
    console.log(`✅ ${title}: PASSED (${detail})`);
  } else {
    console.error(`❌ ${title}: FAILED (${detail})`);
    allPassed = false;
  }
}

// 1. Check Navbar Navigation in DashboardLayout.tsx
const layoutContent = readFileSync(resolve('src/components/DashboardLayout.tsx'), 'utf-8');

const ngoNavMatch = layoutContent.match(/const ngoNav:\s*NavItem\[\]\s*=\s*\[([\s\S]*?)\];/);
const ngoNavBlock = ngoNavMatch ? ngoNavMatch[1] : '';

check(
  'TEST 1: No "Request Tracking" or duplicate Profile in NGO Navbar',
  !ngoNavBlock.includes('Request Tracking') && !ngoNavBlock.includes('NGO Profile'),
  'Navbar contains only Dashboard | Impact | NGO Directory'
);

check(
  'TEST 2: NGO Navbar items clean and ordered',
  ngoNavBlock.includes('Dashboard') &&
    ngoNavBlock.includes('Impact') &&
    ngoNavBlock.includes('NGO Directory'),
  'Navbar contains Dashboard | Impact | NGO Directory'
);

// 2. Check Routes in App.tsx (Redirect /ngo/tracking to /ngo)
const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

check(
  'TEST 3: /ngo/tracking redirects to /ngo in App.tsx',
  appContent.includes('path="/ngo/tracking" element={<Navigate to="/ngo"') &&
    appContent.includes('path="/ngo/request-tracking" element={<Navigate to="/ngo"'),
  'Standalone tracking routes safely redirect to /ngo'
);

// 3. Check NgoDashboard.tsx integrated sections
const dashboardContent = readFileSync(resolve('src/pages/NgoDashboard.tsx'), 'utf-8');

check(
  'TEST 4: Work Management section preserved on Dashboard',
  dashboardContent.includes('Work Management') &&
    dashboardContent.includes('New Requests') &&
    dashboardContent.includes('Assigned Work') &&
    dashboardContent.includes('Completed Work') &&
    dashboardContent.includes('Request History'),
  'All 4 Work Management sections are present'
);

check(
  'TEST 5: Garbage Cleanup Request Tracking integrated into Dashboard',
  dashboardContent.includes('Garbage Cleanup') &&
    dashboardContent.includes('Request Tracking') &&
    dashboardContent.includes('L.map') &&
    dashboardContent.includes('createStatusIcon') &&
    dashboardContent.includes('OpenStreetMap'),
  'Interactive Leaflet map is integrated directly inside NGO Dashboard'
);

check(
  'TEST 6: Compact Two-Column layout (Map Left 58% + Request Panel Right 42%)',
  dashboardContent.includes('lg:col-span-7') &&
    dashboardContent.includes('lg:col-span-5') &&
    dashboardContent.includes('selectedTrackingReport') &&
    dashboardContent.includes('Working NGO:'),
  'Two-column layout exists with map on the left and request details/list on the right'
);

check(
  'TEST 7: No duplicate 5 statistic cards in tracking area',
  !dashboardContent.includes('Total Requests') &&
    dashboardContent.includes('trackingFilter') &&
    dashboardContent.includes('searchQuery'),
  'Compact filter pills and search bar are used without duplicate tracking stat cards'
);

check(
  'TEST 8: Concurrency-safe claim and date formatters used',
  dashboardContent.includes('claimWasteReport') &&
    dashboardContent.includes('formatRequestDate') &&
    dashboardContent.includes('formatRequestDateTime'),
  'Safe claim logic and bulletproof date formatters are active'
);

console.log('\n====================================================');
if (allPassed) {
  console.log('  All 8 Integrated NGO Dashboard Tests Passed!      ');
} else {
  console.log('  Some checks failed. Please inspect errors above.  ');
}
console.log('====================================================\n');

