import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Project, ProjectFile, ChatMessage, PublishedProject, Profile } from '../types';

// TODO: Replace with environment variables in a real deployment
const supabaseUrl = 'https://qepczquvetguuzcdmxry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcGN6cXV2ZXRndXV6Y2RteHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTU1MzEsImV4cCI6MjA2NDg5MTUzMX0.W6lLN5Ci35kmJ2lzPnYuwFPlQeTdasC4T3ebXkRlPQY';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// --- Profile Functions ---
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116: 0 rows is not an error for a profile
    console.error('Error fetching profile:', error);
    throw error;
  }
  return data;
};

export const updateProfile = async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
};


// --- Project Functions ---
export const getUserProjects = async (userId: string): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('last_modified', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getProjectById = async (projectId: string, userId: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116: 0 rows
    console.error('Error fetching project by ID:', error);
    throw error;
  }
  return data;
};

export const createProject = async (projectData: Omit<Project, 'id' | 'user_id' | 'created_at' | 'last_modified'>, userId: string): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ ...projectData, user_id: userId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, last_modified: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  if (error) throw error;
};

// --- Project File Functions ---
export const getProjectFiles = async (projectId: string): Promise<Record<string, string>> => {
  const { data, error } = await supabase
    .from('project_files')
    .select('file_path, content')
    .eq('project_id', projectId);
  if (error) throw error;
  
  const filesRecord: Record<string, string> = {};
  (data || []).forEach(file => {
    filesRecord[file.file_path] = file.content;
  });
  return filesRecord;
};

export const saveProjectFiles = async (projectId: string, files: Record<string, string>): Promise<void> => {
  const { error: deleteError } = await supabase
    .from('project_files')
    .delete()
    .eq('project_id', projectId);
  if (deleteError) throw deleteError;

  const fileEntries = Object.entries(files).map(([filePath, content]) => ({
    project_id: projectId,
    file_path: filePath,
    content: content,
  }));

  if (fileEntries.length > 0) {
    const { error: insertError } = await supabase
      .from('project_files')
      .insert(fileEntries);
    if (insertError) throw insertError;
  }
  await updateProject(projectId, {});
};

// --- Chat Message Functions ---
export const getChatMessages = async (projectId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return (data || []).map(msg => ({ ...msg, timestamp: new Date(msg.timestamp).getTime() }));
};

export const addChatMessage = async (message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{ ...message, timestamp: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return { ...data, timestamp: new Date(data.timestamp).getTime() };
};

export const deleteChatMessagesAfter = async (projectId: string, timestamp: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('project_id', projectId)
    .gt('timestamp', timestamp);
  if (error) throw error;
};

// --- Publishing Functions ---
export const publishProject = async (
  projectId: string,
  userId: string,
  filesSnapshot: Record<string, string>,
  entryPointFile: string
): Promise<PublishedProject> => {
  const { data: existing, error: fetchError } = await supabase
    .from('published_projects')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  if (existing) {
    const { data, error } = await supabase
      .from('published_projects')
      .update({ files_snapshot: filesSnapshot, entry_point_file: entryPointFile, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('published_projects')
      .insert([{ project_id: projectId, user_id: userId, files_snapshot: filesSnapshot, entry_point_file: entryPointFile }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const getPublishedProject = async (publishId: string): Promise<PublishedProject | null> => {
  const { data, error } = await supabase
    .from('published_projects')
    .select('*')
    .eq('id', publishId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};