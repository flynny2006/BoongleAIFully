
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChatSidebar from './ChatSidebar';
import EditorPreview from './EditorPreview';
import TopBar from './TopBar';
import UpgradeToProModal from './UpgradeToProModal'; 
import { usePlan } from '../hooks/usePlan'; 
import {
  ChatMessage,
  AIProjectStructure,
  ModelId,
  Project,
  PublishedProject,
  SelectedElementDetails
} from '../types';
import { TerminalLine } from './TerminalDisplay'; // Import TerminalLine
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

// Helper function moved outside the component
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
} // REMOVED Semicolon from here

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { canAccessEditor } = usePlan(); 

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); 

  const [activeUITab, setActiveUITab] = useState<'editor' | 'preview' | 'terminal'>('preview');
  const [terminalOutput, setTerminalOutput] = useState<TerminalLine[]>([]);

  const addTerminalLine = useCallback((line: string, type: TerminalLine['type']) => {
    setTerminalOutput(prev => [...prev, { line, type, timestamp: Date.now() }]);
  }, []);

  const clearTerminalOutput = useCallback(() => {
    setTerminalOutput([]);
    addTerminalLine("Terminal cleared.", 'system');
  }, [addTerminalLine]);

  const simulateNpmRunDev = useCallback(async () => {
    setIsLoadingAIResponse(true); // Disable terminal input during simulation
    addTerminalLine("Starting build process...", 'system');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate npm install (approx 3-4 seconds)
    addTerminalLine("npm install", 'input');
    await new Promise(resolve => setTimeout(resolve, 200));
    addTerminalLine(">", 'output');
    const packages = Math.floor(Math.random() * 50) + 1200; 
    const contributors = Math.floor(Math.random() * 20) + 70; 
    const installTime = (Math.random() * 1.5 + 2.5).toFixed(2); // 2.5s to 4.0s

    addTerminalLine("resolving packages...", 'output');
    await new Promise(resolve => setTimeout(resolve, 700));
    addTerminalLine("fetching packages...", 'output');
    await new Promise(resolve => setTimeout(resolve, 1000));
    let progressBar = "";
    for (let i = 0; i < 20; i++) {
        progressBar += ".";
        addTerminalLine(`[${progressBar.padEnd(20, ' ')}] processing (${Math.floor((i/20)*100)}%)`, 'output');
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    addTerminalLine(`added ${packages} packages from ${contributors} contributors and audited ${packages} packages in ${installTime}s`, 'output');
    await new Promise(resolve => setTimeout(resolve, 200));
    const fundingPackages = Math.floor(Math.random() * 10) + 20; 
    addTerminalLine(`${fundingPackages} packages are looking for funding`, 'output');
    addTerminalLine("  run `npm fund` for details", 'output');
    await new Promise(resolve => setTimeout(resolve, 100));
    addTerminalLine("found 0 vulnerabilities", 'output');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate npm run dev (Vite style)
    addTerminalLine("npm run dev", 'input');
    await new Promise(resolve => setTimeout(resolve, 200));
    addTerminalLine(">", 'output');
    addTerminalLine(`> ${project?.name?.toLowerCase().replace(/\s+/g, '-') || 'my-app'}@0.0.0 dev`, 'output');
    addTerminalLine("> vite", 'output');
    await new Promise(resolve => setTimeout(resolve, 300));
    const viteReadyTime = Math.floor(Math.random() * 300) + 400; 
    addTerminalLine(`  VITE v5.2.x  ready in ${viteReadyTime} ms`, 'output');
    await new Promise(resolve => setTimeout(resolve, 100));
    addTerminalLine("  ➜  Local:   http://localhost:5173/", 'output');
    addTerminalLine("  ➜  Network: use --host to expose", 'output');
    addTerminalLine("  ➜  Press h + enter to show help", 'output');
    addTerminalLine("Build successful. Preview is updated.", 'success');
    setIsLoadingAIResponse(false); 
  }, [addTerminalLine, project?.name]);
  
  const handleTerminalCommand = useCallback((command: string) => {
    addTerminalLine(command, 'input'); 
    const lowerCmd = command.toLowerCase().trim();
    if (lowerCmd === 'clear' || lowerCmd === 'cls') {
      clearTerminalOutput();
    } else if (lowerCmd.startsWith('npm run') || lowerCmd.startsWith('npm start') || lowerCmd === 'npm install && npm run dev' || lowerCmd === 'npm install') {
      simulateNpmRunDev();
    } else if (lowerCmd === 'help') {
      addTerminalLine("Available commands:\n  clear / cls          - Clears the terminal\n  npm run dev          - Simulates project build & run\n  npm install          - Simulates package installation\n  help                 - Shows this help message\n  echo [text]          - Prints text to terminal\n  date                 - Displays current date and time", 'output');
    } else if (lowerCmd.startsWith('echo ')) {
      addTerminalLine(command.substring(5), 'output');
    } else if (lowerCmd === 'date') {
      addTerminalLine(new Date().toString(), 'output');
    }
    else {
      addTerminalLine(`Command not found: ${command.split(' ')[0]}. Type 'help' for available commands.`, 'error');
    }
  }, [addTerminalLine, clearTerminalOutput, simulateNpmRunDev]);

  const loadProjectData = useCallback(async () => { 
    if (!projectId) { navigate('/'); return; }
    setIsLoadingProject(true);
    addTerminalLine("Initializing project environment...", 'system');
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user?.id) { navigate('/'); return; }
      const proj = await getProjectById(projectId, user.data.user.id);
      if (!proj) { navigate('/'); return; }
      setProject(proj); setCurrentModelId(proj.model_id); setActiveUITab(proj.view_mode);
      const files = await fetchProjectFiles(projectId); setProjectFiles(files);
      addTerminalLine(`Loaded ${Object.keys(files).length} project files.`, 'system');
      const messages = await fetchChatMessages(projectId); setChatMessages(messages);
      addTerminalLine(`Loaded ${messages.length} chat messages.`, 'system');
      resetChatSession(); 
      addTerminalLine("AI session reset and ready.", 'system');
      addTerminalLine(`Welcome to project: ${proj.name}. Terminal is active. Type 'help' for commands.`, 'success');
    } catch (error) {
      console.error("Failed to load project:", error);
      addTerminalLine(`[-] Failed to load project: ${(error as Error).message}`, 'error');
    } finally { setIsLoadingProject(false); }
  }, [projectId, navigate, addTerminalLine]);

  useEffect(() => { loadProjectData(); }, [loadProjectData]);

  const debouncedUpdateProjectDetails = useCallback(debounce(async (updates: Partial<Project>) => { 
    if (project && projectId) {
      try { await updateProject(projectId, updates); }
      catch (error) { addTerminalLine(`Error saving project settings: ${(error as Error).message}`, 'error'); }
    }
  }, 1000), [project, projectId, addTerminalLine]);

  const handleModelChange = (newModelId: ModelId) => { 
    setCurrentModelId(newModelId);
    if (project) {
      setProject(p => p ? { ...p, model_id: newModelId } : null);
      debouncedUpdateProjectDetails({ model_id: newModelId });
      resetChatSession(); 
      addTerminalLine(`Switched AI model to: ${AVAILABLE_MODELS.find(m => m.id === newModelId)?.name || newModelId}`, 'system');
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

  const handleUITabChange = (tab: 'editor' | 'preview' | 'terminal') => {
    if (tab === 'editor' && !canAccessEditor) { setShowUpgradeModal(true); return; }
    setActiveUITab(tab);
    if (tab === 'editor' || tab === 'preview') {
      if (project) {
        setProject(p => p ? { ...p, view_mode: tab } : null);
        debouncedUpdateProjectDetails({ view_mode: tab });
      }
    }
    if (tab === 'editor' && isInspectModeActive) { setIsInspectModeActive(false); setSelectedElementContext(null); }
  };

  const handleCodeChange = async (filePath: string, newCode: string) => { 
    if (!canAccessEditor) { setShowUpgradeModal(true); return; }
    const updatedFiles = { ...projectFiles, [filePath]: newCode }; setProjectFiles(updatedFiles);
    if (project && projectId) {
      try { await saveProjectFiles(projectId, updatedFiles); }
      catch (error) { addTerminalLine(`Error saving file ${filePath}: ${(error as Error).message}`, 'error'); }
    }
  };

  const handleSendMessage = async (messageText: string, currentSelectedElementContext?: SelectedElementDetails | null) => {
    if (!project || isLoadingAIResponse) return;
    const filesContextForAI = `Current project files for context (use these as the basis for modifications if requested, and return ALL files in your response including unchanged ones and new ones, adhering to the specified JSON output format):\n${Object.entries(projectFiles).map(([path, content]) => `// File: ${path}\n${content}\n`).join('\n')}\n\n---\n\nUser's request:\n`;
    const userMessageContent = currentSelectedElementContext ? `${filesContextForAI}USER PROMPT CONTAINS SELECTED ELEMENT CONTEXT: ${JSON.stringify(currentSelectedElementContext)}. Original user request for this element: ${messageText}` : `${filesContextForAI}${messageText}`;
    const userMessageForLocalState: ChatMessage = { id: `user-${Date.now()}`, project_id: project.id, sender: 'user', text: messageText, timestamp: Date.now(), model_id_used: currentModelId, selected_element_context: currentSelectedElementContext || undefined, };
    setChatMessages(prev => [...prev, userMessageForLocalState]);
    addTerminalLine(`Sending prompt to AI: "${messageText.substring(0, 50).replace(/\n/g, ' ')}..."`, 'system');
    await addChatMessage({ project_id: project.id, sender: 'user', text: messageText, model_id_used: currentModelId, selected_element_context: currentSelectedElementContext || undefined, project_files_snapshot: projectFiles });
    setIsLoadingAIResponse(true); setSelectedElementContext(null); if (isInspectModeActive) setIsInspectModeActive(false); 
    try {
      const chatSession = getOrCreateChatSession([...chatMessages, userMessageForLocalState], currentModelId);
      const aiResponse: AIProjectStructure = await sendMessageToAI(chatSession, userMessageContent, currentModelId);
      const aiMessageForLocalState: ChatMessage = { id: `ai-${Date.now()}`, project_id: project.id, sender: 'ai', text: aiResponse.aiMessage, project_files_snapshot: aiResponse.files, timestamp: Date.now(), model_id_used: currentModelId };
      setChatMessages(prev => [...prev, aiMessageForLocalState]);
      const { id: _aiId, timestamp: _aiTs, ...aiMessageDataForDb } = aiMessageForLocalState; await addChatMessage(aiMessageDataForDb); 
      if (aiResponse.files && Object.keys(aiResponse.files).length > 0 ) {
        if (aiResponse.files["error.txt"]) {
            addTerminalLine(`[-] Failed: AI Error - ${aiResponse.files["error.txt"]}`, 'error');
        } else {
            setProjectFiles(aiResponse.files); await saveProjectFiles(project.id, aiResponse.files);
            addTerminalLine("[+] Successful Prompt.", 'success');
            await simulateNpmRunDev(); 
            if (aiResponse.entryPoint && aiResponse.files[aiResponse.entryPoint] !== undefined) handleActivePreviewHtmlFileChange(aiResponse.entryPoint);
            else if (aiResponse.files['index.html'] !== undefined) handleActivePreviewHtmlFileChange('index.html');
        }
      } else if (!aiResponse.files || Object.keys(aiResponse.files).length === 0) {
        addTerminalLine(`[-] AI responded, but no files were returned. AI Message: ${aiResponse.aiMessage}`, 'error');
      }
    } catch (error: any) {
      console.error("Error in AI interaction:", error);
      const systemErrorMessageForLocalState: ChatMessage = { id: `error-${Date.now()}`, project_id: project.id, sender: 'system', text: `Error: ${error.message || 'Failed to get response from AI.'}`, timestamp: Date.now() };
      setChatMessages(prev => [...prev, systemErrorMessageForLocalState]);
      addTerminalLine(`[-] Failed: ${error.message || 'Failed to get response from AI.'}`, 'error');
      const { id: _sysErrId, timestamp: _sysErrTs, ...systemErrorMessageDataForDb } = systemErrorMessageForLocalState; await addChatMessage(systemErrorMessageDataForDb);
    } finally { setIsLoadingAIResponse(false); }
  };

  const handleRestoreVersion = async (messageId: string) => { 
    const messageToRestore = chatMessages.find(msg => msg.id === messageId);
    if (messageToRestore && messageToRestore.project_files_snapshot && project && projectId) {
      setIsLoadingAIResponse(true); addTerminalLine(`Restoring to version from: ${new Date(messageToRestore.timestamp).toLocaleString()}`, 'system');
      try {
        const filesToRestore = messageToRestore.project_files_snapshot; setProjectFiles(filesToRestore); await saveProjectFiles(projectId, filesToRestore);
        const ts = typeof messageToRestore.timestamp === 'string' ? messageToRestore.timestamp : new Date(messageToRestore.timestamp).toISOString();
        await deleteChatMessagesAfter(projectId, ts);
        const idx = chatMessages.findIndex(msg => msg.id === messageId); const updatedMessages = chatMessages.slice(0, idx + 1);
        const sysMsg: ChatMessage = { id: `restore-${Date.now()}`, project_id: projectId, sender: 'system', text: `Restored to version from ${new Date(messageToRestore.timestamp).toLocaleTimeString()}`, timestamp: Date.now() };
        setChatMessages([...updatedMessages, sysMsg]); addTerminalLine(`[+] Project successfully restored.`, 'success');
        const { id: _id, timestamp: _ts, ...dbMsg } = sysMsg; await addChatMessage(dbMsg);
      } catch (error) { addTerminalLine(`[-] Failed to restore: ${(error as Error).message}`, 'error'); }
      finally { setIsLoadingAIResponse(false); }
    }
  };
  const handlePublishProject = async () => { 
    if (!project || !projectId ) return; setIsPublishing(true); addTerminalLine("Publishing project...", 'system');
    try {
      const user = (await supabase.auth.getUser()).data.user; if (!user) throw new Error("User not authenticated");
      const published = await publishProjectToSupabase(projectId, user.id, projectFiles, project.active_preview_html_file || 'index.html');
      setLastPublishedInfo({ id: published.id, timestamp: published.updated_at }); setShowPublishSuccess(true);
      addTerminalLine(`[+] Project published! Public ID: ${published.id}`, 'success');
      setTimeout(() => setShowPublishSuccess(false), 3000);
    } catch (error) { addTerminalLine(`[-] Failed to publish: ${(error as Error).message}`, 'error'); }
    finally { setIsPublishing(false); }
  };
  const handleToggleInspectMode = () => {
    setIsInspectModeActive(prev => {
      const newMode = !prev;
      if (!newMode) setSelectedElementContext(null); 
      if (newMode && activeUITab === 'editor') { 
        handleUITabChange('preview'); 
      }
      return newMode;
    });
  };
  const handleElementSelected = (details: SelectedElementDetails) => {
    setSelectedElementContext(details);
    setIsInspectModeActive(false); 
  };
  const handleClearElementSelection = () => {
    setSelectedElementContext(null);
  };
  const handlePreviewError = (error: { message: string; stack?: string }) => { 
    const errorMsgForAI = `The current HTML preview for file '${project?.active_preview_html_file}' resulted in an error. Please help fix it.
Error message: ${error.message}
${error.stack ? `Stack trace: ${error.stack}` : ''}
Relevant file content snapshot (first 2000 chars):
${projectFiles[project?.active_preview_html_file || '']?.substring(0, 2000) || 'File content not available.'}
`;
    const sysMsg: ChatMessage = { id: `sys-preview-err-${Date.now()}`, project_id: project!.id, sender: 'system', text: `Preview error in '${project?.active_preview_html_file}': ${error.message}. Asking AI to fix...`, timestamp: Date.now() };
    setChatMessages(prev => [...prev, sysMsg]);
    addTerminalLine(`[-] Failed: Preview Error in '${project?.active_preview_html_file}': ${error.message}. Asking AI to fix...`, 'error');
    handleSendMessage(errorMsgForAI);
  };

  if (isLoadingProject || !project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
        <p className="ml-4 text-lg">Loading Project...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      <TopBar projectName={project.name} selectedModel={currentModelId} onModelChange={handleModelChange} isLoading={isLoadingAIResponse || isPublishing} onPublish={handlePublishProject} isPublished={!!lastPublishedInfo} isPublishing={isPublishing} isInspectModeActive={isInspectModeActive} onToggleInspectMode={handleToggleInspectMode} isTerminalActive={activeUITab === 'terminal'} />
      {showPublishSuccess && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
          Project published! Public link: <a href={`#/view/${lastPublishedInfo?.id}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-200">View Site</a>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[380px] flex-shrink-0 bg-gray-900"> 
          <ChatSidebar messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isLoadingAIResponse} projectDescription={project.description || ''} onRestoreVersion={handleRestoreVersion} selectedElementContext={selectedElementContext} onClearElementSelection={handleClearElementSelection} isInspectModeActive={isInspectModeActive} />
        </div>
        <div className="flex-1 min-w-0 bg-gray-800"> 
          <EditorPreview projectFiles={projectFiles} activeEditorFile={project.active_editor_file} onActiveEditorFileChange={handleActiveEditorFileChange} activePreviewHtmlFile={project.active_preview_html_file} onActivePreviewHtmlFileChange={handleActivePreviewHtmlFileChange} onCodeChange={handleCodeChange} activeUITab={activeUITab} onUITabChange={handleUITabChange} onPreviewError={handlePreviewError} isInspectModeActive={isInspectModeActive} onElementSelected={handleElementSelected} onClearElementSelection={handleClearElementSelection} canAccessEditor={canAccessEditor} terminalOutput={terminalOutput} onTerminalCommand={handleTerminalCommand} onClearTerminal={clearTerminalOutput} isLoadingTerminalCommand={isLoadingAIResponse} />
        </div>
      </div>
      <UpgradeToProModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
};
export default ProjectPage;
