import { supabase } from '../src/utils/supabase';

async function testFlow() {
  console.log('=== TESTING REGISTRATION, REPORTING, RESOLVING & QUERYING ===\n');

  const ts = Date.now();
  const citizenEmail = `citizen_${ts}@testgeoclean.org`;
  const ngoEmail = `ngo_${ts}@testgeoclean.org`;
  const password = 'TestPassword123!';

  // 1. Sign up Citizen
  console.log('1. Signing up Citizen:', citizenEmail);
  const { data: citAuth, error: citErr } = await supabase.auth.signUp({
    email: citizenEmail,
    password,
    options: {
      data: {
        full_name: 'Aarav Patel',
        mobile_number: '+919876543210',
        role: 'user',
      },
    },
  });

  if (citErr) {
    console.error('❌ Citizen signup error:', citErr.message);
  } else {
    console.log('✅ Citizen user created:', citAuth.user?.id);
    // Explicit profile upsert if needed
    if (citAuth.user) {
      const { error: pErr } = await supabase.from('profiles').upsert({
        id: citAuth.user.id,
        full_name: 'Aarav Patel',
        email: citizenEmail,
        mobile_number: '+919876543210',
        role: 'user',
      });
      console.log('   Profile upsert result:', pErr ? pErr.message : 'SUCCESS');
    }
  }

  // Check profiles count now with current session
  const { count: cProfCount, data: cProfData, error: cProfErr } = await supabase.from('profiles').select('*', { count: 'exact' });
  console.log('Profiles table check after Citizen signup: count =', cProfCount, 'rows =', cProfData?.length, 'error =', cProfErr?.message);

  // 2. Citizen creates a waste report
  let reportId: string | null = null;
  if (citAuth.user) {
    const reportCode = `GC-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { data: repData, error: repErr } = await supabase.from('waste_reports').insert({
      report_code: reportCode,
      user_id: citAuth.user.id,
      title: 'Plastic Waste on Main Road',
      description: 'Accumulated plastic bottles and bags',
      waste_type: 'Plastic Waste',
      address: 'FC Road, Pune, Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567,
      status: 'available',
    }).select().single();

    if (repErr) {
      console.error('❌ Report insert error:', repErr.message);
    } else {
      console.log('✅ Report inserted:', repData.id, repData.report_code);
      reportId = repData.id;
    }
  }

  // 3. Sign out and Sign up NGO
  await supabase.auth.signOut();
  console.log('\n2. Signing up NGO:', ngoEmail);
  const { data: ngoAuth, error: ngoErr } = await supabase.auth.signUp({
    email: ngoEmail,
    password,
    options: {
      data: {
        full_name: 'Clean Pune Foundation',
        ngo_name: 'Clean Pune Foundation',
        mobile_number: '+919876500000',
        role: 'ngo',
        address: 'Shivajinagar, Pune',
      },
    },
  });

  let ngoRowId: string | null = null;
  if (ngoErr) {
    console.error('❌ NGO signup error:', ngoErr.message);
  } else {
    console.log('✅ NGO user created:', ngoAuth.user?.id);
    if (ngoAuth.user) {
      await supabase.from('profiles').upsert({
        id: ngoAuth.user.id,
        full_name: 'Clean Pune Foundation',
        email: ngoEmail,
        mobile_number: '+919876500000',
        role: 'ngo',
      });
      const { data: ngoRow, error: nErr } = await supabase.from('ngos').upsert({
        profile_id: ngoAuth.user.id,
        ngo_name: 'Clean Pune Foundation',
        address: 'Shivajinagar, Pune',
        latitude: 18.5314,
        longitude: 73.8446,
        mobile_number: '+919876500000',
        description: 'Dedicated to community cleanups across Pune',
        services: 'Waste Management, Community Cleanup',
      }).select().single();
      console.log('   NGO upsert result:', nErr ? nErr.message : 'SUCCESS', ngoRow?.id);
      ngoRowId = ngoRow?.id || null;
    }
  }

  // Check ngos table count
  const { count: nNgoCount, data: nNgoData, error: nNgoErr } = await supabase.from('ngos').select('*', { count: 'exact' });
  console.log('NGOs table check: count =', nNgoCount, 'rows =', nNgoData?.length, 'error =', nNgoErr?.message);

  // 4. NGO claims & resolves the report
  if (reportId && ngoAuth.user && ngoRowId) {
    console.log('\n3. NGO resolving the report:', reportId);
    // Add before and after image
    await supabase.from('report_images').insert([
      {
        report_id: reportId,
        image_url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18',
        image_type: 'before',
        uploaded_by: citAuth.user?.id || ngoAuth.user.id,
      },
      {
        report_id: reportId,
        image_url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09',
        image_type: 'after',
        uploaded_by: ngoAuth.user.id,
      }
    ]);

    const { error: updateErr } = await supabase.from('waste_reports').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: ngoRowId,
      assigned_ngo_id: ngoRowId,
    }).eq('id', reportId);

    console.log('   Report resolve result:', updateErr ? updateErr.message : 'SUCCESS');
  }

  // 5. Sign out (become anon) and check what is visible for platform statistics
  await supabase.auth.signOut();
  console.log('\n4. Checking Stats as Anonymous (Logged Out) Visitor:');

  const [anonProfiles, anonNgos, anonReports, anonResolved] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact' }),
    supabase.from('ngos').select('*', { count: 'exact' }),
    supabase.from('waste_reports').select('*', { count: 'exact' }),
    supabase.from('waste_reports').select('*', { count: 'exact' }).eq('status', 'resolved'),
  ]);

  console.log('   - Anonymous Profiles count:', anonProfiles.count, 'error:', anonProfiles.error?.message);
  console.log('   - Anonymous NGOs count:', anonNgos.count, 'error:', anonNgos.error?.message);
  console.log('   - Anonymous Waste Reports count:', anonReports.count, 'error:', anonReports.error?.message);
  console.log('   - Anonymous Resolved count:', anonResolved.count, 'error:', anonResolved.error?.message);
}

testFlow().catch(console.error);
