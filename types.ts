import { AVAILABLE_MODELS } from './constants';
import { User as SupabaseUser, Session } from '@supabase/supabase-js'; // Aliased to avoid conflict if User is defined locally

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

// Extended profile information, including the API key
export interface Profile {
  id: string; // UUID, matches auth.users.id
  username?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
  gemini_api_key?: string | null; // User's own Gemini API key
}

export interface ChatMessage {
  id: string; // UUID from Supabase or client-generated before save
  project_id: string; // Foreign key to Project
  sender: 'user' | 'ai' | 'system';
  text: string;
  project_files_snapshot?: Record<string, string>; // Stored as JSONB in Supabase
  timestamp: number | string; // Store as timestamptz, convert to number for client
  model_id_used?: ModelId;
}

export interface AIProjectStructure {
  files: Record<string, string>;
  entryPoint?: string;
  aiMessage: string;
}

// Corresponds to the 'projects' table in Supabase
export interface Project {
  id: string; // UUID
  user_id: string;
  name: string;
  description?: string | null;
  model_id: ModelId;
  active_editor_file: string;
  active_preview_html_file: string;
  view_mode: 'editor' | 'preview';
  created_at: string;
  last_modified: string;
}

// Corresponds to 'project_files' table
export interface ProjectFile {
  id: string; // UUID
  project_id: string;
  file_path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// For AuthContext
export interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null; // Full user profile including API key
  session: Session | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  register: (email: string, pass: string, username: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUserApiKey: (apiKey: string) => Promise<{ error: Error | null }>;
  userApiKey: string | null; // Convenience accessor for the key
}

// For published projects
export interface PublishedProject {
  id: string; // public view ID
  project_id: string;
  user_id: string;
  files_snapshot: Record<string, string>; // The actual files
  entry_point_file: string;
  created_at: string;
  updated_at: string;
}