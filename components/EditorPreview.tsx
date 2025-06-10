
import React, { useState, useEffect, useRef, useCallback } from 'react';
import CodeIcon from './icons/CodeIcon';
import PreviewIcon from './icons/PreviewIcon';
import ReloadIcon from './icons/ReloadIcon';
import TerminalIcon from './icons/TerminalIcon';
import { getPreviewLoadingScreenHtml } from './PreviewLoadingScreen';
import PreviewErrorModal from './PreviewErrorModal';
import TerminalDisplay, { TerminalLine } from './TerminalDisplay'; // Import TerminalLine
import { SelectedElementDetails } from '../types';

interface EditorPreviewProps {
  projectFiles: Record<string, string>;
  activeEditorFile: string;
  onActiveEditorFileChange: (filePath: string) => void;
  activePreviewHtmlFile: string;
  onActivePreviewHtmlFileChange: (filePath: string) => void;
  onCodeChange: (filePath: string, newCode: string) => void;
  
  activeUITab: 'editor' | 'preview' | 'terminal';
  onUITabChange: (tab: 'editor' | 'preview' | 'terminal') => void;

  onPreviewError: (error: { message: string; stack?: string }) => void;
  isInspectModeActive: boolean; 
  onElementSelected: (details: SelectedElementDetails) => void; 
  onClearElementSelection: () => void; 
  canAccessEditor: boolean;

  terminalOutput: TerminalLine[];
  onTerminalCommand: (command: string) => void;
  onClearTerminal: () => void;
  isLoadingTerminalCommand: boolean;
}

const defaultPreviewContent = getPreviewLoadingScreenHtml();

const getCssSelector = (el: HTMLElement | null): string => {
  if (!(el instanceof HTMLElement)) return '';
  const path: string[] = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id.trim().replace(/\s+/g, '-')}`;
      path.unshift(selector);
      break; 
    } else {
      let sib = el as Element | null;
      let nth = 1;
      while ((sib = sib?.previousElementSibling)) {
        if (sib.nodeName.toLowerCase() === selector.split(':')[0]) nth++;
      }
      if (nth !== 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    el = el.parentNode as HTMLElement | null;
    if (el === null || el.nodeType !== Node.ELEMENT_NODE) break;
  }
  return path.join(' > ');
};

const EditorPreview: React.FC<EditorPreviewProps> = ({
  projectFiles,
  activeEditorFile,
  onActiveEditorFileChange,
  activePreviewHtmlFile,
  onActivePreviewHtmlFileChange,
  onCodeChange,
  activeUITab, 
  onUITabChange, 
  onPreviewError,
  isInspectModeActive,
  onElementSelected,
  onClearElementSelection,
  canAccessEditor,
  terminalOutput,
  onTerminalCommand,
  onClearTerminal,
  isLoadingTerminalCommand,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [showDelayedPreviewContent, setShowDelayedPreviewContent] = useState<boolean>(false);
  const [currentPreviewError, setCurrentPreviewError] = useState<{ message: string; stack?: string } | null>(null);
  const [currentSelectedElementInIframe, setCurrentSelectedElementInIframe] = useState<HTMLElement | null>(null);

  const availableFiles = Object.keys(projectFiles);
  const htmlFiles = availableFiles.filter(file => file.endsWith('.html'));
  const currentEditorContent = projectFiles[activeEditorFile] || '';
  const editorDisplayContent = canAccessEditor ? currentEditorContent : "Upgrade to PRO to edit code.";
  const actualPreviewFileContent = projectFiles[activePreviewHtmlFile] || defaultPreviewContent;
  const iframeContentToRender = (activeUITab === 'preview' && !showDelayedPreviewContent)
    ? defaultPreviewContent
    : actualPreviewFileContent;
  
  useEffect(() => {
    if (activeUITab === 'editor' && !canAccessEditor) {
      onUITabChange('preview'); 
    }
  }, [activeUITab, canAccessEditor, onUITabChange]);

  useEffect(() => {
    let timerId: number;
    if (activeUITab === 'preview') {
      setCurrentPreviewError(null);
      setShowDelayedPreviewContent(false);
      setIframeKey(prevKey => prevKey + 1);
      timerId = window.setTimeout(() => {
        setShowDelayedPreviewContent(true);
        setIframeKey(prevKey => prevKey + 1);
      }, 350);
    } else { 
      setShowDelayedPreviewContent(false);
      if (timerId!) window.clearTimeout(timerId);
    }
    return () => window.clearTimeout(timerId);
  }, [activeUITab, activePreviewHtmlFile, projectFiles, isInspectModeActive]);

  const handleReloadPreview = () => {
    setCurrentPreviewError(null);
    if (activeUITab === 'preview') {
        setShowDelayedPreviewContent(false);
        setIframeKey(prevKey => prevKey + 1);
        window.setTimeout(() => {
            setShowDelayedPreviewContent(true);
            setIframeKey(prevKey => prevKey + 1);
        }, 350);
    } else {
        setIframeKey(Date.now());
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (activeUITab !== 'preview' || !iframe || !showDelayedPreviewContent) {
      if (!isInspectModeActive && currentSelectedElementInIframe) {
         try { currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__'); } catch (e) {}
         setCurrentSelectedElementInIframe(null);
      }
      return;
    }

    let injectedStyleSheet: HTMLStyleElement | null = null;
    const onLoad = () => {
      try {
        if (!iframe.contentWindow || !iframe.contentDocument) return;
        if (!iframe.contentDocument.getElementById('__ai_dev_inspector_styles__')) {
          injectedStyleSheet = iframe.contentDocument.createElement('style');
          injectedStyleSheet.id = '__ai_dev_inspector_styles__';
          injectedStyleSheet.innerHTML = `
            .__ai_dev_hover_highlight__ { outline: 2px dashed #FF4500 !important; outline-offset: 1px; cursor: pointer; box-shadow: 0 0 8px rgba(255,69,0,0.5) !important; transition: outline 0.1s ease, box-shadow 0.1s ease; background-color: rgba(255,69,0,0.1) !important; }
            .__ai_dev_selected_highlight__ { outline: 3px solid #007BFF !important; outline-offset: 2px; box-shadow: 0 0 0 3px #007BFF, 0 0 12px rgba(0,123,255,0.8) !important; background-color: rgba(0,123,255,0.1) !important; }
          `;
          iframe.contentDocument.head.appendChild(injectedStyleSheet);
        }

        if (!isInspectModeActive && currentSelectedElementInIframe) {
            currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
            setCurrentSelectedElementInIframe(null);
            onClearElementSelection();
        }

        const handleNavigation = (event: Event) => { /* ... (navigation logic as before) ... */ };
        iframe.contentWindow.document.addEventListener('click', handleNavigation, true);
        iframe.contentWindow.onerror = (eventOrMessage, source, lineno, colno, errorObject) => { /* ... (error handling as before) ... */ 
            let finalMessage: string;
            let finalStack: string | undefined = errorObject?.stack;
            if (errorObject && typeof errorObject.message === 'string' && errorObject.message) finalMessage = errorObject.message;
            else if (typeof eventOrMessage === 'string' && eventOrMessage) finalMessage = eventOrMessage;
            else if (eventOrMessage && typeof eventOrMessage === 'object' && 'message' in eventOrMessage && (eventOrMessage as any).message && typeof (eventOrMessage as any).message === 'string') {
                finalMessage = (eventOrMessage as any).message;
                if (!finalStack && (eventOrMessage as any).error && (eventOrMessage as any).error.stack) finalStack = (eventOrMessage as any).error.stack;
            } else if (eventOrMessage instanceof Event && typeof eventOrMessage.type === 'string') finalMessage = `Unhandled event: ${eventOrMessage.type}${source ? ` in ${source}` : ''}${lineno ? ` at line ${lineno}` : ''}`;
            else finalMessage = "An unknown error occurred in the preview.";
            if (!finalStack && source && lineno !== undefined) finalStack = `at ${source}:${lineno}${colno !== undefined ? ':' + colno : ''}`;
            setCurrentPreviewError({ message: finalMessage, stack: finalStack });
            return true; 
        };
        let lastHoveredElement: HTMLElement | null = null;
        const handleInspectorMousemove = (event: MouseEvent) => { /* ... (inspector mousemove as before) ... */ };
        iframe.contentWindow.addEventListener('mousemove', handleInspectorMousemove);
        const handleInspectorClick = (event: MouseEvent) => { /* ... (inspector click as before) ... */ };
        iframe.contentWindow.addEventListener('click', handleInspectorClick, true);

        return () => { 
          if (iframe.contentWindow) {
            try {
              iframe.contentWindow.document.removeEventListener('click', handleNavigation, true);
              iframe.contentWindow.removeEventListener('mousemove', handleInspectorMousemove);
              iframe.contentWindow.removeEventListener('click', handleInspectorClick, true);
              if (iframe.contentWindow.onerror) iframe.contentWindow.onerror = null;
              if (lastHoveredElement) lastHoveredElement.classList.remove('__ai_dev_hover_highlight__');
              if (currentSelectedElementInIframe) currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
              if (injectedStyleSheet) injectedStyleSheet.remove();
            } catch (e) { /* ignore */ }
          }
        };
      } catch (e) { console.error("Error setting up iframe:", e); }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [activeUITab, projectFiles, onActivePreviewHtmlFileChange, activePreviewHtmlFile, iframeKey, showDelayedPreviewContent, isInspectModeActive, onElementSelected, onClearElementSelection, currentSelectedElementInIframe]);

  useEffect(() => {
    if (!isInspectModeActive && currentSelectedElementInIframe && iframeRef.current?.contentDocument) {
      try { currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__'); } catch(e) {/* ignore */}
      setCurrentSelectedElementInIframe(null);
    }
  }, [isInspectModeActive, currentSelectedElementInIframe]);

  const handleFixWithAI = () => {
    if (currentPreviewError) {
      onPreviewError(currentPreviewError);
      setCurrentPreviewError(null);
    }
  };

  const isTerminalCurrentlyActive = activeUITab === 'terminal';

  return (
    <div className="h-full w-full flex flex-col bg-gray-800 relative">
      <div className="flex flex-wrap items-center p-2 bg-gray-900 border-b border-gray-700 gap-2">
        <button
          onClick={() => onUITabChange('preview')}
          title="Switch to Preview Mode"
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors
            ${activeUITab === 'preview' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            ${isLoadingTerminalCommand ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoadingTerminalCommand}
        >
          <PreviewIcon className="w-4 h-4 mr-2" /> Preview
        </button>
        <button
          onClick={() => onUITabChange('editor')}
          title={canAccessEditor ? "Switch to Editor Mode" : "Upgrade to PRO to access Editor"}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors
            ${activeUITab === 'editor' && canAccessEditor ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            ${isLoadingTerminalCommand ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoadingTerminalCommand}
        >
          <CodeIcon className="w-4 h-4 mr-2" /> Editor
        </button>
        <button
          onClick={() => onUITabChange('terminal')}
          title="Switch to Terminal"
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors
            ${activeUITab === 'terminal' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
            ${isLoadingTerminalCommand ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isLoadingTerminalCommand}
        >
          <TerminalIcon className="w-4 h-4 mr-2" /> Terminal
        </button>

        {activeUITab === 'editor' && canAccessEditor && (
          <select
            value={activeEditorFile}
            onChange={(e) => onActiveEditorFileChange(e.target.value)}
            title="Select file to edit"
            className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none"
            disabled={availableFiles.length === 0 || isInspectModeActive || isTerminalCurrentlyActive}
          >
            {availableFiles.length === 0 && <option>No files</option>}
            {availableFiles.map(file => <option key={file} value={file}>{file}</option>)}
          </select>
        )}

        {activeUITab === 'preview' && (
          <>
            <select
              value={activePreviewHtmlFile}
              onChange={(e) => onActivePreviewHtmlFileChange(e.target.value)}
              title="Select HTML file to preview"
              className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none"
              disabled={htmlFiles.length === 0 || isInspectModeActive || isTerminalCurrentlyActive}
            >
              {htmlFiles.length === 0 && <option>No HTML files</option>}
              {htmlFiles.map(file => <option key={file} value={file}>{file}</option>)}
            </select>
            <button
                onClick={handleReloadPreview}
                title="Reload Preview"
                className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                disabled={isInspectModeActive || isTerminalCurrentlyActive}
            >
                <ReloadIcon className="w-4 h-4 mr-2" /> Reload
            </button>
          </>
        )}
      </div>

      {activeUITab === 'editor' ? (
        <textarea
          key={activeEditorFile}
          value={editorDisplayContent} 
          onChange={(e) => { if (canAccessEditor) onCodeChange(activeEditorFile, e.target.value); }}
          readOnly={!canAccessEditor} 
          className={`flex-grow w-full h-full p-4 bg-gray-800 text-gray-200 font-mono text-sm border-none outline-none resize-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 ${!canAccessEditor ? 'opacity-70 cursor-not-allowed placeholder-red-400' : ''}`}
          placeholder={!canAccessEditor ? "Upgrade to PRO plan to edit code directly." : (availableFiles.length > 0 && projectFiles[activeEditorFile] !== undefined ? `Edit ${activeEditorFile}` : (availableFiles.length > 0 ? "Select a file to edit or AI will generate files." : "AI will generate files here..."))}
          disabled={isInspectModeActive || (availableFiles.length > 0 && projectFiles[activeEditorFile] === undefined && canAccessEditor)}
        />
      ) : activeUITab === 'preview' ? (
        <div className="flex-grow w-full h-full relative"> 
            <iframe ref={iframeRef} key={iframeKey} srcDoc={iframeContentToRender} title="Preview" className={`w-full h-full border-none bg-white ${isInspectModeActive ? 'iframe-inspect-mode' : ''}`} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
        </div>
      ) : ( // activeUITab === 'terminal'
        <TerminalDisplay outputLines={terminalOutput} onCommand={onTerminalCommand} onClear={onClearTerminal} isLoading={isLoadingTerminalCommand} />
      )}
      {currentPreviewError && activeUITab === 'preview' && (
        <PreviewErrorModal errorMessage={currentPreviewError.message} errorStack={currentPreviewError.stack} onFixWithAI={handleFixWithAI} onClose={() => setCurrentPreviewError(null)} />
      )}
    </div>
  );
};

export default EditorPreview;
