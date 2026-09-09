import { supabase } from '../src/utils/supabase';

async function investigate() {
  console.log('=== INVESTIGATING SUPABASE STATS & TABLES ===\n');

  // 1. Try public.get_public_platform_stats RPC
  console.log('1. Checking get_public_platform_stats RPC:');
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_platform_stats');
  if (rpcError) {
    console.log('   ❌ RPC failed:', rpcError.code, rpcError.message);
  } else {
    console.log('   ✅ RPC result:', JSON.stringify(rpcData));
  }

  // 2. Query profiles
  console.log('\n2. Querying profiles table:');
  const { data: profiles, error: profError, count: profCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });
  if (profError) {
    console.log('   ❌ profiles error:', profError.code, profError.message);
  } else {
    console.log(`   ✅ profiles count: ${profCount}, rows: ${profiles?.length}`);
    profiles?.forEach(p => console.log('      - Profile:', p.id, p.full_name, p.email, p.role));
  }

  // 3. Query ngos
  console.log('\n3. Querying ngos table:');
  const { data: ngos, error: ngoError, count: ngoCount } = await supabase
    .from('ngos')
    .select('*', { count: 'exact' });
  if (ngoError) {
    console.log('   ❌ ngos error:', ngoError.code, ngoError.message);
  } else {
    console.log(`   ✅ ngos count: ${ngoCount}, rows: ${ngos?.length}`);
    ngos?.forEach(n => console.log('      - NGO:', n.id, n.ngo_name, n.profile_id));
  }

  // 4. Query waste_reports
  console.log('\n4. Querying waste_reports table:');
  const { data: reports, error: repError, count: repCount } = await supabase
    .from('waste_reports')
    .select('*', { count: 'exact' });
  if (repError) {
    console.log('   ❌ waste_reports error:', repError.code, repError.message);
  } else {
    console.log(`   ✅ waste_reports count: ${repCount}, rows: ${reports?.length}`);
    reports?.forEach(r => console.log('      - Report:', r.id, r.report_code, r.status, r.waste_type));
  }

  // 5. Query resolved waste_reports
  console.log('\n5. Querying resolved waste_reports:');
  const { data: resolved, error: resError, count: resCount } = await supabase
    .from('waste_reports')
    .select('*', { count: 'exact' })
    .eq('status', 'resolved');
  if (resError) {
    console.log('   ❌ resolved waste_reports error:', resError.code, resError.message);
  } else {
    console.log(`   ✅ resolved count: ${resCount}, rows: ${resolved?.length}`);
  }
}

investigate().catch(console.error);
