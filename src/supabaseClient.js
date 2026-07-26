import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[v0] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY to enable authentication.'
  );
}

// Create a stub client if config is missing, so landing/UI always loads
let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('[v0] Failed to initialize Supabase:', e.message);
    supabase = null;
  }
} else {
  // Stub object that allows the app to check isSupabaseConfigured before using supabase
  supabase = {
    auth: {
      onAuthStateChange: () => ({
        data: {
          subscription: { unsubscribe: () => {} },
        },
      }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  };
}

export { supabase };
