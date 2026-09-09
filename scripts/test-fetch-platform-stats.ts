import { fetchPlatformStats, formatStatCount } from '../src/lib/platformStats';

async function test() {
  console.log('=== TESTING fetchPlatformStats() ===\n');

  const stats = await fetchPlatformStats();
  console.log('Result from fetchPlatformStats():', stats);

  console.log('\nFormatted Counts:');
  console.log(` - Citizens: ${formatStatCount(stats.citizens)} (Loading: "${formatStatCount(stats.citizens, true)}")`);
  console.log(` - Resolved: ${formatStatCount(stats.resolved)} (Loading: "${formatStatCount(stats.resolved, true)}")`);
  console.log(` - NGOs:     ${formatStatCount(stats.ngos)} (Loading: "${formatStatCount(stats.ngos, true)}")`);
  console.log(` - Reported: ${formatStatCount(stats.reported)} (Loading: "${formatStatCount(stats.reported, true)}")`);

  if (typeof stats.citizens === 'number' && typeof stats.resolved === 'number' && typeof stats.ngos === 'number' && typeof stats.reported === 'number') {
    console.log('\n✅ All stats returned valid numeric types without crashing.');
  } else {
    console.error('\n❌ Invalid stats returned!');
    process.exit(1);
  }
}

test().catch(console.error);
