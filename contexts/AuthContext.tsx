import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabaseService';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // If event is 'USER_UPDATED' or 'SIGNED_IN' and email is confirmed, it means OTP was successful
      // For instance, if _event === 'USER_UPDATED' && session?.user?.email_confirmed_at
      if (_event === 'SIGNED_IN' && session?.user) {
         // User signed in, could be after OTP verification
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string):Promise<{ error: AuthError | null }> => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    return { error };
  };

  const register = async (email: string, password: string, username: string): Promise<{ error: AuthError | null; data?: { user: User | null; session: Session | null } }> => {
    setLoading(true);
    // Supabase will handle CAPTCHA challenge if it's configured in Supabase Auth settings.
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { 
        data: { username: username },
        // emailRedirectTo: window.location.origin, // Optional: for email confirmation link, not OTP usually
      } 
    });
    setLoading(false);
    return { data: data ? { user: data.user, session: data.session } : undefined, error };
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const verifyEmailOtp = async (email: string, token: string): Promise<{ error: AuthError | null }> => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    // On successful verification, Supabase typically updates the user's email_confirmed_at status
    // and the onAuthStateChange listener will receive an event (often USER_UPDATED or SIGNED_IN).
    // The session might be updated, logging the user in.
    setLoading(false);
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    login,
    register,
    logout,
    verifyEmailOtp, // Added here
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};