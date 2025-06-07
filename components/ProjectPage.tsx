
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatSidebar from './ChatSidebar';
import EditorPreview from './EditorPreview';
import TopBar from './TopBar';
import { ChatMessage, AIProjectStructure, ModelId, Project, PublishedProject } from '../types';
import { getOrCreateChatSession, sendMessageToAI, resetChatSession } from '../services/geminiService';
import { 
  getProjectById, 
  getProjectFiles as fetchProjectFiles, 
  saveProjectFiles,
  getChatMessages as fetchChatMessages,
  addChatMessage,
  deleteChatMessagesAfter,
  updateProject,
  publishProject as publishProjectToSupabase,
  getPublishedProject,
  supabase 
} from '../services/supabaseService';
import { AVAILABLE_MODELS } from '../constants';
import { Chat } from '@google/genai';
import { useAuth } from '../contexts/AuthContext';

// Helper function moved to module scope
const getPublishedProjectByProjectId = async (projId: string): Promise<PublishedProject | null> => {
  // This is a helper, actual Supabase query would be more complex if project_id isn't unique in published_projects
  // For now, assuming you might query by project_id if you decide it should be unique there.
  // If published_projects.id IS the public ID, we don't have it yet to fetch here.
  // So, let's assume published_projects table has a UNIQUE constraint on project_id for simplicity.
  const { data, error } = await supabase
    .from('published_projects')
    .select('*')
    .eq('project_id', projId)
    .maybeSingle(); // Use maybeSingle to handle 0 or 1 row
  if (error && error.code !== 'PGRST116') throw error; // PGRST116: 0 rows (no result) is not an error here
  return data;
};

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, session } = useAuth();
  const navigate = useNavigate();

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  
  const [activeEditorFile, setActiveEditorFile] = useState<string>('index.html');
  const [activePreviewHtmlFile, setActivePreviewHtmlFile] = useState<string>('index.html');
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('preview');
  const [selectedModel, setSelectedModel] = useState<ModelId>(AVAILABLE_MODELS[0].id);

  const [isLoading, setIsLoading] = useState(true); // Initial loading for project data
  const [isAISending, setIsAISending] = useState(false); // For AI responses
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);

  const [publishedInfo, setPublishedInfo] = useState<PublishedProject | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);


  const initializeChat = useCallback(async (modelToUse: ModelId, history: ChatMessage[]) => {
    setIsAISending(true); // Use isAISending for this specific loading state
    try {
      const sessionInstance = getOrCreateChatSession(history, modelToUse);
      setChatSession(sessionInstance);
      setError(null);
      return sessionInstance;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error during AI chat initialization.";
      setError(`Failed to initialize AI chat with ${modelToUse}: ${errMsg}.`);
      console.error("Chat session init error:", e);
      throw e;
    } finally {
      setIsAISending(false);
    }
  }, [setChatSession, setError, setIsAISending]);


  // Load project data
  useEffect(() => {
    if (!projectId || !user) {
      navigate('/');
      return;
    }
    setIsLoading(true);
    setError(null);

    Promise.all([
      getProjectById(projectId, user.id),
      fetchProjectFiles(projectId),
      fetchChatMessages(projectId)
    ]).then(async ([projectData, filesData, chatData]) => {
      if (!projectData) {
        setError("Project not found or you don't have access.");
        navigate('/'); // Or to a 404 page
        return;
      }
      setCurrentProject(projectData);
      setProjectFiles(filesData);
      setMessages(chatData);
      setSelectedModel(projectData.model_id);
      setActiveEditorFile(projectData.active_editor_file);
      setActivePreviewHtmlFile(projectData.active_preview_html_file);
      setViewMode(projectData.view_mode as 'editor' | 'preview');

      // Initialize chat session with loaded history and model
      await initializeChat(projectData.model_id, chatData);

      // Fetch existing publish info
      const pubInfo = await getPublishedProjectByProjectId(projectId);
      setPublishedInfo(pubInfo);

    }).catch(err => {
      console.error("Error loading project data:", err);
      setError(err.message || "Failed to load project data.");
    }).finally(() => {
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user, navigate]); // initializeChat removed to avoid loop if it changes identity too often


  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!currentProject || !user) return;
    let currentEffectiveSession = chatSession;

    if (!currentEffectiveSession) {
      console.warn("handleSendMessage: chatSession state is null. Attempting to initialize.");
      try {
        currentEffectiveSession = await initializeChat(selectedModel, messages);
      } catch (e) {setIsAISending(false); return; }
    }
    
    const userMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
      project_id: currentProject.id,
      sender: 'user', text: messageText,
    };
    // Optimistically add user message, but save to DB first
    const savedUserMessage = await addChatMessage(userMessageData);
    setMessages(prev => [...prev, savedUserMessage]);
    
    setIsAISending(true);
    setError(null);

    try {
      const aiProjectStructure: AIProjectStructure = await sendMessageToAI(currentEffectiveSession, messageText, selectedModel);
      
      if (!aiProjectStructure || !aiProjectStructure.files || typeof aiProjectStructure.files !== 'object' || typeof aiProjectStructure.aiMessage !== 'string') {
        throw new Error("AI response malformed.");
      }
      
      await saveProjectFiles(currentProject.id, aiProjectStructure.files);
      setProjectFiles(aiProjectStructure.files);

      let newEntryPoint = aiProjectStructure.entryPoint || 'index.html';
      if (!aiProjectStructure.files[newEntryPoint]) {
        const htmlFiles = Object.keys(aiProjectStructure.files).filter(f => f.endsWith('.html'));
        newEntryPoint = htmlFiles.length > 0 ? htmlFiles[0] : (Object.keys(aiProjectStructure.files)[0] || 'index.html');
      }
      
      const prevHtmlFileExists = !!aiProjectStructure.files[activePreviewHtmlFile];
      const prevEditorFileExists = !!aiProjectStructure.files[activeEditorFile];

      if (!prevHtmlFileExists) setActivePreviewHtmlFile(newEntryPoint);
      if (!prevEditorFileExists) setActiveEditorFile(newEntryPoint);
      
      const aiMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'ai',
        text: aiProjectStructure.aiMessage,
        project_files_snapshot: aiProjectStructure.files,
        model_id_used: selectedModel,
      };
      const savedAiMessage = await addChatMessage(aiMessageData);
      setMessages(prev => [...prev, savedAiMessage]);
      await updateProject(currentProject.id, {}); // Touch last_modified

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown AI error.";
      setError(`Failed to get AI response: ${errorMessage}`);
      const errorAiMsgData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'ai', text: `Error: ${errorMessage}`,
      };
      const savedErrorMsg = await addChatMessage(errorAiMsgData);
      setMessages(prev => [...prev, savedErrorMsg]);
    } finally {
      setIsAISending(false);
    }
  }, [chatSession, messages, selectedModel, currentProject, user, activePreviewHtmlFile, activeEditorFile, initializeChat]);


  // Initial project setup prompt
   useEffect(() => {
    if (currentProject && messages.length === 0 && user) { // Only if no messages exist for this project
      const setupProject = async () => {
        try {
          // Check if chat is initialized already for the current model
          let sessionToUse = chatSession;
          if (!sessionToUse) {
            sessionToUse = await initializeChat(currentProject.model_id, []);
          }
          
          const systemMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
            project_id: currentProject.id,
            sender: 'system',
            text: `New project: "${currentProject.name}". Asking AI (${currentProject.model_id}) for the first version...`,
          };
          const savedSysMsg = await addChatMessage(systemMessageData);
          setMessages(prev => [savedSysMsg, ...prev]);

          const initialUserPrompt = `My project is named: "${currentProject.name}". The description is: "${currentProject.description || 'No specific description provided yet.'}". Please generate the initial HTML/React/Tailwind application using model ${currentProject.model_id}. Ensure JavaScript, especially React with JSX, is correctly set up with Babel for in-browser transpilation. Output a simple, stylish landing page.`;
          
          // Ensure system message state is set before calling handleSendMessage
          // which relies on 'messages' state for history
          setTimeout(() => {
             handleSendMessage(initialUserPrompt);
          }, 0);

        } catch (e) {
          // Error handling is inside initializeChat or handleSendMessage
          console.error("Error during initial project setup send:", e);
        }
      };
      setupProject();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, user]); // messages removed to ensure it runs only once per project load IF messages empty


  const handleModelChange = async (newModelId: ModelId) => {
    if (!currentProject || selectedModel === newModelId) return;
    
    setSelectedModel(newModelId);
    resetChatSession(); 
    
    await updateProject(currentProject.id, { model_id: newModelId });
    
    const systemMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'system',
        text: `Switched to ${AVAILABLE_MODELS.find(m => m.id === newModelId)?.name || newModelId}. AI context reset.`,
    };
    const savedSysMsg = await addChatMessage(systemMessageData);
    setMessages(prev => [...prev, savedSysMsg]);
    
    await initializeChat(newModelId, [...messages, savedSysMsg]);
  };

  const handleRestoreVersion = useCallback(async (messageId: string) => {
    if(!currentProject) return;
    const messageToRestore = messages.find(msg => msg.id === messageId);
    
    if (messageToRestore && messageToRestore.project_files_snapshot && messageToRestore.sender === 'ai') {
      setIsAISending(true); // Use this for general loading during restore
      setError(null);

      const restoreIndex = messages.findIndex(msg => msg.id === messageId);
      const newMessagesHistory = messages.slice(0, restoreIndex + 1);
      
      // Delete messages in DB that came after the restored message's timestamp
      const dbTimestampToRestore = new Date(messageToRestore.timestamp).toISOString();
      await deleteChatMessagesAfter(currentProject.id, dbTimestampToRestore);

      const systemRestoreMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'system',
        text: `Restored project to version from ${new Date(messageToRestore.timestamp).toLocaleTimeString()}. AI context updated.`,
      };
      const savedSysMsg = await addChatMessage(systemRestoreMessageData);
      setMessages([...newMessagesHistory, savedSysMsg]);
      
      await saveProjectFiles(currentProject.id, messageToRestore.project_files_snapshot);
      setProjectFiles(messageToRestore.project_files_snapshot);

      let entryPoint = messageToRestore.project_files_snapshot['index.html'] ? 'index.html' : Object.keys(messageToRestore.project_files_snapshot).find(f => f.endsWith('.html')) || Object.keys(messageToRestore.project_files_snapshot)[0] || 'index.html';
      
      setActivePreviewHtmlFile(entryPoint);
      setActiveEditorFile(entryPoint);
      await updateProject(currentProject.id, { active_editor_file: entryPoint, active_preview_html_file: entryPoint });
      
      resetChatSession();
      await initializeChat(selectedModel, [...newMessagesHistory, savedSysMsg]);
      setViewMode('preview');
      await updateProject(currentProject.id, { view_mode: 'preview' });
      
      setIsAISending(false);
    } else {
      setError("Restore failed: Data missing.");
    }
  }, [messages, selectedModel, currentProject, initializeChat]);

  const handleCodeChange = useCallback(async (filePath: string, newCode: string) => {
    if(!currentProject) return;
    const updatedFiles = { ...projectFiles, [filePath]: newCode };
    setProjectFiles(updatedFiles);
    // Debounce this or save on blur/file switch in a real app for performance
    await saveProjectFiles(currentProject.id, updatedFiles);
  }, [projectFiles, currentProject]);

  const handleViewModeChange = async (mode: 'editor' | 'preview') => {
    setViewMode(mode);
    if(currentProject) await updateProject(currentProject.id, { view_mode: mode });
  }
  const handleActiveEditorFileChange = async (filePath: string) => {
    setActiveEditorFile(filePath);
    if(currentProject) await updateProject(currentProject.id, { active_editor_file: filePath });
  }
  const handleActivePreviewFileChange = async (filePath: string) => {
    setActivePreviewHtmlFile(filePath);
    if(currentProject) await updateProject(currentProject.id, { active_preview_html_file: filePath });
  }

  const handlePublish = async () => {
    if (!currentProject || Object.keys(projectFiles).length === 0) {
      setError("No files to publish.");
      return;
    }
    setIsPublishing(true);
    setError(null);
    try {
      const entryPoint = projectFiles[activePreviewHtmlFile] ? activePreviewHtmlFile : 
                         (projectFiles['index.html'] ? 'index.html' : Object.keys(projectFiles).find(f => f.endsWith('.html')) || '');
      if (!entryPoint) {
        throw new Error("Cannot determine HTML entry point for publishing.");
      }

      const published = await publishProjectToSupabase(currentProject.id, user!.id, projectFiles, entryPoint);
      setPublishedInfo(published);
      setShowPublishModal(true);
    } catch (err: any) {
      console.error("Error publishing project:", err);
      setError(err.message || "Failed to publish project.");
    } finally {
      setIsPublishing(false);
    }
  };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-black text-white"><div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div><p className="ml-4">Loading Project...</p></div>;
  }
  
  if (!currentProject && !isLoading) { // Project might be null after loading if not found
     return <div className="flex flex-col items-center justify-center h-screen bg-black text-red-400 p-4"><p>Project not found or access denied.</p><button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Go Home</button></div>;
  }
  
  if (error && error.toLowerCase().includes("api key")) { /* Handled by AuthProvider effectively */ }


  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar 
        selectedModel={selectedModel} 
        onModelChange={handleModelChange} 
        isLoading={isAISending} 
        projectName={currentProject?.name || "Loading..."}
        onPublish={handlePublish}
        isPublished={!!publishedInfo}
        isPublishing={isPublishing}
      />
      <div className="flex flex-grow overflow-hidden">
        <div className="w-1/3 max-w-md xl:max-w-lg flex-shrink-0 h-full">
          <ChatSidebar 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isLoading={isAISending}
            projectDescription={currentProject?.description || currentProject?.name || ""}
            onRestoreVersion={handleRestoreVersion}
          />
        </div>
        <div className="flex-grow h-full">
          <EditorPreview
            projectFiles={projectFiles}
            activeEditorFile={activeEditorFile}
            onActiveEditorFileChange={handleActiveEditorFileChange}
            activePreviewHtmlFile={activePreviewHtmlFile}
            onActivePreviewHtmlFileChange={handleActivePreviewFileChange}
            onCodeChange={handleCodeChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        </div>
      </div>
      {error && !error.toLowerCase().includes("api key") && (
        <div className="fixed bottom-4 right-4 bg-red-700 text-white p-4 rounded-lg shadow-xl max-w-md z-50">
          <p className="font-semibold">Error:</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="mt-2 text-xs underline">Dismiss</button>
        </div>
      )}
      {showPublishModal && publishedInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl max-w-lg w-full">
            <h3 className="text-2xl font-semibold text-purple-400 mb-4">Project Published!</h3>
            <p className="text-gray-300 mb-2">Your site is live at:</p>
            <input 
              type="text" 
              readOnly 
              value={`${window.location.origin}${window.location.pathname}#/view/${publishedInfo.id}`} 
              className="w-full p-2 mb-4 bg-gray-700 border border-gray-600 rounded text-white break-all"
              onFocus={(e) => e.target.select()}
            />
            <a 
                href={`#/view/${publishedInfo.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full text-center p-3 mb-4 bg-green-600 hover:bg-green-700 rounded text-white font-semibold transition-colors"
            >
                Open Published Site
            </a>
            <button 
              onClick={() => setShowPublishModal(false)}
              className="w-full p-3 bg-gray-600 hover:bg-gray-500 rounded text-white font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPage;
