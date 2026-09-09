import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('====================================================');
console.log('   GeoClean NGO Navbar Verification Tests           ');
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

// 1. Check DashboardLayout.tsx for NGO nav items
const dashboardLayoutContent = readFileSync(
  resolve('src/components/DashboardLayout.tsx'),
  'utf-8'
);

// Check that ngoNav does NOT contain 'NGO Profile'
const ngoNavMatch = dashboardLayoutContent.match(/const ngoNav:\s*NavItem\[\]\s*=\s*\[([\s\S]*?)\];/);
const ngoNavBlock = ngoNavMatch ? ngoNavMatch[1] : '';

check(
  'TEST 1: ngoNav block exists',
  Boolean(ngoNavMatch),
  'ngoNav definition found'
);

check(
  'TEST 2: "NGO Profile" removed from ngoNav',
  !ngoNavBlock.includes('NGO Profile') && !ngoNavBlock.includes('/ngo/profile'),
  'No "NGO Profile" text or link in main navbar array'
);

check(
  'TEST 3: Dashboard, Impact, NGO Directory preserved in ngoNav',
  ngoNavBlock.includes('/ngo') && ngoNavBlock.includes('/impact') && ngoNavBlock.includes('/ngos'),
  'Main navbar has only Dashboard, Impact, NGO Directory'
);

// Check that Profile Avatar Dropdown still links to /ngo/profile for NGO role
check(
  'TEST 4: Profile menu links to /ngo/profile for NGO',
  dashboardLayoutContent.includes("user?.role === 'ngo' ? '/ngo/profile' : '/profile'"),
  'Profile icon dropdown navigates to /ngo/profile for NGO users'
);

// Check that citizenNav and adminNav are intact
const citizenNavMatch = dashboardLayoutContent.match(/const citizenNav:\s*NavItem\[\]\s*=\s*\[([\s\S]*?)\];/);
const citizenNavBlock = citizenNavMatch ? citizenNavMatch[1] : '';
check(
  'TEST 5: Citizen navigation intact',
  citizenNavBlock.includes('/user') && citizenNavBlock.includes('/my-reports') && citizenNavBlock.includes('/how-it-works'),
  'Citizen navigation options are unchanged'
);

// Check that App.tsx route /ngo/profile is intact
const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');
check(
  'TEST 6: /ngo/profile Route remains in App.tsx',
  appContent.includes('path="/ngo/profile"') && appContent.includes('NgoProfilePage'),
  'NGO Profile page route is active and protected'
);

console.log('\n====================================================');
if (allPassed) {
  console.log('  All 6 Navbar & Route Verification Checks Passed!  ');
} else {
  console.log('  Some checks failed. Please inspect errors above.  ');
}
console.log('====================================================\n');
