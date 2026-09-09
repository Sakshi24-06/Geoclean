import { supabase } from '../src/utils/supabase';

async function inspectAll() {
  console.log('=== DEEP DATABASE INSPECTION ===\n');

  // 1. Check RPC
  console.log('1. Checking get_public_platform_stats RPC:');
  const rpcRes = await supabase.rpc('get_public_platform_stats' as any);
  console.log('   RPC status:', rpcRes.error ? `Error: ${rpcRes.error.code} - ${rpcRes.error.message}` : 'EXISTS!', rpcRes.data);

  // 2. Check current_ngo_id RPC
  console.log('\n2. Checking current_ngo_id RPC:');
  const ngoIdRes = await supabase.rpc('current_ngo_id' as any);
  console.log('   current_ngo_id:', ngoIdRes.error ? ngoIdRes.error.message : 'SUCCESS', ngoIdRes.data);

  // 3. Check profiles table with different filters
  console.log('\n3. Checking profiles table:');
  const pAll = await supabase.from('profiles').select('*', { count: 'exact' });
  console.log('   Total profiles (unauthenticated): count =', pAll.count, 'rows =', pAll.data?.length, 'error =', pAll.error?.message);

  // 4. Check ngos table
  console.log('\n4. Checking ngos table:');
  const nAll = await supabase.from('ngos').select('*', { count: 'exact' });
  console.log('   Total ngos (unauthenticated): count =', nAll.count, 'rows =', nAll.data?.length, 'error =', nAll.error?.message);

  // 5. Check waste_reports table
  console.log('\n5. Checking waste_reports table:');
  const wAll = await supabase.from('waste_reports').select('*', { count: 'exact' });
  console.log('   Total waste_reports (unauthenticated): count =', wAll.count, 'rows =', wAll.data?.length, 'error =', wAll.error?.message);

  // 6. Check report_images
  console.log('\n6. Checking report_images table:');
  const imgAll = await supabase.from('report_images').select('*', { count: 'exact' });
  console.log('   Total report_images (unauthenticated): count =', imgAll.count, 'rows =', imgAll.data?.length, 'error =', imgAll.error?.message);

  // 7. Check ngo_assignments
  console.log('\n7. Checking ngo_assignments table:');
  const asgnAll = await supabase.from('ngo_assignments').select('*', { count: 'exact' });
  console.log('   Total ngo_assignments (unauthenticated): count =', asgnAll.count, 'rows =', asgnAll.data?.length, 'error =', asgnAll.error?.message);
}

inspectAll().catch(console.error);
