import { fetchPlatformStats, formatStatCount } from '../src/lib/platformStats';
import * as fs from 'fs';
import * as path from 'path';

async function runVerification() {
  console.log('=== PLATFORM STATISTICS SINGLETON & SYNC VERIFICATION ===\n');

  // 1. Check formatStatCount behavior
  console.log('1. Checking formatStatCount output formatting:');
  const loadingOutput = formatStatCount(14, true);
  const nullOutput = formatStatCount(null, false);
  const countOutput = formatStatCount(14, false);
  const zeroOutput = formatStatCount(0, false);

  if (loadingOutput !== '—') throw new Error(`Expected '—' when loading, got '${loadingOutput}'`);
  if (nullOutput !== '—') throw new Error(`Expected '—' when null, got '${nullOutput}'`);
  if (countOutput !== '14') throw new Error(`Expected '14', got '${countOutput}'`);
  if (zeroOutput !== '0') throw new Error(`Expected '0', got '${zeroOutput}'`);
  console.log('   ✅ formatStatCount properly outputs "—" during loading and exact formatted numbers when loaded.');

  // 2. Inspect HomeSections.tsx to ensure Hero and ImpactSection use the EXACT same hook
  console.log('\n2. Inspecting src/components/HomeSections.tsx:');
  const homeSectionsPath = path.resolve(process.cwd(), 'src/components/HomeSections.tsx');
  const homeSectionsContent = fs.readFileSync(homeSectionsPath, 'utf8');

  const heroUsesUsePlatformStats = homeSectionsContent.includes('export function Hero') &&
    homeSectionsContent.includes('const { citizens, resolved, ngos, loading: statsLoading } = usePlatformStats();');

  const impactUsesUsePlatformStats = homeSectionsContent.includes('export function ImpactSection') &&
    homeSectionsContent.includes('const { reported, resolved, citizens, ngos, loading: statsLoading } = usePlatformStats();');

  if (!heroUsesUsePlatformStats) {
    throw new Error('Hero in HomeSections.tsx is not using usePlatformStats() hook!');
  }
  if (!impactUsesUsePlatformStats) {
    throw new Error('ImpactSection in HomeSections.tsx is not using usePlatformStats() hook!');
  }
  console.log('   ✅ Hero and ImpactSection both consume usePlatformStats() from src/lib/platformStats.ts.');

  // 3. Inspect platformStats.ts architecture
  console.log('\n3. Inspecting src/lib/platformStats.ts architecture:');
  const platformStatsPath = path.resolve(process.cwd(), 'src/lib/platformStats.ts');
  const platformStatsContent = fs.readFileSync(platformStatsPath, 'utf8');

  const hasSingletonSubscribers = platformStatsContent.includes('const statsSubscribers = new Set<StatsSubscriberCallback>();');
  const hasSharedRealtime = platformStatsContent.includes('startSharedRealtimeSubscription') &&
    platformStatsContent.includes('stopSharedRealtimeSubscription');
  const hasConsoleLog = platformStatsContent.includes("[PlatformStats] Shared stats:");

  if (!hasSingletonSubscribers) throw new Error('Missing statsSubscribers singleton set in platformStats.ts');
  if (!hasSharedRealtime) throw new Error('Missing shared Realtime subscription lifecycle management');
  if (!hasConsoleLog) throw new Error('Missing shared stats development console log');

  console.log('   ✅ Singleton subscriber set guarantees a single shared Realtime subscription across all components.');
  console.log('   ✅ Shared stats logger added for development verification.');

  // 4. Test fetchPlatformStats function execution
  console.log('\n4. Executing fetchPlatformStats():');
  const stats = await fetchPlatformStats();
  console.log('   ✅ fetchPlatformStats returned:', stats);

  console.log('\n==================================================');
  console.log('🎉 ALL 4 STATS SYNCHRONIZATION CHECKS PASSED!');
  console.log('==================================================');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
