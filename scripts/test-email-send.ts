import { supabase } from '../src/utils/supabase';

async function testEmailSending() {
  console.log('=== TESTING SUPABASE EMAIL DISPATCH ===');
  
  // Test password reset email dispatch to check if Supabase default SMTP is working
  const res = await supabase.auth.resetPasswordForEmail('test_otp_geoclean@mailinator.com', {
    redirectTo: 'http://localhost:5174/login',
  });
  console.log('resetPasswordForEmail result:', res);
}

testEmailSending().catch(console.error);
