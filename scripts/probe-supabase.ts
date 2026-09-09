import { supabase } from '../src/utils/supabase';

const CANDIDATE_TABLES = [
  'profiles',
  'users',
  'user',
  'citizens',
  'citizen',
  'citizen_profiles',
  'citizens_profile',
  'user_profiles',
  'accounts',
  'members',
  'volunteers',
  'ngos',
  'ngo',
  'ngo_profiles',
  'organizations',
  'organization',
  'partners',
  'agencies',
  'waste_reports',
  'reports',
  'report',
  'cleanup_requests',
  'cleanups',
  'cleanup',
  'issues',
  'waste_issues',
  'requests',
  'request',
  'submissions',
  'waste',
  'waste_posts',
  'garbage_reports',
  'civic_reports',
  'civic_issues',
  'report_images',
  'images',
  'photos',
  'ngo_assignments',
  'assignments',
  'notifications',
  'stats',
  'platform_stats',
  'analytics',
  'metrics',
  'impact',
  'community_impact',
  'todos',
];

const CANDIDATE_RPCS = [
  'get_public_platform_stats',
  'get_platform_stats',
  'get_stats',
  'platform_stats',
  'get_counts',
  'get_community_stats',
  'get_impact_stats',
  'get_impact',
  'get_home_stats',
  'get_dashboard_stats',
  'get_all_stats',
  'fetch_stats',
  'claim_waste_report',
  'accept_nearby_report',
  'release_assigned_report',
  'update_assigned_report_status',
  'delete_account',
];

async function probeSupabase() {
  console.log('=== PROBING ALL TABLES IN SUPABASE ===\n');

  for (const table of CANDIDATE_TABLES) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (!error) {
        console.log(`✅ TABLE EXISTS: "${table}" | count: ${count} | rows returned: ${data?.length}`);
        if (data && data.length > 0) {
          console.log(`   Columns in "${table}":`, Object.keys(data[0]));
          console.log(`   Sample row 0:`, JSON.stringify(data[0]));
          if (data.length > 1) {
            console.log(`   Sample row 1:`, JSON.stringify(data[1]));
          }
        }
      } else if (error.code !== '42P01' && !error.message.includes('relation') && !error.message.includes('does not exist') && error.code !== 'PGRST204' && error.code !== 'PGRST205') {
        console.log(`⚠️ TABLE EXISTS (with error): "${table}" | code: ${error.code} | message: ${error.message}`);
      }
    } catch (e: any) {
      // ignore
    }
  }

  console.log('\n=== PROBING ALL RPCS IN SUPABASE ===\n');
  for (const rpc of CANDIDATE_RPCS) {
    try {
      const { data, error } = await supabase.rpc(rpc);
      if (!error) {
        console.log(`✅ RPC EXISTS: "${rpc}" -> result:`, JSON.stringify(data));
      } else if (error.code !== 'PGRST202' && !error.message.includes('schema cache')) {
        console.log(`⚠️ RPC EXISTS (with parameter/auth error): "${rpc}" | code: ${error.code} | message: ${error.message}`);
      }
    } catch (e: any) {
      // ignore
    }
  }
}

probeSupabase().catch(console.error);
