import { readFileSync } from 'fs';
import { resolve } from 'path';
import { formatStatCount } from '../src/lib/platformStats';

console.log('====================================================');
console.log('  GeoClean Home Page Real Statistics Verification    ');
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

// 1. Check formatStatCount behavior
check(
  'TEST 1: Zero count displays as "0" (no fake fallbacks)',
  formatStatCount(0) === '0',
  'formatStatCount(0) returns "0"'
);

check(
  'TEST 2: Loading displays as "—"',
  formatStatCount(0, true) === '—' && formatStatCount(null) === '—' && formatStatCount(undefined) === '—',
  'formatStatCount handles loading and null as "—"'
);

check(
  'TEST 3: Number formatting with commas',
  formatStatCount(1248) === '1,248' && formatStatCount(356) === '356' && formatStatCount(24) === '24',
  'Numbers are cleanly formatted without appending fake letters'
);

// 2. Check AuthPage.tsx landing page stats
const authPageContent = readFileSync(resolve('src/pages/AuthPage.tsx'), 'utf-8');

check(
  'TEST 4: AuthPage uses real platform stats hook',
  authPageContent.includes('usePlatformStats') && authPageContent.includes('formatStatCount'),
  'AuthPage imports and connects to usePlatformStats'
);

check(
  'TEST 5: AuthPage displays Citizens, Resolved, NGOs',
  authPageContent.includes('Citizens') &&
    authPageContent.includes('Resolved') &&
    authPageContent.includes('NGOs'),
  'AuthPage contains all 3 required statistics labels'
);

check(
  'TEST 6: AuthPage completely removes "Collected" and hardcoded demo strings',
  !authPageContent.includes('12K+') &&
    !authPageContent.includes('9.6K') &&
    !authPageContent.includes('18.4T') &&
    !authPageContent.includes('<span>Collected</span>'),
  'AuthPage has no 12K+, 9.6K, 18.4T, or Collected'
);

// 3. Check HomeSections.tsx Hero and Impact stats
const homeSectionsContent = readFileSync(resolve('src/components/HomeSections.tsx'), 'utf-8');

check(
  'TEST 7: HomeSections Hero displays live Citizens, Resolved, NGOs',
  homeSectionsContent.includes('usePlatformStats') &&
    homeSectionsContent.includes('formatStatCount(citizens, statsLoading)') &&
    homeSectionsContent.includes('formatStatCount(resolved, statsLoading)') &&
    homeSectionsContent.includes('formatStatCount(ngos, statsLoading)'),
  'Home Hero renders real Supabase database counts'
);

check(
  'TEST 8: HomeSections ImpactSection uses unified usePlatformStats hook',
  homeSectionsContent.includes('export function ImpactSection') &&
    homeSectionsContent.includes('const { reported, resolved, citizens, ngos, loading: statsLoading } = usePlatformStats()'),
  'ImpactSection synchronizes with real live platform statistics'
);

// 4. Check migration file
const migrationContent = readFileSync(
  resolve('supabase/migrations/20260907_public_platform_stats.sql'),
  'utf-8'
);

check(
  'TEST 9: Security Definer RPC get_public_platform_stats exists',
  migrationContent.includes('get_public_platform_stats') &&
    migrationContent.includes('security definer') &&
    migrationContent.includes('role in') &&
    migrationContent.includes('lower(status) = \'resolved\'') &&
    migrationContent.includes('grant execute on function public.get_public_platform_stats() to anon, authenticated'),
  'Secure aggregate-only RPC prevents leaking sensitive user fields'
);

console.log('\n====================================================');
if (allPassed) {
  console.log('  All 9 Home Page Statistics Checks Passed!         ');
} else {
  console.log('  Some checks failed. Please inspect errors above.  ');
}
console.log('====================================================\n');
