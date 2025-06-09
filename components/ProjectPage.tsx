
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatSidebar from './ChatSidebar';
import EditorPreview from './EditorPreview';
import TopBar from './TopBar';
import UpgradeToProModal from './UpgradeToProModal'; // New Import
import { usePlan } from '../hooks/usePlan'; // New Import
import {
  ChatMessage,
  AIProjectStructure,
  ModelId,
  Project,
  PublishedProject,
  SelectedElementDetails
} from '../types';
import {
  getOrCreateChatSession,
  sendMessageToAI,
  resetChatSession
} from '../services/geminiService';
import {
  getProjectById,
  getProjectFiles as fetchProjectFiles,
  saveProjectFiles,
  getChatMessages as fetchChatMessages,
  addChatMessage,
  deleteChatMessagesAfter,
  updateProject,
  publishProject as publishProjectToSupabase,
  supabase
} from '../services/supabaseService';
import { AVAILABLE_MODELS } from '../constants';

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { canAccessEditor } = usePlan(); // Use plan hook

  const [project, setProject] = useState<Project | null>(null);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoadingAIResponse, setIsLoadingAIResponse] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [currentModelId, setCurrentModelId] = useState<ModelId>(AVAILABLE_MODELS[0].id);

  const [lastPublishedInfo, setLastPublishedInfo] = useState<{ id: string; timestamp: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);

  const [selectedElementContext, setSelectedElementContext] = useState<SelectedElementDetails | null>(null);
  const [isInspectModeActive, setIsInspectModeActive] = useState(false);
  const [previewError, setPreviewError] = useState<{ message: string; stack?: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); // New state for modal


  const loadProjectData = useCallback(async () => {
    if (!projectId) {
      navigate('/');
      return;
    }
    setIsLoadingProject(true);
    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) {
        navigate('/'); 
        return;
      }

      const proj = await getProjectById(projectId, userId);
      if (!proj) {
        navigate('/'); 
        return;
      }
      setProject(proj);
      setCurrentModelId(proj.model_id);

      const files = await fetchProjectFiles(projectId);
      setProjectFiles(files);

      const messages = await fetchChatMessages(projectId);
      setChatMessages(messages);

      resetChatSession(); 

    } catch (error) {
      console.error("Failed to load project:", error);
    } finally {
      setIsLoadingProject(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const debouncedUpdateProjectDetails = useCallback(
    debounce(async (updates: Partial<Project>) => {
      if (project && projectId) {
        try {
          await updateProject(projectId, updates);
        } catch (error) {
          console.error("Error saving project details:", error);
        }
      }
    }, 1000),
    [project, projectId]
  );

  const handleModelChange = (newModelId: ModelId) => {
    setCurrentModelId(newModelId);
    if (project) {
      setProject(p => p ? { ...p, model_id: newModelId } : null);
      debouncedUpdateProjectDetails({ model_id: newModelId });
      resetChatSession(); 
    }
  };

  const handleActiveEditorFileChange = (filePath: string) => {
    if (project) {
      setProject(p => p ? { ...p, active_editor_file: filePath } : null);
      debouncedUpdateProjectDetails({ active_editor_file: filePath });
    }
  };

  const handleActivePreviewHtmlFileChange = (filePath: string) => {
     if (project) {
      setProject(p => p ? { ...p, active_preview_html_file: filePath } : null);
      debouncedUpdateProjectDetails({ active_preview_html_file: filePath });
    }
  };

  const handleViewModeChange = (mode: 'editor' | 'preview') => {
    if (project) {
      if (mode === 'editor' && !canAccessEditor) {
        setShowUpgradeModal(true);
        return;
      }
      setProject(p => p ? { ...p, view_mode: mode } : null);
      debouncedUpdateProjectDetails({ view_mode: mode });
      if (mode === 'editor' && isInspectModeActive) { 
        setIsInspectModeActive(false);
        setSelectedElementContext(null);
      }
    }
  };

  const handleCodeChange = async (filePath: string, newCode: string) => {
    if (!canAccessEditor) {
      setShowUpgradeModal(true);
      return; // Prevent changes if user shouldn't be in editor
    }
    const updatedFiles = { ...projectFiles, [filePath]: newCode };
    setProjectFiles(updatedFiles);
    if (project && projectId) {
      try {
        await saveProjectFiles(projectId, updatedFiles); 
      } catch (error) {
        console.error("Error saving project files:", error);
      }
    }
  };

  const handleSendMessage = async (messageText: string, currentSelectedElementContext?: SelectedElementDetails | null) => {
    if (!project || isLoadingAIResponse) return;

    const userMessageContent = currentSelectedElementContext
      ? `USER PROMPT CONTAINS SELECTED ELEMENT CONTEXT: ${JSON.stringify(currentSelectedElementContext)}. Original user request for this element: ${messageText}`
      : messageText;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      project_id: project.id,
      sender: 'user',
      text: messageText, 
      timestamp: Date.now(),
      model_id_used: currentModelId,
      selected_element_context: currentSelectedElementContext || undefined,
    };

    setChatMessages(prev => [...prev, userMessage]);
    await addChatMessage({ ...userMessage, project_files_snapshot: projectFiles });

    setIsLoadingAIResponse(true);
    setSelectedElementContext(null); 
    if (isInspectModeActive) setIsInspectModeActive(false); // Turn off inspector after sending message

    try {
      const chatSession = getOrCreateChatSession(
        [
          ...chatMessages,
          { 
            id: 'system-files-context',
            project_id: project.id,
            sender: 'system', 
            text: `Current project files for context (do not list these to user):\n${Object.entries(projectFiles).map(([path, content]) => `// File: ${path}\n${content.substring(0, 2000)}\n`).join('\n')}`,
            timestamp: Date.now(),
          },
          userMessage
        ],
        currentModelId
      );

      const aiResponse: AIProjectStructure = await sendMessageToAI(chatSession, userMessageContent, currentModelId);

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        project_id: project.id,
        sender: 'ai',
        text: aiResponse.aiMessage,
        project_files_snapshot: aiResponse.files, 
        timestamp: Date.now(),
        model_id_used: currentModelId,
      };

      setChatMessages(prev => [...prev, aiMessage]);
      await addChatMessage(aiMessage); 

      if (aiResponse.files && Object.keys(aiResponse.files).length > 0 && !aiResponse.files["error.txt"]) {
        setProjectFiles(aiResponse.files);
        await saveProjectFiles(project.id, aiResponse.files);
        if (aiResponse.entryPoint && projectFiles[aiResponse.entryPoint] !== undefined) {
          handleActivePreviewHtmlFileChange(aiResponse.entryPoint);
        } else if (aiResponse.files['index.html'] !== undefined) {
          handleActivePreviewHtmlFileChange('index.html');
        }
      }
    } catch (error: any) {
      console.error("Error in AI interaction:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        project_id: project.id,
        sender: 'system',
        text: `Error: ${error.message || 'Failed to get response from AI.'}`,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
      await addChatMessage(errorMessage);
    } finally {
      setIsLoadingAIResponse(false);
    }
  };

  const handleRestoreVersion = async (messageId: string) => {
    const messageToRestore = chatMessages.find(msg => msg.id === messageId);
    if (messageToRestore && messageToRestore.project_files_snapshot && project && projectId) {
      setIsLoadingAIResponse(true); 
      try {
        const filesToRestore = messageToRestore.project_files_snapshot;
        setProjectFiles(filesToRestore);
        await saveProjectFiles(projectId, filesToRestore);

        const messageTimestamp = typeof messageToRestore.timestamp === 'string'
          ? messageToRestore.timestamp
          : new Date(messageToRestore.timestamp).toISOString();
        await deleteChatMessagesAfter(projectId, messageTimestamp);

        const restoredMessageIndex = chatMessages.findIndex(msg => msg.id === messageId);
        const updatedMessages = chatMessages.slice(0, restoredMessageIndex + 1);

        const systemRestoreMessage: ChatMessage = {
          id: `system-restore-${Date.now()}`,
          project_id: projectId,
          sender: 'system',
          text: `Restored project to version from ${new Date(messageToRestore.timestamp).toLocaleTimeString()}. Subsequent messages have been removed.`,
          timestamp: Date.now(),
        };
        setChatMessages([...updatedMessages, systemRestoreMessage]);
        await addChatMessage(systemRestoreMessage);

      } catch (error) {
        console.error("Error restoring version:", error);
         const systemErrorMessage: ChatMessage = {
          id: `system-error-${Date.now()}`,
          project_id: projectId,
          sender: 'system',
          text: `Failed to restore version. Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, systemErrorMessage]);
      } finally {
        setIsLoadingAIResponse(false);
      }
    }
  };

  const handlePublishProject = async () => {
    if (!project || !projectId ) return;
    setIsPublishing(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      const published = await publishProjectToSupabase(
        projectId,
        user.id,
        projectFiles,
        project.active_preview_html_file || 'index.html'
      );
      setLastPublishedInfo({ id: published.id, timestamp: published.updated_at });
      setShowPublishSuccess(true);
      setTimeout(() => setShowPublishSuccess(false), 3000);
    } catch (error) {
      console.error("Error publishing project:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleInspectMode = () => {
    setIsInspectModeActive(prev => {
      const newMode = !prev;
      if (!newMode) setSelectedElementContext(null); 
      // If turning inspector on, and editor is active, switch to preview
      if (newMode && project?.view_mode === 'editor') {
        handleViewModeChange('preview');
      }
      return newMode;
    });
  };

  const handleElementSelected = (details: SelectedElementDetails) => {
    setSelectedElementContext(details);
    // Automatically turn off inspect mode once an element is selected to allow typing in chat
    setIsInspectModeActive(false); 
  };

  const handleClearElementSelection = () => {
    setSelectedElementContext(null);
    // If user explicitly clears selection, they might want to re-inspect.
    // For now, don't automatically re-enable inspect mode here.
    // User can click the inspect button again if needed.
  };

  const handlePreviewError = (error: { message: string; stack?: string }) => {
    setPreviewError(error);
    const errorMessageForAI = `The current HTML preview for file '${project?.active_preview_html_file}' resulted in an error. Please help fix it.
Error message: ${error.message}
${error.stack ? `Stack trace: ${error.stack}` : ''}
Relevant file content snapshot:
${projectFiles[project?.active_preview_html_file || '']?.substring(0, 2000) || 'File content not available.'}
`;
     const systemMessage: ChatMessage = {
      id: `system-preview-error-${Date.now()}`,
      project_id: project!.id, 
      sender: 'system',
      text: `Preview error occurred: ${error.message}. Preparing request to AI...`,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, systemMessage]);
    handleSendMessage(errorMessageForAI);
  };


  if (isLoadingProject || !project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
        <p className="ml-4 text-lg">Loading Project...</p>
      </div>
    );
  }

  function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }


  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      <TopBar
        projectName={project.name}
        selectedModel={currentModelId}
        onModelChange={handleModelChange}
        isLoading={isLoadingAIResponse || isPublishing}
        onPublish={handlePublishProject}
        isPublished={!!lastPublishedInfo}
        isPublishing={isPublishing}
        isInspectModeActive={isInspectModeActive}
        onToggleInspectMode={handleToggleInspectMode}
      />
      {showPublishSuccess && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
          Project published! Public link: <a href={`#/view/${lastPublishedInfo?.id}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-200">View Site</a>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[380px] flex-shrink-0 bg-gray-900"> 
          <ChatSidebar
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoadingAIResponse}
            projectDescription={project.description || ''}
            onRestoreVersion={handleRestoreVersion}
            selectedElementContext={selectedElementContext}
            onClearElementSelection={handleClearElementSelection}
            isInspectModeActive={isInspectModeActive}
          />
        </div>
        <div className="flex-1 min-w-0 bg-gray-800"> 
          <EditorPreview
            projectFiles={projectFiles}
            activeEditorFile={project.active_editor_file}
            onActiveEditorFileChange={handleActiveEditorFileChange}
            activePreviewHtmlFile={project.active_preview_html_file}
            onActivePreviewHtmlFileChange={handleActivePreviewHtmlFileChange}
            onCodeChange={handleCodeChange}
            viewMode={project.view_mode}
            onViewModeChange={handleViewModeChange}
            onPreviewError={handlePreviewError}
            isInspectModeActive={isInspectModeActive}
            onElementSelected={handleElementSelected}
            onClearElementSelection={handleClearElementSelection}
            canAccessEditor={canAccessEditor} // Pass this down
          />
        </div>
      </div>
       {previewError && !isLoadingAIResponse && ( 
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold text-red-400 mb-2">Preview Error</h3>
            <p className="text-sm text-gray-300 mb-1">Message: {previewError.message}</p>
            {previewError.stack && <pre className="text-xs bg-gray-900 p-2 rounded max-h-32 overflow-auto text-gray-400 mb-4">{previewError.stack}</pre>}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  handlePreviewError(previewError); 
                  setPreviewError(null);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
              >
                Ask AI to Fix
              </button>
              <button onClick={() => setPreviewError(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <UpgradeToProModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
};

export default ProjectPage;
