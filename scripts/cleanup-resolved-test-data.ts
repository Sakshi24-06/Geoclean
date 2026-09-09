import { supabase } from '../src/utils/supabase';

async function cleanupResolvedTestData() {
  console.log('===========================================================');
  console.log('   GEOclean RESOLVED TEST DATA & STORAGE CLEANUP SCRIPT   ');
  console.log('===========================================================');

  // 1. Find all resolved reports in Supabase
  const { data: resolvedReports, error: fetchErr } = await supabase
    .from('waste_reports')
    .select('id, report_code, status, waste_type, created_at, resolved_at')
    .or('status.eq.resolved,status.eq.Resolved');

  if (fetchErr) {
    console.error('Error querying resolved reports from Supabase:', fetchErr);
  } else {
    console.log(`Found ${resolvedReports?.length || 0} resolved reports in Supabase database.`);

    if (resolvedReports && resolvedReports.length > 0) {
      for (const rep of resolvedReports) {
        console.log(`- Deleting resolved report: ${rep.report_code} (ID: ${rep.id}, Type: ${rep.waste_type})`);

        // Get associated images to delete from storage if stored in bucket
        const { data: images } = await supabase
          .from('report_images')
          .select('id, image_url')
          .eq('report_id', rep.id);

        if (images && images.length > 0) {
          for (const img of images) {
            console.log(`  - Deleting associated image record: ${img.id} (${img.image_url})`);
            // If image is a Supabase storage path, remove file from bucket
            if (img.image_url.includes('supabase.co/storage/v1/object/public/')) {
              try {
                const parts = img.image_url.split('/public/')[1]?.split('/');
                if (parts && parts.length >= 2) {
                  const bucketName = parts[0];
                  const filePath = parts.slice(1).join('/');
                  console.log(`    - Removing file from storage bucket [${bucketName}]: ${filePath}`);
                  await supabase.storage.from(bucketName).remove([filePath]);
                }
              } catch (storageErr) {
                console.error('    - Error deleting file from storage:', storageErr);
              }
            }
          }

          // Delete image records from report_images table
          await supabase.from('report_images').delete().eq('report_id', rep.id);
        }

        // Delete associated assignments
        await supabase.from('ngo_assignments').delete().eq('report_id', rep.id);

        // Delete the waste_report record
        const { error: delErr } = await supabase.from('waste_reports').delete().eq('id', rep.id);
        if (delErr) {
          console.error(`  - Failed to delete report ${rep.id}:`, delErr);
        } else {
          console.log(`  ✓ Successfully deleted resolved report ${rep.report_code} from database.`);
        }
      }
    }
  }

  // Also query any remaining report_images with image_type = 'after' or orphaned images
  const { data: afterImages } = await supabase
    .from('report_images')
    .select('id, image_url, report_id')
    .eq('image_type', 'after');

  if (afterImages && afterImages.length > 0) {
    console.log(`\nFound ${afterImages.length} orphaned after-cleaning images.`);
    for (const img of afterImages) {
      if (img.image_url.includes('supabase.co/storage/v1/object/public/')) {
        try {
          const parts = img.image_url.split('/public/')[1]?.split('/');
          if (parts && parts.length >= 2) {
            const bucketName = parts[0];
            const filePath = parts.slice(1).join('/');
            await supabase.storage.from(bucketName).remove([filePath]);
          }
        } catch {}
      }
      await supabase.from('report_images').delete().eq('id', img.id);
    }
  }

  console.log('\n===========================================================');
  console.log('   SUPABASE RESOLVED TEST DATA CLEANUP COMPLETE           ');
  console.log('===========================================================');
}

cleanupResolvedTestData();
