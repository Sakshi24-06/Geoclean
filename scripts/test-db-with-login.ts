import { supabase } from '../src/utils/supabase';

async function testWithLogin() {
  console.log('1. Attempting login as test user...');
  // Try logging in with a test user or see if we can create one
  const email = `test_query_${Date.now()}@mailinator.com`;
  const password = 'TestPassword123!';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Citizen',
        role: 'user',
      },
    },
  });

  console.log('Sign up result:', { id: signUpData.user?.id, err: signUpError });

  // Sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  console.log('Sign in result:', { id: signInData.user?.id, err: signInError });

  // Now query profiles as authenticated user
  console.log('\n2. Querying profiles as authenticated user:');
  const { data: profiles, error: pErr, count: pCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });
  console.log('Profiles count:', pCount, 'data length:', profiles?.length, 'error:', pErr);
  if (profiles) {
    profiles.forEach((p) => {
      console.log(` - Profile: ${p.id}, role: "${p.role}", name: "${p.full_name}"`);
    });
  }

  // Query ngos as authenticated user
  console.log('\n3. Querying ngos as authenticated user:');
  const { data: ngos, error: nErr, count: nCount } = await supabase
    .from('ngos')
    .select('*', { count: 'exact' });
  console.log('NGOs count:', nCount, 'data length:', ngos?.length, 'error:', nErr);
  if (ngos) {
    ngos.forEach((n) => {
      console.log(` - NGO: ${n.id}, name: "${n.ngo_name}"`);
    });
  }

  // Query waste_reports as authenticated user
  console.log('\n4. Querying waste_reports as authenticated user:');
  const { data: reports, error: rErr, count: rCount } = await supabase
    .from('waste_reports')
    .select('*', { count: 'exact' });
  console.log('Reports count:', rCount, 'data length:', reports?.length, 'error:', rErr);
  if (reports) {
    reports.forEach((r) => {
      console.log(` - Report: ${r.report_code}, status: "${r.status}", user_id: ${r.user_id}`);
    });
  }

  // Clean up
  await supabase.auth.signOut();
}

testWithLogin().catch(console.error);
