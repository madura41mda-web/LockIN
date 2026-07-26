import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  // Don't crash the whole app (including the public landing page) when the
  // Supabase credentials are missing — auth features will simply be disabled.
  console.warn(
    '[v0] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY to enable authentication.'
  );
}

// Fall back to harmless placeholder values so createClient() doesn't throw at
// module load. Any auth call will fail gracefully instead of blanking the app.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'public-anon-placeholder-key'
);
