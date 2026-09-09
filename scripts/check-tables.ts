import { supabase } from '../src/utils/supabase';

async function checkDatabase() {
  console.log('=== CHECKING SUPABASE TABLES ===');
  
  const { data: profiles, error: err1 } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles table:', { data: profiles, error: err1 });

  const { data: ngos, error: err2 } = await supabase.from('ngos').select('*').limit(1);
  console.log('ngos table:', { data: ngos, error: err2 });

  const { data: otps, error: err3 } = await supabase.from('verification_codes').select('*').limit(1);
  console.log('verification_codes table:', { data: otps, error: err3 });

  const { data: tokens, error: err4 } = await supabase.from('email_otps').select('*').limit(1);
  console.log('email_otps table:', { data: tokens, error: err4 });
}

checkDatabase().catch(console.error);
