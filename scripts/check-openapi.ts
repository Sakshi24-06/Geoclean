import fetch from 'node-fetch';

async function checkOpenApi() {
  const url = 'https://hiqoxogyszhobixtytwn.supabase.co/rest/v1/';
  const key = 'sb_publishable_gcfV40SqF7KDzld9zIlsRg_GaB7qDpf';

  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  const schema = (await res.json()) as any;
  console.log('=== SUPABASE POSTGREST SCHEMA DEFINITIONS ===');
  console.log('Paths:', Object.keys(schema.paths || {}));
  console.log('\nDefinitions / Tables:');
  console.log(Object.keys(schema.definitions || {}));
}

checkOpenApi().catch(console.error);
