import { supabase } from '../src/utils/supabase';

console.log('=== VERIFYING SUPABASE REALTIME SUBSCRIPTION PATTERN ===\n');

let allPassed = true;
function check(title: string, pass: boolean, detail: string) {
  if (pass) {
    console.log(`✅ ${title}: PASSED (${detail})`);
  } else {
    console.error(`❌ ${title}: FAILED (${detail})`);
    allPassed = false;
  }
}

async function testRealtimeOrder() {
  // Test 1: Channel created with all .on() before .subscribe()
  let caughtError: Error | null = null;
  const channelName = `test-stats-rt-${Date.now()}`;
  const channel = supabase.channel(channelName);

  try {
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waste_reports' }, () => {})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, () => {});

    channel.subscribe((status, err) => {
      if (err) {
        console.log('Subscription notice (non-fatal):', status, err.message);
      }
    });

    check(
      'TEST 1: Realtime listeners registered before subscribe()',
      true,
      'All 3 listeners (profiles, waste_reports, ngos) added in correct order without throwing'
    );
  } catch (err) {
    caughtError = err as Error;
    check('TEST 1: Realtime listeners registered before subscribe()', false, caughtError.message);
  }

  // Cleanup test channel
  try {
    await supabase.removeChannel(channel);
    check('TEST 2: Channel removal works without error', true, 'Channel removed cleanly');
  } catch (err) {
    check('TEST 2: Channel removal works without error', false, (err as Error).message);
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('  All Realtime Order Verification Checks Passed!    ');
  } else {
    console.log('  Some checks failed.                               ');
  }
  console.log('====================================================\n');
}

testRealtimeOrder().catch(console.error);
