
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
      selector += `#${el.id.trim().replace(/\s+/g, '-')}`; // Ensure ID is CSS-friendly
      path.unshift(selector);
      break; 
    } else {
      let sib = el as Element | null;
      let nth = 1;
      while ((sib = sib?.previousElementSibling)) {
        if (sib.nodeName.toLowerCase() === selector.split(':')[0]) nth++; // Handle pseudo-classes like :nth-of-type
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
  const [editorLineNumbers, setEditorLineNumbers] = useState<number[]>([]);

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
      setIframeKey(prevKey => prevKey + 1); // Force iframe refresh
      timerId = window.setTimeout(() => {
        setShowDelayedPreviewContent(true);
        setIframeKey(prevKey => prevKey + 1); // And again after delay for actual content
      }, 350); // Delay to show loading screen
    } else { 
      setShowDelayedPreviewContent(false); // No delay if not preview tab
      if (timerId!) window.clearTimeout(timerId);
    }
    return () => window.clearTimeout(timerId);
  }, [activeUITab, activePreviewHtmlFile, projectFiles]); // Removed isInspectModeActive as it doesn't directly control preview reload here

  useEffect(() => {
    if (activeUITab === 'editor' && canAccessEditor) {
      const lines = editorDisplayContent.split('\n').length;
      const visualLineCount = Math.max(lines, 25); 
      setEditorLineNumbers(Array.from({ length: visualLineCount }, (_, i) => i + 1));
    }
  }, [editorDisplayContent, activeUITab, canAccessEditor]);


  const handleReloadPreview = () => {
    setCurrentPreviewError(null);
    if (activeUITab === 'preview') {
        setShowDelayedPreviewContent(false); // Show loading screen first
        setIframeKey(prevKey => prevKey + 1); // Refresh iframe
        window.setTimeout(() => {
            setShowDelayedPreviewContent(true); // Then show actual content
            setIframeKey(prevKey => prevKey + 1); // Refresh again with actual content
        }, 350);
    } else {
        // If not in preview tab, just update key to ensure it reloads if switched back
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
    
    // Define documentBaseUrl here so it's fresh for each onLoad
    const documentBaseUrl = activePreviewHtmlFile ? new URL(activePreviewHtmlFile, "file:///project-root/").href : "file:///project-root/index.html";


    const onLoad = () => {
      try {
        if (!iframe.contentWindow || !iframe.contentDocument) return;
        
        // Inject inspector styles
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
            onClearElementSelection(); // Notify parent
        }
        
        const handleNavigation = (event: Event) => {
          if (isInspectModeActive) return; // Inspector click handler will take over

          const target = event.target as HTMLElement;
          const anchor = target.closest('a');

          if (!anchor || !anchor.hasAttribute('href')) return;

          const href = anchor.getAttribute('href')!;
          let resolvedUrl: URL;

          try {
            resolvedUrl = new URL(href, documentBaseUrl); // documentBaseUrl from onLoad's scope
          } catch (e) {
            console.warn("Could not parse href:", href, "with base", documentBaseUrl, e);
            return;
          }

          if (resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:') {
            console.log("External link clicked:", resolvedUrl.href);
            // Allow default browser action, could be opening in new tab based on anchor.target
            // Forcing new tab: window.open(resolvedUrl.href, '_blank'); event.preventDefault();
            return;
          }

          if (resolvedUrl.protocol === 'file:') { // Our virtual project links
            event.preventDefault();

            const potentialNewFilePath = resolvedUrl.pathname.startsWith('/project-root/')
                ? resolvedUrl.pathname.substring('/project-root/'.length)
                : resolvedUrl.pathname.substring(1); // Fallback if prefix is missing

            // Check for hash link on the *current* page
            if (resolvedUrl.hash && potentialNewFilePath === activePreviewHtmlFile) {
              const elementId = resolvedUrl.hash.substring(1); // Remove #
              if (iframeRef.current?.contentDocument) {
                const elementToScroll = iframeRef.current.contentDocument.getElementById(elementId);
                if (elementToScroll) {
                  elementToScroll.scrollIntoView({ behavior: 'smooth' });
                } else {
                  console.warn(`Element with ID "${elementId}" not found in ${activePreviewHtmlFile}`);
                }
              }
              return;
            }

            // Check for navigation to a different HTML page
            if (potentialNewFilePath.endsWith('.html') || potentialNewFilePath.endsWith('.htm')) {
              if (projectFiles.hasOwnProperty(potentialNewFilePath)) {
                onActivePreviewHtmlFileChange(potentialNewFilePath);
              } else {
                console.warn(`Target HTML file "${potentialNewFilePath}" (from href "${href}") not found in project files.`);
                if(iframeRef.current?.contentDocument?.body) {
                  iframeRef.current.contentDocument.body.innerHTML = `<div style="font-family:sans-serif;color:red;padding:20px;">Error: Linked page <strong>${potentialNewFilePath}</strong> not found.</div>`;
                }
              }
              return;
            }
          }
          console.log("Unhandled link type or path:", href, "Resolved to:", resolvedUrl.href);
        };
        
        // Attach navigation click listener
        iframe.contentDocument.addEventListener('click', handleNavigation, true); // Use capture phase

        // Error handling for the iframe content
        iframe.contentWindow.onerror = (eventOrMessage, source, lineno, colno, errorObject) => {
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

        // Inspector listeners
        let lastHoveredElement: HTMLElement | null = null;
        const handleInspectorMousemove = (event: MouseEvent) => {
            if (!isInspectModeActive || !iframeRef.current?.contentWindow || !iframeRef.current?.contentDocument) return;
            const x = event.clientX; const y = event.clientY;
            const elementFromPoint = iframeRef.current.contentDocument.elementFromPoint(x, y) as HTMLElement | null;
            if (lastHoveredElement && lastHoveredElement !== elementFromPoint) {
              lastHoveredElement.classList.remove('__ai_dev_hover_highlight__');
            }
            if (elementFromPoint && elementFromPoint !== lastHoveredElement && elementFromPoint !== currentSelectedElementInIframe) {
              elementFromPoint.classList.add('__ai_dev_hover_highlight__');
              lastHoveredElement = elementFromPoint;
            }
        };
        iframe.contentWindow.addEventListener('mousemove', handleInspectorMousemove);

        const handleInspectorClick = (event: MouseEvent) => {
            if (!isInspectModeActive || !iframeRef.current?.contentWindow || !iframeRef.current?.contentDocument) return;
            event.preventDefault(); event.stopPropagation();
            const x = event.clientX; const y = event.clientY;
            const clickedElement = iframeRef.current.contentDocument.elementFromPoint(x, y) as HTMLElement | null;

            if (currentSelectedElementInIframe) {
              currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
            }
            if (clickedElement) {
              clickedElement.classList.remove('__ai_dev_hover_highlight__');
              clickedElement.classList.add('__ai_dev_selected_highlight__');
              setCurrentSelectedElementInIframe(clickedElement);
              
              const details: SelectedElementDetails = {
                tagName: clickedElement.tagName,
                id: clickedElement.id || null,
                classList: Array.from(clickedElement.classList).filter(cls => !cls.startsWith('__ai_dev_')),
                textSnippet: clickedElement.innerText?.substring(0, 50).trim() || null,
                cssSelector: getCssSelector(clickedElement),
                descriptionForAI: `A ${clickedElement.tagName} element` +
                  (clickedElement.id ? ` with ID '${clickedElement.id}'` : '') +
                  (clickedElement.classList.length > 0 ? ` and classes '${Array.from(clickedElement.classList).filter(c => !c.startsWith('__ai_dev_')).join(', ')}'` : '') +
                  (clickedElement.innerText ? `. It contains text starting with: "${clickedElement.innerText.substring(0,30).trim().replace(/\s+/g, ' ')}..."` : '.'),
              };
              onElementSelected(details);
            } else {
              setCurrentSelectedElementInIframe(null);
              onClearElementSelection();
            }
        };
        iframe.contentDocument.addEventListener('click', handleInspectorClick, true); // Capture phase for inspector as well

        // Cleanup for this specific onLoad execution
        return () => { 
          if (iframe.contentWindow && iframe.contentDocument) { // Check if document still exists
            try {
              iframe.contentDocument.removeEventListener('click', handleNavigation, true);
              iframe.contentWindow.removeEventListener('mousemove', handleInspectorMousemove);
              iframe.contentDocument.removeEventListener('click', handleInspectorClick, true);
              if (iframe.contentWindow.onerror) iframe.contentWindow.onerror = null; // Clear error handler
              if (lastHoveredElement) lastHoveredElement.classList.remove('__ai_dev_hover_highlight__');
              if (currentSelectedElementInIframe) currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
              if (injectedStyleSheet) injectedStyleSheet.remove();
            } catch (e) { /* ignore cleanup errors if iframe is already gone */ }
          }
        };
      } catch (e) { 
        console.error("Error setting up iframe event listeners or styles:", e); 
      }
    }; // End of onLoad

    // Add load listener
    iframe.addEventListener('load', onLoad);
    // Cleanup: remove the specific onLoad listener instance when effect re-runs or unmounts
    return () => {
        if(iframe) iframe.removeEventListener('load', onLoad);
    };
  }, [
      activeUITab, 
      projectFiles, // For checking existence of linked files
      activePreviewHtmlFile, // For base URL and current page check
      onActivePreviewHtmlFileChange, // To call for page navigation
      iframeKey, 
      showDelayedPreviewContent, 
      isInspectModeActive, // To disable navigation/enable inspector
      onElementSelected, 
      onClearElementSelection,
      currentSelectedElementInIframe // To manage highlights
    ]);

  useEffect(() => {
    // Clear selection highlight if inspect mode is turned off externally
    if (!isInspectModeActive && currentSelectedElementInIframe && iframeRef.current?.contentDocument) {
      try { currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__'); } catch(e) {/* ignore */}
      setCurrentSelectedElementInIframe(null);
    }
  }, [isInspectModeActive, currentSelectedElementInIframe]);

  const handleFixWithAI = () => {
    if (currentPreviewError) {
      onPreviewError(currentPreviewError); // Pass error to parent to send to AI
      setCurrentPreviewError(null); // Clear local error
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
            ${(!canAccessEditor || isLoadingTerminalCommand) ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!canAccessEditor || isLoadingTerminalCommand}
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
            disabled={availableFiles.length === 0 || isInspectModeActive || isLoadingTerminalCommand}
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
              disabled={htmlFiles.length === 0 || isInspectModeActive || isLoadingTerminalCommand}
            >
              {htmlFiles.length === 0 && <option>No HTML files</option>}
              {htmlFiles.map(file => <option key={file} value={file}>{file}</option>)}
            </select>
            <button
                onClick={handleReloadPreview}
                title="Reload Preview"
                className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                disabled={isInspectModeActive || isLoadingTerminalCommand}
            >
                <ReloadIcon className="w-4 h-4 mr-2" /> Reload
            </button>
          </>
        )}
      </div>

      {activeUITab === 'editor' ? (
        <div className="flex-grow w-full h-full flex bg-gray-900 overflow-hidden">
          {canAccessEditor && (
            <div className="w-12 md:w-14 bg-gray-800 text-right p-2 select-none overflow-y-hidden flex flex-col flex-shrink-0">
              {editorLineNumbers.map(num => (
                <span key={num} className="text-gray-500 text-xs leading-relaxed block font-mono" style={{ lineHeight: '1.625rem' }}>{num}</span>
              ))}
            </div>
          )}
          <textarea
            key={activeEditorFile + (canAccessEditor ? '' : '-disabled')} 
            value={editorDisplayContent} 
            onChange={(e) => { if (canAccessEditor) onCodeChange(activeEditorFile, e.target.value); }}
            readOnly={!canAccessEditor} 
            className={`flex-grow w-full h-full p-2.5 bg-gray-800 text-gray-200 font-mono text-sm border-none outline-none resize-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 caret-purple-400 
              ${!canAccessEditor ? 'opacity-70 cursor-not-allowed items-center justify-center flex p-4' : ''}
              leading-relaxed`}
            style={{ lineHeight: '1.625rem' }} 
            placeholder={!canAccessEditor ? "Upgrade to PRO plan to edit code directly." : (availableFiles.length > 0 && projectFiles[activeEditorFile] !== undefined ? `` : (availableFiles.length > 0 ? "Select a file to edit or AI will generate files." : "AI will generate files here..."))}
            disabled={isInspectModeActive || (availableFiles.length > 0 && projectFiles[activeEditorFile] === undefined && canAccessEditor) || isLoadingTerminalCommand}
            spellCheck="false" autoCapitalize="off" autoComplete="off" autoCorrect="off"
          />
        </div>
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
