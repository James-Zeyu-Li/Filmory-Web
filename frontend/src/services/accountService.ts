import { supabase } from './supabaseClient';

export const deleteCurrentAccount = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user) {
    throw new Error('An authenticated session is required to delete this account.');
  }

  const { error } = await supabase.rpc('delete_user');
  if (error) throw error;
};
