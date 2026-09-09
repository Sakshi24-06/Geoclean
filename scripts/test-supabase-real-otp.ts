import { supabase } from '../src/utils/supabase';

async function testSupabaseOtp() {
  console.log('=== TESTING SUPABASE NATIVE AUTH OTP METHODS ===');

  const testEmail = `verify_test_${Date.now()}@mailinator.com`;
  console.log('1. Signing up with Supabase for email:', testEmail);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'SecureGeoCleanPassword123!',
    options: {
      data: {
        full_name: 'Test Real Citizen',
        mobile_number: '+919876543210',
        role: 'user',
      },
    },
  });

  console.log('   signUp result:');
  console.log('   - user id:', signUpData.user?.id);
  console.log('   - user email:', signUpData.user?.email);
  console.log('   - session:', !!signUpData.session);
  console.log('   - error:', signUpError);

  console.log('\n2. Testing verifyOtp with invalid code against Supabase:');
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email: testEmail,
    token: '000000',
    type: 'signup',
  });
  console.log('   verifyOtp (invalid token) response:');
  console.log('   - session:', verifyData.session);
  console.log('   - error message:', verifyError?.message);
  console.log('   - error status:', (verifyError as any)?.status);

  console.log('\n3. Testing resend method with Supabase:');
  const { data: resendData, error: resendError } = await supabase.auth.resend({
    type: 'signup',
    email: testEmail,
  });
  console.log('   resend response:');
  console.log('   - resendData:', resendData);
  console.log('   - resendError:', resendError?.message || resendError);

  console.log('\n=== SUPABASE AUTH NATIVE TESTING COMPLETE ===');
}

testSupabaseOtp().catch(console.error);
