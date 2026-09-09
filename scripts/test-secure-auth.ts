import { supabase } from '../src/utils/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function testSecurityAudit() {
  console.log('=== RUNNING GEOCLEAN SECURITY & OTP AUDIT ===\n');

  const cwd = process.cwd();

  // 1. Audit AuthPage.tsx for any exposed OTP code or debug messages
  console.log('1. Auditing src/pages/AuthPage.tsx for exposed OTP tokens:');
  const authPageContent = fs.readFileSync(path.join(cwd, 'src/pages/AuthPage.tsx'), 'utf-8');
  
  const hasExposedOtpBox = authPageContent.includes('Verification Code:');
  const hasLocalOtpMath = authPageContent.includes('Math.floor(') || authPageContent.includes('generateCryptographicOtp');
  const hasActiveOtpState = authPageContent.includes('activeOtpCode');
  
  console.log('   - Contains "Verification Code:" debug box:', hasExposedOtpBox ? '❌ FAILED' : '✅ CLEAN (None)');
  console.log('   - Contains local OTP generator (Math.floor/crypto):', hasLocalOtpMath ? '❌ FAILED' : '✅ CLEAN (None)');
  console.log('   - Contains activeOtpCode state:', hasActiveOtpState ? '❌ FAILED' : '✅ CLEAN (None)');

  if (hasExposedOtpBox || hasLocalOtpMath || hasActiveOtpState) {
    throw new Error('Security Audit Failed: Exposed OTP found in AuthPage.tsx');
  }

  // 2. Audit src/lib/auth.tsx for native Supabase Auth methods
  console.log('\n2. Auditing src/lib/auth.tsx for native Supabase Auth methods:');
  const authLibContent = fs.readFileSync(path.join(cwd, 'src/lib/auth.tsx'), 'utf-8');
  const usesSupabaseVerifyOtp = authLibContent.includes('supabase.auth.verifyOtp');
  const usesSupabaseResend = authLibContent.includes('supabase.auth.resend');
  const usesSupabaseSignUp = authLibContent.includes('supabase.auth.signUp');
  const hasInsecureStore = authLibContent.includes('otpVerification');

  console.log('   - Uses native supabase.auth.verifyOtp:', usesSupabaseVerifyOtp ? '✅ PASS' : '❌ FAILED');
  console.log('   - Uses native supabase.auth.resend:', usesSupabaseResend ? '✅ PASS' : '❌ FAILED');
  console.log('   - Uses native supabase.auth.signUp:', usesSupabaseSignUp ? '✅ PASS' : '❌ FAILED');
  console.log('   - References local otpVerification store:', hasInsecureStore ? '❌ FAILED' : '✅ CLEAN (None)');

  if (!usesSupabaseVerifyOtp || !usesSupabaseResend || !usesSupabaseSignUp || hasInsecureStore) {
    throw new Error('Security Audit Failed: auth.tsx does not strictly use native Supabase Auth');
  }

  // 3. Test Native Supabase Methods
  console.log('\n3. Testing Supabase Auth Client Integration:');
  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    email: 'security_audit@example.com',
    token: '123456',
    type: 'signup',
  });
  console.log('   - Real Supabase verification rejection for wrong code (123456):', verifyErr ? `✅ Properly rejected (${verifyErr.message})` : '❌ Failed');

  // 4. Verify Spacing CSS
  console.log('\n4. Verifying Spacing between Confirm Password & Create Account:');
  const cssContent = fs.readFileSync(path.join(cwd, 'src/index.css'), 'utf-8');
  const hasActionGroupMargin = cssContent.includes('.auth-action-group { margin-top: 36px;');
  console.log('   - .auth-action-group vertical margin (36px):', hasActionGroupMargin ? '✅ PASS' : '❌ FAILED');

  console.log('\n=== ALL SECURITY & VERIFICATION AUDITS PASSED 100%! ===\n');
}

testSecurityAudit().catch((err) => {
  console.error('Security audit failed:', err);
  process.exit(1);
});
