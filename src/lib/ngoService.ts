import { supabase } from '../utils/supabase';
import { STORAGE_KEYS, type NgoDirectoryItem } from './types';

export function parseCategories(services?: string | null): string[] {
  if (!services || !services.trim()) {
    return ['Waste Management', 'Community Cleanup'];
  }
  const parts = services
    .split(/[,;|•\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ['Waste Management', 'Community Cleanup'];
}

export type DbNgoRow = {
  id: string;
  profile_id?: string;
  ngo_name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  mobile_number?: string | null;
  description?: string | null;
  website?: string | null;
  services?: string | null;
  created_at?: string;
  profiles?: {
    id?: string;
    full_name?: string;
    email?: string;
    mobile_number?: string | null;
  } | null;
};

export function mapDbNgoToDirectoryItem(row: DbNgoRow): NgoDirectoryItem {
  const categories = parseCategories(row.services);
  const contactPhone = row.mobile_number || row.profiles?.mobile_number || undefined;
  const contactEmail = row.profiles?.email || undefined;

  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.ngo_name || row.profiles?.full_name || 'Registered NGO Partner',
    location: row.address || 'Pune, Maharashtra',
    categories,
    description:
      row.description ||
      'Authorized GeoClean cleanup and environmental management partner working across Pune communities.',
    activities:
      row.services ||
      'Coordination of local waste cleanup, report management, community engagement, and environmental restoration.',
    website: row.website || '',
    phone: contactPhone,
    email: contactEmail,
    source: 'Registered GeoClean Partner',
    verified: true,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
  };
}

export function deduplicateNgos(ngos: NgoDirectoryItem[]): NgoDirectoryItem[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const unique: NgoDirectoryItem[] = [];

  for (const ngo of ngos) {
    if (!ngo || !ngo.name) continue;
    // Discard any legacy demo IDs
    if (ngo.id && ngo.id.startsWith('ngo-default-')) continue;

    const key = ngo.name.trim().toLowerCase();
    const idKey = ngo.id ? ngo.id.toLowerCase() : '';

    if (idKey && seenIds.has(idKey)) continue;
    if (seenNames.has(key)) continue;

    if (idKey) seenIds.add(idKey);
    seenNames.add(key);
    unique.push(ngo);
  }

  return unique;
}

export function getCachedNgos(): NgoDirectoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ngos);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out any legacy demo IDs
    return deduplicateNgos(parsed);
  } catch {
    return [];
  }
}

export function saveCachedNgos(items: NgoDirectoryItem[]): void {
  try {
    const cleanItems = deduplicateNgos(items);
    localStorage.setItem(STORAGE_KEYS.ngos, JSON.stringify(cleanItems));
  } catch {}
}

/**
 * Fetches only registered NGOs from the database (the single source of truth).
 * Does not include any mock or demo NGOs.
 */
export async function fetchNgoDirectory(): Promise<NgoDirectoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('ngos')
      .select(
        'id, profile_id, ngo_name, address, latitude, longitude, mobile_number, description, website, services, created_at, profiles(id, full_name, email, mobile_number)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase ngos query notice:', error.message);
      return getCachedNgos();
    }

    const dbItems = (data || []).map((row) => mapDbNgoToDirectoryItem(row as unknown as DbNgoRow));
    const cleanItems = deduplicateNgos(dbItems);
    saveCachedNgos(cleanItems);
    return cleanItems;
  } catch (err) {
    console.error('fetchNgoDirectory error:', err);
    return getCachedNgos();
  }
}

export function subscribeNgoDirectory(onUpdate: () => void): () => void {
  const channelName = `ngo-dir-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase.channel(channelName);

  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, () => {
      onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      onUpdate();
    });

  channel.subscribe();

  const handleCustomUpdate = () => {
    onUpdate();
  };
  window.addEventListener('geoclean-ngos-updated', handleCustomUpdate);

  return () => {
    window.removeEventListener('geoclean-ngos-updated', handleCustomUpdate);
    void supabase.removeChannel(channel);
  };
}
