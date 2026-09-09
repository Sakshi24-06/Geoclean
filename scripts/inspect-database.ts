import { supabase } from '../src/utils/supabase';

async function inspectDb() {
  console.log('--- Inspecting Supabase Database ---');
  
  const { data: reports, error: reportsError } = await supabase
    .from('waste_reports')
    .select('*');

  if (reportsError) {
    console.error('Error fetching waste_reports:', reportsError);
  } else {
    console.log(`Total waste_reports: ${reports?.length || 0}`);
    reports?.forEach((r) => {
      console.log(`- [${r.status}] Code: ${r.report_code} | ID: ${r.id} | User: ${r.user_id} | ResolvedAt: ${r.resolved_at} | Deleted: ${r.deleted}`);
    });
  }

  const { data: images, error: imagesError } = await supabase
    .from('report_images')
    .select('id, report_id, image_type, image_url, created_at');

  if (imagesError) {
    console.error('Error fetching report_images:', imagesError);
  } else {
    console.log(`\nTotal report_images: ${images?.length || 0}`);
    images?.forEach((img) => {
      console.log(`- Image ID: ${img.id} | ReportID: ${img.report_id} | Type: ${img.image_type} | URL: ${img.image_url}`);
    });
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('ngo_assignments')
    .select('id, report_id, ngo_id, status, created_at');

  if (assignmentsError) {
    console.error('Error fetching ngo_assignments:', assignmentsError);
  } else {
    console.log(`\nTotal ngo_assignments: ${assignments?.length || 0}`);
    assignments?.forEach((a) => {
      console.log(`- Assignment ID: ${a.id} | ReportID: ${a.report_id} | Status: ${a.status} | NGO: ${a.ngo_id}`);
    });
  }

  // Also check storage buckets
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.log('\nStorage buckets error:', bucketsError);
    } else {
      console.log(`\nTotal storage buckets: ${buckets?.length || 0}`);
      for (const b of buckets || []) {
        console.log(`- Bucket: ${b.name} (public: ${b.public})`);
        const { data: files } = await supabase.storage.from(b.name).list();
        console.log(`  Files (${files?.length || 0}):`, files?.map(f => f.name));
      }
    }
  } catch (err) {
    console.log('Storage check error:', err);
  }
}

inspectDb();
