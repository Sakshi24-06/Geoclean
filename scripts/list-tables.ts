import { supabase } from '../src/utils/supabase';

async function listTables() {
  const tables = ['profiles', 'ngos', 'reports', 'notifications', 'cleanup_activities', 'users'];
  for (const t of tables) {
    const { error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`Table ${t}:`, error ? `Error: ${error.message}` : `Exists (count: ${count})`);
  }
}

listTables().catch(console.error);
