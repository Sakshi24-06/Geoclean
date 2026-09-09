import { loadNgoReports } from '../src/lib/reportData';
import { fetchNgoDirectory } from '../src/lib/ngoService';
import { supabase } from '../src/utils/supabase';

async function testLoaders() {
  console.log('=== TESTING REAL DATA LOADERS ===\n');

  // 1. NGO Directory
  console.log('1. Calling fetchNgoDirectory():');
  const ngos = await fetchNgoDirectory();
  console.log(`   Fetched ${ngos.length} NGOs:`, ngos.map((n) => ({ id: n.id, name: n.name, profileId: n.profileId })));

  // 2. NGO Reports & Resolved count
  console.log('\n2. Calling loadNgoReports():');
  const reports = await loadNgoReports();
  const resolved = reports.filter((r) => !r.deleted && (r.status === 'resolved' || r.status === 'Resolved'));
  console.log(`   Total reports: ${reports.length}`);
  console.log(`   Resolved reports: ${resolved.length}`);
  reports.forEach((r) => {
    console.log(`   - Code: ${r.report_code}, status: "${r.status}", deleted: ${r.deleted}`);
  });

  // 3. Direct profiles check
  console.log('\n3. Direct profiles check:');
  const { data: profData, count: profCount, error: profErr } = await supabase
    .from('profiles')
    .select('id, role, full_name, email', { count: 'exact' });
  console.log(`   Profiles count: ${profCount}, error:`, profErr?.message || 'none');
  profData?.forEach((p) => {
    console.log(`   - Profile: ${p.id}, role: "${p.role}", name: "${p.full_name}"`);
  });
}

testLoaders().catch(console.error);
