import { fetchNgoDirectory } from '../src/lib/ngoService';
import { loadNgoReports } from '../src/lib/reportData';
import { supabase } from '../src/utils/supabase';

async function testStatsCalc() {
  console.log('=== CALCULATING REAL PLATFORM STATS ===\n');

  // 1. Fetch Resolved reports
  let resolvedCount = 0;
  try {
    const { count: directResolvedCount, error: rErr } = await supabase
      .from('waste_reports')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.resolved,status.eq.Resolved');

    if (rErr) console.warn('waste_reports query note:', rErr.message);
    if (directResolvedCount !== null && directResolvedCount !== undefined) {
      resolvedCount = directResolvedCount;
    }

    const allReports = await loadNgoReports().catch(() => []);
    const loadedResolved = allReports.filter(
      (r) => !r.deleted && (r.status === 'resolved' || r.status === 'Resolved')
    ).length;
    resolvedCount = Math.max(resolvedCount, loadedResolved);
  } catch (err) {
    console.error('Error fetching resolved reports:', err);
  }

  // 2. Fetch NGOs
  let ngosCount = 0;
  try {
    const { count: directNgosCount, error: nErr } = await supabase
      .from('ngos')
      .select('id', { count: 'exact', head: true });

    if (nErr) console.warn('ngos query note:', nErr.message);
    if (directNgosCount !== null && directNgosCount !== undefined) {
      ngosCount = directNgosCount;
    }

    const directoryNgos = await fetchNgoDirectory().catch(() => []);
    ngosCount = Math.max(ngosCount, directoryNgos.length);
  } catch (err) {
    console.error('Error fetching NGOs:', err);
  }

  // 3. Fetch Citizens
  let citizensCount = 0;
  try {
    const { count: directCitizensCount, data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, role', { count: 'exact' })
      .or('role.eq.user,role.eq.citizen,role.ilike.user,role.ilike.citizen');

    if (pErr) console.warn('profiles query note:', pErr.message);
    if (directCitizensCount !== null && directCitizensCount !== undefined) {
      citizensCount = directCitizensCount;
    } else if (profs) {
      citizensCount = profs.filter(
        (p) => p.role === 'user' || p.role === 'citizen' || (p.role && p.role.toLowerCase() === 'user')
      ).length;
    }
  } catch (err) {
    console.error('Error fetching citizens:', err);
  }

  console.log('Final Calculated Real Stats:');
  console.log(` - Citizens: ${citizensCount}`);
  console.log(` - Resolved: ${resolvedCount}`);
  console.log(` - NGOs:     ${ngosCount}`);
}

testStatsCalc().catch(console.error);
