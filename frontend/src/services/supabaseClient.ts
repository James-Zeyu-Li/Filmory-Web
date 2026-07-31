import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials not found. Auth and Cloud functionality will not work until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local");
}

// Initialize and export the Supabase client.
// AuthCallbackView owns URL session detection so it can preserve auth_intent/next
// before tokens are persisted and the user is routed to the next auth step.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: false,
  },
});
