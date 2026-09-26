import { createClient } from '@supabase/supabase-js';

const rawUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://hiqoxogyszhobixtytwn.supabase.co';

const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');

const rawKey =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' &&
    (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  'sb_publishable_gcfV40SqF7KDzld9zIlsRg_GaB7qDpf';

const supabaseKey = rawKey.trim();

export const supabase = createClient(supabaseUrl, supabaseKey);

