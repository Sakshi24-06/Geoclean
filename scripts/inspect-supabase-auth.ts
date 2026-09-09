import { supabase } from '../src/utils/supabase';

async function testSupabaseAuth() {
  console.log('=== INSPECTING SUPABASE PROJECT AUTH CAPABILITIES ===\n');

  // Test 1: Test signInWithOtp capability for email
  console.log('1. Checking email OTP sending with signInWithOtp:');
  try {
    const testEmail = `test_geoclean_${Date.now()}@mailinator.com`;
    const res = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: false,
      }
    });
    console.log('   signInWithOtp result:', res);
  } catch (e) {
    console.log('   signInWithOtp error:', e);
  }

  // Test 2: Test signUp capability with test account
  console.log('\n2. Checking signUp behavior:');
  try {
    const testEmail = `test_signup_${Date.now()}@mailinator.com`;
    const res = await supabase.auth.signUp({
      email: testEmail,
      password: 'GeoCleanTestPassword123!',
      options: {
        data: {
          full_name: 'Test Citizen',
          mobile_number: '+919876543210',
          role: 'user',
        }
      }
    });
    console.log('   signUp result:');
    console.log('   - user id:', res.data.user?.id);
    console.log('   - user email:', res.data.user?.email);
    console.log('   - user email_confirmed_at:', (res.data.user as any)?.email_confirmed_at);
    console.log('   - user phone_confirmed_at:', (res.data.user as any)?.phone_confirmed_at);
    console.log('   - session exists:', !!res.data.session);
    console.log('   - error:', res.error);

    // Clean up test user if signed in
    if (res.data.session) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.log('   signUp error:', e);
  }

  // Test 3: Test phone OTP capability with signInWithOtp
  console.log('\n3. Checking phone OTP capability:');
  try {
    const res = await supabase.auth.signInWithOtp({
      phone: '+919876543210',
    });
    console.log('   signInWithOtp (phone) result:', res);
  } catch (e) {
    console.log('   signInWithOtp (phone) error:', e);
  }

  console.log('\n=== INSPECTION FINISHED ===');
}

testSupabaseAuth().catch(console.error);
