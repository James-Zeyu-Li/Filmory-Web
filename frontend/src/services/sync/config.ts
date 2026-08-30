export const isLocalSupabaseUrl = (url: string) => (
  url.includes('127.0.0.1:54321') || url.includes('localhost:54321')
);

export const hasValidSupabaseKeyPair = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (isLocalSupabaseUrl(supabaseUrl)) return supabaseAnonKey.startsWith('eyJ');
  return supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('eyJ');
};

export const hasAutoSyncFlag = () => import.meta.env.VITE_ENABLE_SUPABASE_SYNC === 'true';
