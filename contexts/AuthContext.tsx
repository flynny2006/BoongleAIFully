import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase, getProfile, updateProfile } from '../services/supabaseService';
import { Session, User as SupabaseUser, AuthError } from '@supabase/supabase-js';
import { AuthContextType, Profile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserSessionAndProfile = async () => {
      setLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        try {
          const userProfile = await getProfile(currentUser.id);
          setProfile(userProfile);
          setUserApiKey(userProfile?.gemini_api_key || null);
        } catch (error) {
          console.error("Error fetching user profile on initial load:", error);
          // Potentially set an error state for the UI if profile fetch fails
        }
      } else {
        setProfile(null);
        setUserApiKey(null);
      }
      setLoading(false);
    };

    fetchUserSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setLoading(true); // Set loading true while auth state and profile are being updated
      setSession(newSession);
      const newAuthUser = newSession?.user ?? null;
      setUser(newAuthUser);

      if (newAuthUser) {
        try {
          const userProfile = await getProfile(newAuthUser.id);
          setProfile(userProfile);
          setUserApiKey(userProfile?.gemini_api_key || null);
        } catch (error) {
          console.error("Error fetching user profile on auth state change:", error);
          setProfile(null); // Clear profile on error
          setUserApiKey(null);
        }
      } else {
        setProfile(null);
        setUserApiKey(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Profile and API key will be fetched by onAuthStateChange listener
    setLoading(false); // Listener will set loading false after profile fetch
    return { error };
  };

  const register = async (email: string, password: string, username: string): Promise<{ error: AuthError | null }> => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { data: { username: username } } 
    });
    // Profile and API key will be created by trigger and fetched by onAuthStateChange
    setLoading(false);
    return { error };
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    await supabase.auth.signOut();
    // User, profile, and API key will be cleared by onAuthStateChange
    setLoading(false); // Listener will set loading false
  };

  const updateUserApiKey = async (apiKey: string): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error("User not logged in") };
    setLoading(true);
    try {
      const updatedProfile = await updateProfile(user.id, { gemini_api_key: apiKey });
      setProfile(updatedProfile);
      setUserApiKey(updatedProfile.gemini_api_key || null);
      setLoading(false);
      return { error: null };
    } catch (e) {
      const error = e instanceof Error ? e : new Error("Failed to update API key");
      console.error("Error updating API key:", error);
      setLoading(false);
      return { error };
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    login,
    register,
    logout,
    updateUserApiKey,
    userApiKey,
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