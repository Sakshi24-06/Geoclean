import { supabase } from '../src/utils/supabase';

async function inspect() {
  console.log('=====================================================');
  console.log('       INSPECTING SUPABASE DATABASE DATA             ');
  console.log('=====================================================\n');

  // 1. Check profiles
  console.log('1. Querying profiles table:');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) {
    console.error('Error querying profiles:', pErr);
  } else {
    console.log(`Found ${profiles?.length ?? 0} profiles:`);
    profiles?.forEach((p) => {
      console.log(` - ID: ${p.id}, Role: "${p.role}", Name: "${p.full_name}", Email: "${p.email}"`);
    });
  }

  // 2. Check ngos
  console.log('\n2. Querying ngos table:');
  const { data: ngos, error: nErr } = await supabase.from('ngos').select('*');
  if (nErr) {
    console.error('Error querying ngos:', nErr);
  } else {
    console.log(`Found ${ngos?.length ?? 0} NGOs:`);
    ngos?.forEach((n) => {
      console.log(` - ID: ${n.id}, Name: "${n.ngo_name}", ProfileID: "${n.profile_id}"`);
    });
  }

  // 3. Check waste_reports
  console.log('\n3. Querying waste_reports table:');
  const { data: reports, error: rErr } = await supabase.from('waste_reports').select('*');
  if (rErr) {
    console.error('Error querying waste_reports:', rErr);
  } else {
    console.log(`Found ${reports?.length ?? 0} reports:`);
    reports?.forEach((r) => {
      console.log(` - Code: ${r.report_code}, Status: "${r.status}", Deleted: ${r.deleted}, WasteType: "${r.waste_type}"`);
    });
  }

  // 4. Test RPC functions
  console.log('\n4. Testing RPC get_public_platform_stats:');
  const { data: rpc1, error: rpc1Err } = await supabase.rpc('get_public_platform_stats');
  console.log('get_public_platform_stats result:', { rpc1, rpc1Err });

  console.log('\n=====================================================');
}

inspect().catch(console.error);
