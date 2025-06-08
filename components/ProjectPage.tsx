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
  // getPublishedProject, // No longer used directly here
  supabase 
} from '../services/supabaseService';
import { AVAILABLE_MODELS } from '../constants';
import { Chat } from '@google/genai';
import { useAuth } from '../contexts/AuthContext';

// Helper function moved to module scope
const getPublishedProjectByProjectId = async (projId: string): Promise<PublishedProject | null> => {
  const { data, error } = await supabase
    .from('published_projects')
    .select('*')
    .eq('project_id', projId)
    .maybeSingle(); 
  if (error && error.code !== 'PGRST116') throw error; 
  return data;
};

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth(); // session no longer needed directly here
  const navigate = useNavigate();

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  
  const [activeEditorFile, setActiveEditorFile] = useState<string>('index.html');
  const [activePreviewHtmlFile, setActivePreviewHtmlFile] = useState<string>('index.html');
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('preview');
  const [selectedModel, setSelectedModel] = useState<ModelId>(AVAILABLE_MODELS[0].id);

  const [isLoading, setIsLoading] = useState(true); 
  const [isAISending, setIsAISending] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);

  const [publishedInfo, setPublishedInfo] = useState<PublishedProject | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);


  const initializeChat = useCallback(async (modelToUse: ModelId, history: ChatMessage[]) => {
    setIsAISending(true); 
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
  }, []); // Removed dependencies that might cause re-creation, ensure stability


  // Load project data
  useEffect(() => {
    if (!projectId || !user) {
      navigate('/');
      return;
    }
    setIsLoading(true);
    setError(null);
    resetChatSession(); // Reset chat session when loading a new project

    Promise.all([
      getProjectById(projectId, user.id),
      fetchProjectFiles(projectId),
      fetchChatMessages(projectId)
    ]).then(async ([projectData, filesData, chatData]) => {
      if (!projectData) {
        setError("Project not found or you don't have access.");
        navigate('/'); 
        return;
      }
      setCurrentProject(projectData);
      setProjectFiles(filesData);
      
      setSelectedModel(projectData.model_id);
      setActiveEditorFile(projectData.active_editor_file || 'index.html');
      setActivePreviewHtmlFile(projectData.active_preview_html_file || 'index.html');
      setViewMode(projectData.view_mode || 'preview');

      // Initialize chat session with loaded history and model
      // Messages will be set after potential initial prompt
      // await initializeChat(projectData.model_id, chatData); // Moved to after potential initial prompt logic
      
      const pubInfo = await getPublishedProjectByProjectId(projectId);
      setPublishedInfo(pubInfo);

      // Handle initial project prompt or set messages
      if (chatData.length === 0 && projectData) { // Only if no messages exist for THIS project
        const systemMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
          project_id: projectData.id,
          sender: 'system',
          text: `New project: "${projectData.name}". Asking AI (${projectData.model_id}) for the first version...`,
        };
        const savedSysMsg = await addChatMessage(systemMessageData);
        setMessages([savedSysMsg]); // Set system message first
        
        // Ensure chat is initialized before sending the first message
        const sessionToUse = await initializeChat(projectData.model_id, [savedSysMsg]);
        if (sessionToUse) {
          const initialUserPrompt = `My project is named: "${projectData.name}". Description: "${projectData.description || 'Create a stylish, modern single-page application.'}". Please generate the initial HTML/React/Tailwind application. Ensure JavaScript, especially React with JSX, is correctly set up for in-browser transpilation (include React, ReactDOM, Babel). Output a simple, visually appealing landing page as 'index.html'. Focus on a great first impression.`;
          await handleSendMessage(initialUserPrompt, sessionToUse, [savedSysMsg]); // Pass session and current messages
        }
      } else {
        setMessages(chatData);
        await initializeChat(projectData.model_id, chatData); // Initialize with existing messages
      }


    }).catch(err => {
      console.error("Error loading project data:", err);
      setError(err.message || "Failed to load project data.");
    }).finally(() => {
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user, navigate]); // initializeChat removed


  const handleSendMessage = useCallback(async (messageText: string, existingSession?: Chat, currentMessages?: ChatMessage[]) => {
    if (!currentProject || !user) return;
    
    let sessionToUse = existingSession || chatSession;
    const messagesForHistory = currentMessages || messages;

    if (!sessionToUse) {
      console.warn("handleSendMessage: chatSession is null. Attempting to initialize.");
      try {
        sessionToUse = await initializeChat(selectedModel, messagesForHistory);
        if (!sessionToUse) {
             setError("Failed to initialize chat session for sending message.");
             setIsAISending(false);
             return;
        }
      } catch (e) { setIsAISending(false); return; }
    }
    
    const userMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
      project_id: currentProject.id,
      sender: 'user', text: messageText,
    };
    
    setIsAISending(true); // Set loading before DB and AI call
    setError(null);
    
    const savedUserMessage = await addChatMessage(userMessageData);
    setMessages(prev => [...prev, savedUserMessage]);
    
    try {
      // Pass the updated history including the new user message to sendMessageToAI if it reconstructs chat
      // Or rely on the sessionToUse (Chat object) maintaining its own history correctly
      const aiProjectStructure: AIProjectStructure = await sendMessageToAI(sessionToUse, messageText, selectedModel);
      
      if (!aiProjectStructure || !aiProjectStructure.files || typeof aiProjectStructure.files !== 'object' || typeof aiProjectStructure.aiMessage !== 'string') {
        throw new Error("AI response malformed or missing essential fields.");
      }
      
      await saveProjectFiles(currentProject.id, aiProjectStructure.files);
      setProjectFiles(aiProjectStructure.files);

      let newEntryPoint = aiProjectStructure.entryPoint || 'index.html';
      if (!aiProjectStructure.files[newEntryPoint] || !newEntryPoint.endsWith('.html')) {
        const htmlFiles = Object.keys(aiProjectStructure.files).filter(f => f.endsWith('.html'));
        newEntryPoint = htmlFiles.length > 0 ? htmlFiles[0] : (Object.keys(aiProjectStructure.files)[0] || 'index.html');
      }
      
      const prevHtmlFileExists = !!aiProjectStructure.files[activePreviewHtmlFile];
      const prevEditorFileExists = !!aiProjectStructure.files[activeEditorFile];

      const finalActivePreviewHtmlFile = prevHtmlFileExists ? activePreviewHtmlFile : newEntryPoint;
      const finalActiveEditorFile = prevEditorFileExists ? activeEditorFile : newEntryPoint;

      if (activePreviewHtmlFile !== finalActivePreviewHtmlFile) setActivePreviewHtmlFile(finalActivePreviewHtmlFile);
      if (activeEditorFile !== finalActiveEditorFile) setActiveEditorFile(finalActiveEditorFile);
      
      await updateProject(currentProject.id, { 
          active_preview_html_file: finalActivePreviewHtmlFile,
          active_editor_file: finalActiveEditorFile,
      }); // Update project with new active files and last_modified

      const aiMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'ai',
        text: aiProjectStructure.aiMessage,
        project_files_snapshot: aiProjectStructure.files,
        model_id_used: selectedModel,
      };
      const savedAiMessage = await addChatMessage(aiMessageData);
      setMessages(prev => [...prev, savedAiMessage]);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown AI error.";
      setError(`Failed to get AI response: ${errorMessage}`);
      const errorAiMsgData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'ai', text: `Error: ${errorMessage}. My apologies, I couldn't process that. The raw response might be in the console.`,
      };
      const savedErrorMsg = await addChatMessage(errorAiMsgData); // Save error message to chat
      setMessages(prev => [...prev, savedErrorMsg]);
    } finally {
      setIsAISending(false);
    }
  }, [chatSession, messages, selectedModel, currentProject, user, activePreviewHtmlFile, activeEditorFile, initializeChat]);


  const handlePreviewErrorForAI = useCallback(async (errorData: { message: string; stack?: string }) => {
    if (!currentProject || !user || !activePreviewHtmlFile) {
      setError("Cannot fix with AI: Project context or preview file is missing.");
      return;
    }

    const fileToFix = activePreviewHtmlFile;
    const fileContent = projectFiles[fileToFix];

    if (fileContent === undefined) {
      setError(`Cannot fix with AI: Content for ${fileToFix} not found.`);
      return;
    }

    const errorMessage = `The application preview encountered an error in the file '${fileToFix}'.
Error message: "${errorData.message}"
${errorData.stack ? `Stack trace: \n${errorData.stack}\n` : ''}
Here is the current content of '${fileToFix}':
\`\`\`html
${fileContent}
\`\`\`
Please analyze this error and the file content, then provide the corrected full content for '${fileToFix}'. Only provide the corrected file in your response. If other files are intricately linked and need changes, you can provide them too.
`;
    
    const systemMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'system',
        text: `Attempting to fix error in ${fileToFix} with AI... Error: ${errorData.message}`,
    };
    const savedSystemMsg = await addChatMessage(systemMessageData);
    setMessages(prev => [...prev, savedSystemMsg]);

    await handleSendMessage(errorMessage);

  }, [currentProject, user, activePreviewHtmlFile, projectFiles, handleSendMessage]);


  const handleModelChange = async (newModelId: ModelId) => {
    if (!currentProject || selectedModel === newModelId) return;
    
    setIsAISending(true); // Show loading while switching
    setSelectedModel(newModelId);
    resetChatSession(); 
    
    await updateProject(currentProject.id, { model_id: newModelId });
    
    const systemMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'system',
        text: `Switched to ${AVAILABLE_MODELS.find(m => m.id === newModelId)?.name || newModelId}. AI context reset.`,
    };
    const savedSysMsg = await addChatMessage(systemMessageData);
    // Pass new history to initializeChat, including the system message
    const newMessagesHistory = [...messages, savedSysMsg];
    setMessages(newMessagesHistory);
    
    try {
        await initializeChat(newModelId, newMessagesHistory);
    } catch(e) {
        // Error handled in initializeChat
    } finally {
        setIsAISending(false);
    }
  };

  const handleRestoreVersion = useCallback(async (messageId: string) => {
    if(!currentProject) return;
    const messageToRestore = messages.find(msg => msg.id === messageId);
    
    if (messageToRestore && messageToRestore.project_files_snapshot && messageToRestore.sender === 'ai') {
      setIsAISending(true); 
      setError(null);

      const restoreIndex = messages.findIndex(msg => msg.id === messageId);
      const newMessagesHistorySansFutureSystem = messages.slice(0, restoreIndex + 1); // Keep messages up to the one being restored
      
      const dbTimestampToRestore = new Date(messageToRestore.timestamp).toISOString();
      await deleteChatMessagesAfter(currentProject.id, dbTimestampToRestore);

      const systemRestoreMessageData: Omit<ChatMessage, 'id'|'timestamp'> = {
        project_id: currentProject.id,
        sender: 'system',
        text: `Restored project to version from ${new Date(messageToRestore.timestamp).toLocaleTimeString()}. AI context updated.`,
      };
      const savedSysMsg = await addChatMessage(systemRestoreMessageData);
      const finalNewMessagesHistory = [...newMessagesHistorySansFutureSystem, savedSysMsg];
      setMessages(finalNewMessagesHistory);
      
      await saveProjectFiles(currentProject.id, messageToRestore.project_files_snapshot);
      setProjectFiles(messageToRestore.project_files_snapshot);

      let entryPoint = 'index.html'; // Default
      if (messageToRestore.project_files_snapshot['index.html']) {
          // index.html exists, use it
      } else {
          const htmlFiles = Object.keys(messageToRestore.project_files_snapshot).filter(f => f.endsWith('.html'));
          if (htmlFiles.length > 0) entryPoint = htmlFiles[0];
          else if (Object.keys(messageToRestore.project_files_snapshot).length > 0) entryPoint = Object.keys(messageToRestore.project_files_snapshot)[0];
      }
      
      setActivePreviewHtmlFile(entryPoint);
      setActiveEditorFile(entryPoint);
      setViewMode('preview');

      await updateProject(currentProject.id, { 
        active_editor_file: entryPoint, 
        active_preview_html_file: entryPoint,
        view_mode: 'preview' 
      });
      
      resetChatSession();
      try {
        await initializeChat(selectedModel, finalNewMessagesHistory); // Use selectedModel (or messageToRestore.model_id_used if available and different)
      } catch (e) { /* handled in initializeChat */ }
      
      setIsAISending(false);
    } else {
      setError("Restore failed: Snapshot data missing or invalid message.");
    }
  }, [messages, selectedModel, currentProject, initializeChat]);

  const handleCodeChange = useCallback(async (filePath: string, newCode: string) => {
    if(!currentProject) return;
    const updatedFiles = { ...projectFiles, [filePath]: newCode };
    setProjectFiles(updatedFiles);
    await saveProjectFiles(currentProject.id, updatedFiles); // Debounce might be good here for performance
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
    if (!currentProject || Object.keys(projectFiles).length === 0 || !user) {
      setError("No files to publish or user not found.");
      return;
    }
    setIsPublishing(true);
    setError(null);
    try {
      const entryPoint = projectFiles[activePreviewHtmlFile] && activePreviewHtmlFile.endsWith('.html') ? activePreviewHtmlFile : 
                         (projectFiles['index.html'] ? 'index.html' : Object.keys(projectFiles).find(f => f.endsWith('.html')) || '');
      if (!entryPoint) {
        throw new Error("Cannot determine HTML entry point for publishing. Ensure an HTML file is set for preview or 'index.html' exists.");
      }

      const published = await publishProjectToSupabase(currentProject.id, user.id, projectFiles, entryPoint);
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
  
  if (!currentProject && !isLoading) { 
     return <div className="flex flex-col items-center justify-center h-screen bg-black text-red-400 p-4"><p>{error || "Project not found or access denied."}</p><button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Go Home</button></div>;
  }
  
  if (error && (error.toLowerCase().includes("api key") || error.toLowerCase().includes("api_key"))) { 
      return <div className="flex flex-col items-center justify-center h-screen bg-black text-red-400 p-4"><p>API Key Error: {error}</p><p>Please ensure your Gemini API Key is correctly configured as an environment variable (<code>process.env.API_KEY</code>).</p><button onClick={() => navigate(0)} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Reload App</button></div>;
  }


  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar 
        selectedModel={selectedModel} 
        onModelChange={handleModelChange} 
        isLoading={isAISending || isLoading} // Combine general loading with AI sending for TopBar disabling
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
            onPreviewError={handlePreviewErrorForAI}
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