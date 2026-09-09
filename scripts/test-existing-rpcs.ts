import { supabase } from '../src/utils/supabase';

async function testRPCs() {
  const rpcs = [
    'get_public_platform_stats',
    'get_platform_stats',
    'accept_nearby_report',
    'release_assigned_report',
    'update_assigned_report_status',
    'claim_waste_report',
    'delete_user_account',
    'delete_ngo_cleanup_result',
    'is_nearby_report',
    'current_ngo_id',
  ];

  for (const name of rpcs) {
    const res = await supabase.rpc(name as any);
    console.log(`RPC [${name}]:`, res.error ? res.error.message : 'EXISTS / SUCCESS', res.data);
  }
}

testRPCs().catch(console.error);
