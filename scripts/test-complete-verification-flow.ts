import { supabase } from '../src/utils/supabase';

async function runVerificationTests() {
  console.log('====================================================');
  console.log('GEOCLEAN SUPABASE CITIZEN VERIFICATION TEST SUITE');
  console.log('====================================================');

  const testEmail = `citizen_${Date.now()}@example.com`;
  const testPassword = 'SecureCitizenPassword123!';
  const fullName = 'Pooja Sharma';
  const mobile = '+919876543210';

  console.log('\n[TEST 1] Registering new Citizen with Supabase:');
  console.log('  Email:', testEmail);
  console.log('  Full Name:', fullName);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: fullName,
        mobile_number: mobile,
        role: 'user',
      },
    },
  });

  if (signUpError) {
    console.error('❌ Sign up failed:', signUpError.message);
  } else {
    console.log('✅ Supabase Auth signup initiated successfully:');
    console.log('   - User ID:', signUpData.user?.id);
    console.log('   - Email:', signUpData.user?.email);
    console.log('   - User Metadata:', signUpData.user?.user_metadata);
  }

  console.log('\n[TEST 2] Testing Invalid OTP verification rejection via Supabase:');
  const { data: invalidOtpData, error: invalidOtpError } = await supabase.auth.verifyOtp({
    email: testEmail,
    token: '000000',
    type: 'signup',
  });

  console.log('   - Verify Result:', invalidOtpData?.session ? 'SESSION CREATED (WRONG)' : 'REJECTED AS EXPECTED');
  console.log('   - Supabase Error Message:', invalidOtpError?.message);
  if (invalidOtpError) {
    console.log('✅ Invalid OTP correctly rejected by Supabase backend!');
  } else {
    console.error('❌ Invalid OTP was not rejected!');
  }

  console.log('\n[TEST 3] Testing Real Supabase OTP Resend:');
  const { data: resendData, error: resendError } = await supabase.auth.resend({
    type: 'signup',
    email: testEmail,
  });

  if (resendError) {
    console.log('   - Resend notice (rate limit or provider):', resendError.message);
  } else {
    console.log('✅ Resend OTP request dispatched to Supabase Auth successfully!');
  }

  console.log('\n====================================================');
  console.log('ALL NATIVE SUPABASE AUTH CHECKS COMPLETED');
  console.log('====================================================');
}

runVerificationTests().catch(console.error);
