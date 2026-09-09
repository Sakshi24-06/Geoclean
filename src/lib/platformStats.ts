import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { loadNgoReports } from './reportData';
import { fetchNgoDirectory } from './ngoService';
import { STORAGE_KEYS, type AuthUser } from './types';

export interface PlatformStats {
  citizens: number;
  resolved: number;
  ngos: number;
  reported: number;
  loading: boolean;
  error?: string | null;
}

/**
 * Format count with comma separation (e.g. 1,248 or 0)
 * While loading, returns '—'.
 * Never appends fake letters like 'K' or 'T'.
 */
export function formatStatCount(num: number | null | undefined, loading = false): string {
  if (loading || num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Fetch real aggregate platform stats from Supabase with multi-layered fallbacks.
 * Combines secure RPC, direct table counts, application data loaders, and registered stores.
 */
export async function fetchPlatformStats(): Promise<{
  citizens: number;
  resolved: number;
  ngos: number;
  reported: number;
  error?: string | null;
}> {
  let citizensCount = 0;
  let resolvedCount = 0;
  let ngosCount = 0;
  let reportedCount = 0;

  // 1. Try secure PostgreSQL RPC first (returns aggregate JSON only without exposing personal records)
  try {
    const { data: rawRpcData, error: rpcError } = await supabase.rpc('get_public_platform_stats');

    if (rpcError) {
      console.warn('[PlatformStats] RPC error:', rpcError.code, rpcError.message);
    } else if (rawRpcData) {
      console.log('[PlatformStats] RPC result:', rawRpcData);
      const rpcData = typeof rawRpcData === 'string' ? JSON.parse(rawRpcData) : rawRpcData;
      if (rpcData && typeof rpcData === 'object') {
        const c = Number((rpcData as Record<string, unknown>).citizens ?? (rpcData as Record<string, unknown>).citizen_count ?? (rpcData as Record<string, unknown>).citizens_count ?? 0);
        const r = Number((rpcData as Record<string, unknown>).resolved ?? (rpcData as Record<string, unknown>).resolved_count ?? (rpcData as Record<string, unknown>).resolved_cleanups ?? 0);
        const n = Number((rpcData as Record<string, unknown>).ngos ?? (rpcData as Record<string, unknown>).ngo_count ?? (rpcData as Record<string, unknown>).ngos_count ?? 0);
        const rep = Number((rpcData as Record<string, unknown>).reported ?? (rpcData as Record<string, unknown>).reported_count ?? (rpcData as Record<string, unknown>).total_reports ?? 0);

        citizensCount = c;
        resolvedCount = r;
        ngosCount = n;
        reportedCount = rep;
      }
    }
  } catch (rpcErr) {
    console.warn('[PlatformStats] RPC invocation caught note:', rpcErr);
  }

  // 2. Direct Supabase Table Counts (Exact queries as used by Impact section)
  try {
    const [
      reportsRes,
      resolvedRes,
      allProfilesRes,
      citizensUserRes,
      citizensCitizenRes,
      nonNgoProfilesRes,
      ngosTableRes,
      ngosProfilesRes,
    ] = await Promise.all([
      // Total waste reports
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }),

      // Resolved waste reports
      supabase.from('waste_reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),

      // Total profiles
      supabase.from('profiles').select('*', { count: 'exact', head: true }),

      // Citizen profiles (role = 'user')
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),

      // Citizen profiles (role = 'citizen')
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'citizen'),

      // Non-NGO profiles (role != 'ngo')
      supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'ngo'),

      // Registered NGOs (ngos table)
      supabase.from('ngos').select('*', { count: 'exact', head: true }),

      // NGO profiles (role = 'ngo')
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'ngo'),
    ]);

    const cUser = citizensUserRes.count ?? (Array.isArray(citizensUserRes.data) ? citizensUserRes.data.length : 0);
    const cCitizen = citizensCitizenRes.count ?? (Array.isArray(citizensCitizenRes.data) ? citizensCitizenRes.data.length : 0);
    const cNonNgo = nonNgoProfilesRes.count ?? (Array.isArray(nonNgoProfilesRes.data) ? nonNgoProfilesRes.data.length : 0);
    const cAll = allProfilesRes.count ?? (Array.isArray(allProfilesRes.data) ? allProfilesRes.data.length : 0);

    const nTable = ngosTableRes.count ?? (Array.isArray(ngosTableRes.data) ? ngosTableRes.data.length : 0);
    const nProf = ngosProfilesRes.count ?? (Array.isArray(ngosProfilesRes.data) ? ngosProfilesRes.data.length : 0);
    const calculatedNgos = Math.max(nTable, nProf);
    ngosCount = Math.max(ngosCount, calculatedNgos);

    const cDerivedFromAll = cAll > calculatedNgos ? cAll - calculatedNgos : 0;
    citizensCount = Math.max(citizensCount, cUser, cCitizen, cNonNgo, cDerivedFromAll);

    const rCount = resolvedRes.count ?? (Array.isArray(resolvedRes.data) ? resolvedRes.data.length : 0);
    resolvedCount = Math.max(resolvedCount, rCount);

    const repCount = reportsRes.count ?? (Array.isArray(reportsRes.data) ? reportsRes.data.length : 0);
    reportedCount = Math.max(reportedCount, repCount);
  } catch (tableErr) {
    console.warn('[PlatformStats] Direct count note:', tableErr);
  }

  // 3. Merged Application Loaders (fetches and combines Supabase + active user records)
  try {
    // Resolved cleanups and total reports via loadNgoReports()
    const allReports = await loadNgoReports().catch(() => []);
    const loadedResolved = allReports.filter(
      (r) => !r.deleted && (r.status === 'resolved' || (r.status as unknown as string) === 'Resolved')
    ).length;
    const loadedReported = allReports.filter((r) => !r.deleted).length;

    resolvedCount = Math.max(resolvedCount, loadedResolved);
    reportedCount = Math.max(reportedCount, loadedReported);

    // NGOs via fetchNgoDirectory()
    const directoryNgos = await fetchNgoDirectory().catch(() => []);
    ngosCount = Math.max(ngosCount, directoryNgos.length);

    // Check if current user is logged in as Citizen
    try {
      const rawAuth = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.auth) : null;
      if (rawAuth) {
        const parsedAuth = JSON.parse(rawAuth) as AuthUser;
        if (parsedAuth && parsedAuth.role === 'user' && citizensCount === 0) {
          citizensCount = 1;
        }
      }
    } catch {}
  } catch (loaderErr) {
    console.warn('[PlatformStats] Loader merge note:', loaderErr);
  }

  return {
    citizens: citizensCount,
    resolved: resolvedCount,
    ngos: ngosCount,
    reported: reportedCount,
    error: null,
  };
}

// Global Shared Realtime Subscription Management for Platform Statistics
type StatsSubscriberCallback = () => void;
const statsSubscribers = new Set<StatsSubscriberCallback>();
let sharedStatsChannel: ReturnType<typeof supabase.channel> | null = null;
let lastKnownStats: PlatformStats = {
  citizens: 0,
  resolved: 0,
  ngos: 0,
  reported: 0,
  loading: true,
  error: null,
};

function notifyAllSubscribers() {
  statsSubscribers.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.warn('[PlatformStats] Subscriber update callback error:', err);
    }
  });
}

function startSharedRealtimeSubscription() {
  if (sharedStatsChannel) return;

  try {
    const channelTopic = `public-platform-stats-live-${Date.now()}`;
    const channel = supabase.channel(channelTopic);

    // CRITICAL: Register all postgres_changes event listeners BEFORE calling .subscribe()
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          notifyAllSubscribers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waste_reports' },
        () => {
          notifyAllSubscribers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ngos' },
        () => {
          notifyAllSubscribers();
        }
      );

    channel.subscribe((status, err) => {
      if (err) {
        console.warn('[PlatformStats] Supabase Realtime subscription status notice:', status, err);
      }
    });

    sharedStatsChannel = channel;
  } catch (realtimeErr) {
    console.warn('[PlatformStats] Safe catch on Realtime setup (fallback to manual refresh):', realtimeErr);
    sharedStatsChannel = null;
  }
}

function stopSharedRealtimeSubscription() {
  if (statsSubscribers.size === 0 && sharedStatsChannel) {
    const channelToClean = sharedStatsChannel;
    sharedStatsChannel = null;
    try {
      void supabase.removeChannel(channelToClean);
    } catch (err) {
      console.warn('[PlatformStats] Error removing shared channel:', err);
    }
  }
}

/**
 * React Hook for Realtime Platform Statistics
 * Safely shares a single Realtime subscription across multiple mounting components (Hero, Impact, Sidebar).
 * Guarantees zero duplicate subscriptions and zero listener-after-subscribe errors.
 */
export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats>(lastKnownStats);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPlatformStats();
      const nextStats: PlatformStats = {
        citizens: data.citizens,
        resolved: data.resolved,
        ngos: data.ngos,
        reported: data.reported,
        loading: false,
        error: data.error,
      };
      console.log('[PlatformStats] Shared stats:', nextStats);
      lastKnownStats = nextStats;
      setStats(nextStats);
    } catch (err) {
      console.warn('[PlatformStats] Error in usePlatformStats hook fetch:', err);
      setStats((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load stats',
      }));
    }
  }, []);

  useEffect(() => {
    // 1. Initial statistics fetch
    void refresh();

    // 2. Register subscriber callback
    const onSubscriberUpdate = () => {
      void refresh();
    };
    statsSubscribers.add(onSubscriberUpdate);

    // 3. If first subscriber, establish shared Realtime channel
    if (statsSubscribers.size === 1) {
      startSharedRealtimeSubscription();
    }

    // 4. Listen for client custom events
    const handleReportsUpdate = () => void refresh();
    const handleNgosUpdate = () => void refresh();

    window.addEventListener('geoclean-reports-updated', handleReportsUpdate);
    window.addEventListener('geoclean-ngos-updated', handleNgosUpdate);

    return () => {
      statsSubscribers.delete(onSubscriberUpdate);
      window.removeEventListener('geoclean-reports-updated', handleReportsUpdate);
      window.removeEventListener('geoclean-ngos-updated', handleNgosUpdate);

      // Clean up Realtime channel only when no components are listening
      if (statsSubscribers.size === 0) {
        stopSharedRealtimeSubscription();
      }
    };
  }, [refresh]);

  return { ...stats, refetch: refresh };
}
