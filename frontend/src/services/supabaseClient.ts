import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials not found. Auth and Cloud functionality will not work until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local");
}

// Initialize and export the Supabase client.
// PKCE keeps email verification and password recovery redirects on the
// explicit /auth/callback route instead of relying on hash-token fallbacks.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
});
