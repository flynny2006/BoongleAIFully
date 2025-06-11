import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Project, ProjectFile, ChatMessage, PublishedProject } from '../types';

// Updated with new user-provided details
const supabaseUrl = 'https://xmeowpghsbnyfeemdtsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZW93cGdoc2JueWZlZW1kdHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MzI0ODcsImV4cCI6MjA2NTIwODQ4N30.8AcwOuvLCelhvST0BP-w022iRT2huheOVwIsPZH1uuM';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// --- Auth Functions (delegated to AuthContext, but client is here) ---

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

// Updated function to delete project and all its related data
export const deleteProjectAndRelatedData = async (projectId: string, userId: string): Promise<void> => {
  // Verify user owns the project before deletion (optional, but good practice if not handled by RLS)
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or user does not have permission to delete it.");
  }

  // 1. Delete related published projects
  const { error: deletePublishedError } = await supabase
    .from('published_projects')
    .delete()
    .eq('project_id', projectId);
  if (deletePublishedError) {
    console.error("Error deleting published project data:", deletePublishedError);
    throw new Error(`Failed to delete published project data: ${deletePublishedError.message}`);
  }

  // 2. Delete related chat messages
  const { error: deleteMessagesError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('project_id', projectId);
  if (deleteMessagesError) {
    console.error("Error deleting chat messages:", deleteMessagesError);
    throw new Error(`Failed to delete chat messages: ${deleteMessagesError.message}`);
  }

  // 3. Delete related project files
  const { error: deleteFilesError } = await supabase
    .from('project_files')
    .delete()
    .eq('project_id', projectId);
  if (deleteFilesError) {
    console.error("Error deleting project files:", deleteFilesError);
    throw new Error(`Failed to delete project files: ${deleteFilesError.message}`);
  }

  // 4. Delete the project itself
  const { error: deleteProjectError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  if (deleteProjectError) {
    console.error("Error deleting project:", deleteProjectError);
    throw new Error(`Failed to delete project: ${deleteProjectError.message}`);
  }
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

// Upserts all project files. Deletes existing ones for the project first for simplicity.
// A more granular approach would be to diff and update/insert/delete individual files.
export const saveProjectFiles = async (projectId: string, files: Record<string, string>): Promise<void> => {
  // Delete existing files for this project
  const { error: deleteError } = await supabase
    .from('project_files')
    .delete()
    .eq('project_id', projectId);
  if (deleteError) throw deleteError;

  // Insert new files
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
   // Update project's last_modified timestamp
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
    .gt('timestamp', timestamp); // timestamp is ISO string from Supabase
  if (error) throw error;
};


// --- Publishing Functions ---
export const publishProject = async (
  projectId: string,
  userId: string,
  filesSnapshot: Record<string, string>,
  entryPointFile: string
): Promise<PublishedProject> => {
  // Check if already published (by project_id, assuming one live version per project)
  const { data: existing, error: fetchError } = await supabase
    .from('published_projects')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // PGRST116: 0 rows

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('published_projects')
      .update({ files_snapshot: filesSnapshot, entry_point_file: entryPointFile, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Create new
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