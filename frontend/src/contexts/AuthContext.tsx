import React, { useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from './authContextCore';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Handle local mock auth persistence
        const localUid = localStorage.getItem('filmory_user_id');
        if (localUid === 'mock_uid_123') {
          setUser({ id: 'mock_uid_123', email: 'developer@filmory.app' } as User);
          setIsLoading(false);
          return;
        }
      }

      setSession(session);
      setUser(session?.user || null);
      if (session?.user) {
        localStorage.setItem('filmory_user_id', session.user.id);
      } else {
        localStorage.removeItem('filmory_user_id');
      }
      setIsLoading(false);
    });

    // Listen for changes on auth state (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
           const localUid = localStorage.getItem('filmory_user_id');
           if (localUid === 'mock_uid_123') return; // Do not overwrite mock user
        }
        
        setSession(session);
        setUser(session?.user || null);
        if (session?.user) {
          localStorage.setItem('filmory_user_id', session.user.id);
        } else {
          localStorage.removeItem('filmory_user_id');
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Temporary mock signin for development if Supabase keys aren't set yet
  const signInMock = () => {
    const mockUser = { id: 'mock_uid_123', email: 'developer@filmory.app' } as User;
    setUser(mockUser);
    localStorage.setItem('filmory_user_id', mockUser.id);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Real signout failed, clearing mock");
    } finally {
      setUser(null);
      localStorage.removeItem('filmory_user_id');
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signInMock,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};
