import { supabase } from '../src/utils/supabase';

async function checkAuthSchema() {
  console.log('1. Signing in or signing up a real user in Supabase Auth...');
  const email = `test_admin_${Date.now()}@gmail.com`;
  const password = 'Password@123456!';

  // Test sign up
  const { data: upData, error: upErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Admin Test User',
        role: 'admin',
      },
    },
  });

  console.log('SignUp:', { user: upData.user?.id, session: !!upData.session, err: upErr });

  let session = upData.session;

  if (!session) {
    const { data: inData, error: inErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('SignIn:', { user: inData.user?.id, session: !!inData.session, err: inErr });
    session = inData.session;
  }

  if (session) {
    console.log('\n2. Querying OpenAPI schema as authenticated user...');
    const url = 'https://hiqoxogyszhobixtytwn.supabase.co/rest/v1/';
    const res = await fetch(url, {
      headers: {
        apikey: 'sb_publishable_gcfV40SqF7KDzld9zIlsRg_GaB7qDpf',
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const schema = (await res.json()) as any;
    console.log('Authenticated Paths:', Object.keys(schema.paths || {}));
    console.log('Authenticated Tables:', Object.keys(schema.definitions || {}));

    console.log('\n3. Querying tables with auth token:');
    for (const table of ['profiles', 'ngos', 'waste_reports', 'report_images', 'ngo_assignments', 'notifications', 'todos']) {
      const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' });
      console.log(`Table [${table}]: count=${count}, rows=${data?.length}, error=`, error ? error.message : 'none');
      if (data && data.length > 0) {
        console.log(`   Sample rows from ${table}:`, data.slice(0, 3));
      }
    }
  }
}

checkAuthSchema().catch(console.error);
