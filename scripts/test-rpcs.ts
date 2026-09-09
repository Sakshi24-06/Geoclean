import { supabase } from '../src/utils/supabase';

async function testRpcs() {
  const { data, error } = await supabase.rpc('accept_nearby_report', {
    p_report_id: '00000000-0000-0000-0000-000000000000',
  });
  console.log('accept_nearby_report result:', { data, error });
}

testRpcs().catch(console.error);
