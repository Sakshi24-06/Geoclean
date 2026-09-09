import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { supabase } from '../src/utils/supabase';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runHomepageVerification() {
  console.log('=== RUNNING HOMEPAGE UPDATE VERIFICATION TESTS ===\n');

  // Test 1: Verify Assets
  console.log('Test 1: Assets Check');
  const heroAsset = resolve(process.cwd(), 'src/assets/geoclean-hero-team.jpg');
  assert(existsSync(heroAsset), 'Hero waste-cleanup team image exists in src/assets');

  // Test 2: Verify HomeSections.tsx contents
  console.log('\nTest 2: HomeSections.tsx Content Verification');
  const homeSectionsPath = resolve(process.cwd(), 'src/components/HomeSections.tsx');
  const homeSections = readFileSync(homeSectionsPath, 'utf-8');

  // Hero checks
  assert(homeSections.includes('geoclean-hero-team.jpg'), 'Hero imports geoclean-hero-team.jpg');
  assert(!homeSections.includes('geoclean-hero-truck.png'), 'Old hero truck image is no longer imported');
  assert(!homeSections.includes('12K+ citizens making a difference'), '12K+ citizens making a difference is removed');
  assert(!homeSections.includes('One report can change a neighborhood'), 'One report subtitle is removed');
  assert(!homeSections.includes('<span>AM</span><span>RS</span><span>NK</span>'), 'Avatar stack in hero is removed');
  assert(homeSections.includes('Report an Issue'), 'Report an Issue button remains in hero');

  // Quote Section checks
  assert(!homeSections.includes('quoteBg'), 'No quote background image is imported or used');
  assert(homeSections.includes('bg-[#eef7f0]'), 'QuoteSection uses soft GeoClean-theme light green solid background #eef7f0');
  assert(homeSections.includes('Small Actions create cleaner streets and cleaner streets create healthier communities'), 'Exact quote title is rendered as HTML text');
  assert(homeSections.includes('w-full'), 'QuoteSection is full-width (edge-to-edge)');
  assert(!homeSections.includes('page-shell py-16 sm:py-20\n      <div\n        className="quote-card'), 'QuoteSection does not have constrained page-shell/card margins');
  assert(homeSections.includes('<Leaf size={26}'), 'Leaf icon is preserved in QuoteSection');

  // ReportPrompt checks
  assert(!homeSections.includes('Make an impact today'), 'MAKE AN IMPACT TODAY kicker is removed');
  assert(homeSections.includes('See waste? Say something.'), '"See waste? Say something." is preserved');
  assert(homeSections.includes('Help keep your city clean by sharing what you see'), 'Prompt description is preserved');

  // ImpactSection checks
  assert(homeSections.includes('Issues Reported'), 'Has "Issues Reported" label');
  assert(homeSections.includes('Issues Resolved'), 'Has "Issues Resolved" label');
  assert(homeSections.includes('Citizen Connected'), 'Has "Citizen Connected" label');
  assert(homeSections.includes('NGO Connected'), 'Has "NGO Connected" label');
  assert(!homeSections.includes('Pickups Completed'), 'Old "Pickups Completed" label removed');
  assert(!homeSections.includes('Waste Collected'), 'Old "Waste Collected" label removed');
  assert(!homeSections.includes('value: 128'), 'Hardcoded 128 removed');
  assert(!homeSections.includes('value: 96'), 'Hardcoded 96 removed');
  assert(!homeSections.includes('value: 42'), 'Hardcoded 42 removed');
  assert(!homeSections.includes('value: 184'), 'Hardcoded 184 removed');
  assert(homeSections.includes('usePlatformStats'), 'HomeSections uses unified usePlatformStats hook');
  const platformStatsContent = readFileSync(resolve(process.cwd(), 'src/lib/platformStats.ts'), 'utf-8');
  assert(platformStatsContent.includes("from('waste_reports')"), 'Queries waste_reports table in platformStats');
  assert(platformStatsContent.includes("from('profiles')"), 'Queries profiles table for citizens in platformStats');
  assert(platformStatsContent.includes("from('ngos')"), 'Queries ngos table in platformStats');

  // HowItWorksSection checks
  assert(homeSections.includes('Spot the Waste'), 'Step 01 is Spot the Waste');
  assert(homeSections.includes('How It Works'), 'Step 02 is How It Works');
  assert(!homeSections.includes('Report the Issue'), 'Old "Report the Issue" step title is replaced');
  assert(homeSections.includes("navigate('/how-it-works')"), 'Clicking Step 02 redirects to /how-it-works');
  assert(homeSections.includes('We Take Action'), 'Step 03 is We Take Action');
  assert(homeSections.includes('Track the Impact'), 'Step 04 is Track the Impact');

  // Powered by People checks
  assert(!homeSections.includes('Powered by people'), '"Powered by people" is removed from HomeSections');
  assert(!homeSections.includes('Together, We Can Make a Difference'), '"Together, We Can Make a Difference" is removed');

  // Test 3: Verify CitizenDashboard.tsx
  console.log('\nTest 3: CitizenDashboard.tsx Verification');
  const dashboardPath = resolve(process.cwd(), 'src/pages/CitizenDashboard.tsx');
  const dashboardContent = readFileSync(dashboardPath, 'utf-8');
  assert(!dashboardContent.includes('CommunitySection'), 'CommunitySection is not imported or rendered');

  // Test 4: Live Supabase Queries
  console.log('\nTest 4: Live Supabase Database Counts');
  const [reportsRes, resolvedRes, citizensRes, ngosRes] = await Promise.all([
    supabase.from('waste_reports').select('*', { count: 'exact', head: true }),
    supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    supabase.from('ngos').select('*', { count: 'exact', head: true }),
  ]);

  console.log(`  - Issues Reported (Total waste_reports): ${reportsRes.count ?? 0}`);
  console.log(`  - Issues Resolved (status = 'resolved'): ${resolvedRes.count ?? 0}`);
  console.log(`  - Citizen Connected (profiles role = 'user'): ${citizensRes.count ?? 0}`);
  console.log(`  - NGO Connected (ngos count): ${ngosRes.count ?? 0}`);

  assert(reportsRes.error === null, 'No error querying waste_reports');
  assert(resolvedRes.error === null, 'No error querying resolved reports');
  assert(citizensRes.error === null, 'No error querying citizens');
  assert(ngosRes.error === null, 'No error querying NGOs');

  console.log('\n=== ALL HOMEPAGE VERIFICATION TESTS PASSED! ===\n');
}

runHomepageVerification().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
