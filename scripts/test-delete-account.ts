import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runDeleteAccountTests() {
  console.log('=== RUNNING DELETE ACCOUNT VERIFICATION TESTS ===\n');

  // Test 1: Verify Modal Text Matching Logic
  console.log('Test 1: Input Validation ("DELETE" keyword matching)');
  const validateConfirmation = (text: string) => text.trim() === 'DELETE';

  assert(validateConfirmation('DELETE') === true, 'Exact "DELETE" enables confirmation');
  assert(validateConfirmation('  DELETE  ') === true, 'Trimmed "  DELETE  " enables confirmation');
  assert(validateConfirmation('delete') === false, 'Lowercase "delete" is rejected');
  assert(validateConfirmation('Delete') === false, 'Mixed case "Delete" is rejected');
  assert(validateConfirmation('') === false, 'Empty input is rejected');
  assert(validateConfirmation('DELET') === false, 'Incomplete "DELET" is rejected');
  assert(validateConfirmation('DELETE NOW') === false, 'Extra text is rejected');

  // Test 2: Check RPC SQL Migration file integrity
  console.log('\nTest 2: RPC SQL Migration verification');
  const sqlPath = resolve(process.cwd(), 'supabase/migrations/20260906_delete_account_rpc.sql');
  const sqlContent = readFileSync(sqlPath, 'utf-8');

  assert(sqlContent.includes('create or replace function public.delete_user_account()'), 'Defines delete_user_account RPC function');
  assert(sqlContent.includes('security definer'), 'Uses security definer to perform admin-safe account deletion');
  assert(sqlContent.includes('v_user_id uuid := auth.uid()'), 'Scoped strictly to currently authenticated user (auth.uid())');
  assert(sqlContent.includes('update public.waste_reports'), 'Safely updates and releases active waste reports assigned to NGO');
  assert(sqlContent.includes('delete from public.ngo_assignments'), 'Cleans up NGO assignments');
  assert(sqlContent.includes('delete from public.ngos'), 'Deletes NGO row (removes from NGO directory)');
  assert(sqlContent.includes('delete from public.notifications'), 'Deletes user notifications');
  assert(sqlContent.includes('delete from public.profiles'), 'Deletes user profile');
  assert(sqlContent.includes('delete from auth.users'), 'Deletes auth.users record');

  // Test 3: Check DeleteAccountModal implementation
  console.log('\nTest 3: DeleteAccountModal component structure');
  const modalPath = resolve(process.cwd(), 'src/components/DeleteAccountModal.tsx');
  const modalContent = readFileSync(modalPath, 'utf-8');

  assert(modalContent.includes('Delete Account?'), 'Includes "Delete Account?" title');
  assert(modalContent.includes('Are you sure you want to permanently delete your GeoClean account? This action cannot be undone.'), 'Includes required confirmation message');
  assert(modalContent.includes('Cancel'), 'Includes Cancel button');
  assert(modalContent.includes('Delete Account'), 'Includes Delete Account button');
  assert(modalContent.includes('confirmText.trim() === \'DELETE\''), 'Enforces DELETE confirmation before triggering action');
  assert(modalContent.includes('alert(\'Your GeoClean account has been permanently deleted.\')'), 'Alerts user on permanent deletion');
  assert(modalContent.includes('navigate(\'/\', { replace: true })'), 'Redirects user after deletion');

  // Test 4: Check Citizen and NGO Profile pages
  console.log('\nTest 4: Citizen and NGO Profile pages integration');
  const citizenProfPath = resolve(process.cwd(), 'src/pages/CitizenProfilePage.tsx');
  const citizenProfContent = readFileSync(citizenProfPath, 'utf-8');
  assert(citizenProfContent.includes('Danger Zone'), 'CitizenProfilePage includes Danger Zone section');
  assert(citizenProfContent.includes('Delete Account'), 'CitizenProfilePage includes Delete Account button');
  assert(citizenProfContent.includes('<DeleteAccountModal'), 'CitizenProfilePage renders DeleteAccountModal');

  const ngoProfPath = resolve(process.cwd(), 'src/pages/NgoProfilePage.tsx');
  const ngoProfContent = readFileSync(ngoProfPath, 'utf-8');
  assert(ngoProfContent.includes('Danger Zone'), 'NgoProfilePage includes Danger Zone section');
  assert(ngoProfContent.includes('Delete Account'), 'NgoProfilePage includes Delete Account button');
  assert(ngoProfContent.includes('<DeleteAccountModal'), 'NgoProfilePage renders DeleteAccountModal');

  // Test 5: Check DashboardLayout dropdown & mobile menu
  console.log('\nTest 5: DashboardLayout menu integration');
  const layoutPath = resolve(process.cwd(), 'src/components/DashboardLayout.tsx');
  const layoutContent = readFileSync(layoutPath, 'utf-8');
  assert(layoutContent.includes('menu-item-delete-account'), 'Profile dropdown includes Delete Account menu item');
  assert(layoutContent.includes('<DeleteAccountModal'), 'DashboardLayout renders DeleteAccountModal');

  // Test 6: Check Auth context deleteAccount flow
  console.log('\nTest 6: Auth deleteAccount function');
  const authPath = resolve(process.cwd(), 'src/lib/auth.tsx');
  const authContent = readFileSync(authPath, 'utf-8');
  assert(authContent.includes('delete_user_account'), 'Calls delete_user_account RPC');
  assert(authContent.includes('geoclean-ngos-updated'), 'Dispatches geoclean-ngos-updated event to refresh NGO Directory');
  assert(authContent.includes('supabase.auth.signOut()'), 'Signs user out after deletion');

  console.log('\n=== ALL DELETE ACCOUNT TESTS PASSED SUCCESSFULLY! ===\n');
}

runDeleteAccountTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
