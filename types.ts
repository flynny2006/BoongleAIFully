import { AVAILABLE_MODELS } from './constants';
import { User, Session, AuthError } from '@supabase/supabase-js'; // Added AuthError for explicit typing

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export interface ChatMessage {
  id: string; // UUID from Supabase or client-generated before save
  project_id: string; // Foreign key to Project
  sender: 'user' | 'ai' | 'system';
  text: string;
  project_files_snapshot?: Record<string, string>; // Stored as JSONB in Supabase
  timestamp: number | string; // Store as timestamptz, convert to number for client
  model_id_used?: ModelId;
  selected_element_context?: SelectedElementDetails; // Context if a message is about a selected element
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
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: AuthError | null }>;
  register: (email: string, pass: string, username: string) => Promise<{ error: AuthError | null; data?: { user: User | null; session: Session | null } }>; // Removed hCaptchaToken
  logout: () => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>; // Added OTP verification function
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

// For Element Inspector
export interface SelectedElementDetails {
  tagName: string;
  id: string | null;
  classList: string[];
  textSnippet: string | null; // First ~50 chars of innerText
  cssSelector: string; // Generated unique CSS selector for the element
  // A human-readable description for the AI, combining the above.
  descriptionForAI: string; 
}