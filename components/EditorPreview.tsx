
import React, { useState, useEffect, useRef, useCallback } from 'react';
import CodeIcon from './icons/CodeIcon';
import PreviewIcon from './icons/PreviewIcon';
import ReloadIcon from './icons/ReloadIcon';
import { getPreviewLoadingScreenHtml } from './PreviewLoadingScreen';
import PreviewErrorModal from './PreviewErrorModal';
import { SelectedElementDetails } from '../types';

interface EditorPreviewProps {
  projectFiles: Record<string, string>;
  activeEditorFile: string;
  onActiveEditorFileChange: (filePath: string) => void;
  activePreviewHtmlFile: string;
  onActivePreviewHtmlFileChange: (filePath: string) => void;
  onCodeChange: (filePath: string, newCode: string) => void;
  viewMode: 'editor' | 'preview';
  onViewModeChange: (mode: 'editor' | 'preview') => void; // ProjectPage will handle plan check
  onPreviewError: (error: { message: string; stack?: string }) => void;
  isInspectModeActive: boolean; 
  onElementSelected: (details: SelectedElementDetails) => void; 
  onClearElementSelection: () => void; 
  canAccessEditor: boolean; // New prop
}

const defaultPreviewContent = getPreviewLoadingScreenHtml();

const getCssSelector = (el: HTMLElement | null): string => {
  if (!(el instanceof HTMLElement)) return '';
  const path: string[] = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id.trim().replace(/\s+/g, '-')}`; // Sanitize ID for selector
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
  viewMode,
  onViewModeChange, // This will be called, ProjectPage checks plan
  onPreviewError,
  isInspectModeActive,
  onElementSelected,
  onClearElementSelection,
  canAccessEditor,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [showDelayedPreviewContent, setShowDelayedPreviewContent] = useState<boolean>(false);
  const [currentPreviewError, setCurrentPreviewError] = useState<{ message: string; stack?: string } | null>(null);

  const [currentSelectedElementInIframe, setCurrentSelectedElementInIframe] = useState<HTMLElement | null>(null);


  const availableFiles = Object.keys(projectFiles);
  const htmlFiles = availableFiles.filter(file => file.endsWith('.html'));

  const currentEditorContent = projectFiles[activeEditorFile] || '';
  // If user can't access editor, show a placeholder message instead of actual code
  const editorDisplayContent = canAccessEditor ? currentEditorContent : "Upgrade to PRO to edit code.";

  const actualPreviewFileContent = projectFiles[activePreviewHtmlFile] || defaultPreviewContent;

  const iframeContentToRender = (viewMode === 'preview' && !showDelayedPreviewContent)
    ? defaultPreviewContent
    : actualPreviewFileContent;
  
  // When viewMode changes, or if editor access changes (e.g. plan upgrade while on page)
  useEffect(() => {
    if (viewMode === 'editor' && !canAccessEditor) {
      onViewModeChange('preview'); // Force back to preview if editor access is lost
    }
  }, [viewMode, canAccessEditor, onViewModeChange]);


  useEffect(() => {
    let timerId: number;
    if (viewMode === 'preview') {
      setCurrentPreviewError(null);
      setShowDelayedPreviewContent(false);
      setIframeKey(prevKey => prevKey + 1);

      timerId = window.setTimeout(() => {
        setShowDelayedPreviewContent(true);
        setIframeKey(prevKey => prevKey + 1);
      }, 350);
    } else { // Editor mode
      setShowDelayedPreviewContent(false);
      if (timerId!) window.clearTimeout(timerId);
      if (isInspectModeActive) { // Turn off inspector if switching to editor
         // This logic should be handled by ProjectPage when onViewModeChange is called.
      }
    }

    return () => {
      window.clearTimeout(timerId);
    };
  }, [viewMode, activePreviewHtmlFile, projectFiles, isInspectModeActive]);


  const handleReloadPreview = () => {
    setCurrentPreviewError(null);
    if (viewMode === 'preview') {
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
    if (viewMode !== 'preview' || !iframe || !showDelayedPreviewContent) {
      if (!isInspectModeActive && currentSelectedElementInIframe) {
         try { // iframe content might be gone
            currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
          } catch (e) {}
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

        const handleNavigation = (event: Event) => {
          if (isInspectModeActive) { 
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          const target = event.target as HTMLAnchorElement;
          if (target.tagName === 'A' && target.href && iframe.contentDocument?.body.contains(target)) {
            let intendedPath = target.getAttribute('href');
            if (intendedPath && !intendedPath.startsWith('http') && !intendedPath.startsWith('//') && !intendedPath.startsWith('mailto:') && !intendedPath.startsWith('tel:')) {
              event.preventDefault();
              if (intendedPath.startsWith('./')) intendedPath = intendedPath.substring(2);
              else if (intendedPath.startsWith('/')) intendedPath = intendedPath.substring(1);

              const currentDirMatch = activePreviewHtmlFile.match(/^(.*\/)[^/]*$/);
              const currentDir = currentDirMatch ? currentDirMatch[1] : '';
              const resolvedPath = intendedPath.includes('/') ? intendedPath : (currentDir + intendedPath);

              if (projectFiles[resolvedPath] && resolvedPath.endsWith('.html')) {
                onActivePreviewHtmlFileChange(resolvedPath);
              } else {
                console.warn(`Preview navigation: File "${resolvedPath}" not found or not an HTML file.`);
              }
            }
          }
        };
        iframe.contentWindow.document.addEventListener('click', handleNavigation, true);

        iframe.contentWindow.onerror = (message, source, lineno, colno, error) => {
            setCurrentPreviewError({ message: String(message), stack: error?.stack || `at ${source}:${lineno}:${colno}` });
            return true; 
        };

        let lastHoveredElement: HTMLElement | null = null;
        const handleInspectorMousemove = (event: MouseEvent) => {
            if (!isInspectModeActive || !iframe.contentWindow || !iframe.contentDocument) return;
            const x = event.clientX; // Get mouse position relative to iframe viewport
            const y = event.clientY;
            const target = iframe.contentDocument.elementFromPoint(x, y) as HTMLElement; // Use elementFromPoint

            if (target && target !== lastHoveredElement) {
                if (lastHoveredElement && lastHoveredElement !== currentSelectedElementInIframe) {
                    lastHoveredElement.classList.remove('__ai_dev_hover_highlight__');
                }
                if (target !== currentSelectedElementInIframe && target.nodeName !== 'HTML' && target.nodeName !== 'BODY' && iframe.contentDocument.body.contains(target)) {
                     target.classList.add('__ai_dev_hover_highlight__');
                }
                lastHoveredElement = target;
            } else if (!target && lastHoveredElement) { // Mouse moved out of any element
                 if (lastHoveredElement !== currentSelectedElementInIframe) {
                    lastHoveredElement.classList.remove('__ai_dev_hover_highlight__');
                }
                lastHoveredElement = null;
            }
        };
        // Listen on the iframe's contentWindow for mousemove events to get correct coordinates
        iframe.contentWindow.addEventListener('mousemove', handleInspectorMousemove);


        const handleInspectorClick = (event: MouseEvent) => {
            if (!isInspectModeActive || !iframe.contentWindow || !iframe.contentDocument) return;
            event.preventDefault();
            event.stopPropagation();

            const x = event.clientX;
            const y = event.clientY;
            const target = iframe.contentDocument.elementFromPoint(x, y) as HTMLElement;

            if (target && target.nodeName !== 'HTML' && target.nodeName !== 'BODY' && iframe.contentDocument.body.contains(target)) {
                if (currentSelectedElementInIframe) {
                    currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
                }
                target.classList.remove('__ai_dev_hover_highlight__'); 
                target.classList.add('__ai_dev_selected_highlight__');
                setCurrentSelectedElementInIframe(target);

                const tagName = target.tagName.toLowerCase();
                const id = target.id || null;
                const classList = Array.from(target.classList).filter(cls => !cls.startsWith('__ai_dev_'));
                const textSnippet = target.innerText?.substring(0, 75).trim().replace(/\n/g, ' ') || null;
                const cssSelector = getCssSelector(target);
                const descriptionForAI = `A ${tagName.toUpperCase()} element${id ? ` with ID '${id}'` : ''}${classList.length > 0 ? ` with classes '${classList.join(', ')}'` : ''}${textSnippet ? ` containing text like '${textSnippet}'` : ''}. CSS selector: ${cssSelector}`;

                onElementSelected({ tagName, id, classList, textSnippet, cssSelector, descriptionForAI });
            } else { 
                if (currentSelectedElementInIframe) {
                    currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
                    setCurrentSelectedElementInIframe(null);
                }
                onClearElementSelection();
            }
        };
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
            } catch (e) { /* ignore iframe removal issues */ }
          }
        };

      } catch (e) { console.error("Error setting up iframe:", e); }
    };

    iframe.addEventListener('load', onLoad);
    return () => { 
      iframe.removeEventListener('load', onLoad);
    };
  }, [viewMode, projectFiles, onActivePreviewHtmlFileChange, activePreviewHtmlFile, iframeKey, showDelayedPreviewContent, isInspectModeActive, onElementSelected, onClearElementSelection, currentSelectedElementInIframe]);


  useEffect(() => {
    if (!isInspectModeActive) {
        if (currentSelectedElementInIframe && iframeRef.current?.contentDocument) {
            try {
              currentSelectedElementInIframe.classList.remove('__ai_dev_selected_highlight__');
            } catch(e) {/* ignore */}
            setCurrentSelectedElementInIframe(null);
        }
    }
  }, [isInspectModeActive, currentSelectedElementInIframe]);


  const handleFixWithAI = () => {
    if (currentPreviewError) {
      onPreviewError(currentPreviewError);
      setCurrentPreviewError(null);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-800 relative">
      <div className="flex flex-wrap items-center p-2 bg-gray-900 border-b border-gray-700 gap-2">
        <button
          onClick={() => onViewModeChange('preview')}
          title="Switch to Preview Mode"
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors
            ${viewMode === 'preview' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          <PreviewIcon className="w-4 h-4 mr-2" /> Preview
        </button>
        <button
          onClick={() => onViewModeChange('editor')} // ProjectPage will handle plan check
          title={canAccessEditor ? "Switch to Editor Mode" : "Upgrade to PRO to access Editor"}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors
            ${viewMode === 'editor' && canAccessEditor ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          <CodeIcon className="w-4 h-4 mr-2" /> Editor
        </button>

        {viewMode === 'editor' && canAccessEditor && (
          <select
            value={activeEditorFile}
            onChange={(e) => onActiveEditorFileChange(e.target.value)}
            title="Select file to edit"
            className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none"
            disabled={availableFiles.length === 0 || isInspectModeActive}
          >
            {availableFiles.length === 0 && <option>No files</option>}
            {availableFiles.map(file => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
        )}

        {viewMode === 'preview' && (
          <>
            <select
              value={activePreviewHtmlFile}
              onChange={(e) => onActivePreviewHtmlFileChange(e.target.value)}
              title="Select HTML file to preview"
              className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none"
              disabled={htmlFiles.length === 0 || isInspectModeActive}
            >
              {htmlFiles.length === 0 && <option>No HTML files</option>}
              {htmlFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
            <button
                onClick={handleReloadPreview}
                title="Reload Preview"
                className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                disabled={isInspectModeActive}
            >
                <ReloadIcon className="w-4 h-4 mr-2" /> Reload
            </button>
          </>
        )}
      </div>

      {viewMode === 'editor' ? (
        <textarea
          key={activeEditorFile}
          value={editorDisplayContent} // Use display content
          onChange={(e) => {
            if (canAccessEditor) {
              onCodeChange(activeEditorFile, e.target.value);
            }
          }}
          readOnly={!canAccessEditor} // Make textarea readonly if no editor access
          className={`flex-grow w-full h-full p-4 bg-gray-800 text-gray-200 font-mono text-sm border-none outline-none resize-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800
            ${!canAccessEditor ? 'opacity-70 cursor-not-allowed placeholder-red-400' : ''}`}
          placeholder={
            !canAccessEditor 
              ? "Upgrade to PRO plan to edit code directly." 
              : (availableFiles.length > 0 && projectFiles[activeEditorFile] !== undefined 
                  ? `Edit ${activeEditorFile}` 
                  : (availableFiles.length > 0 
                      ? "Select a file to edit or AI will generate files." 
                      : "AI will generate files here..."))
          }
          disabled={isInspectModeActive || (availableFiles.length > 0 && projectFiles[activeEditorFile] === undefined && canAccessEditor)} // Disable if no file selected, but allow if it's due to plan restriction
        />
      ) : (
        <div className="flex-grow w-full h-full relative"> 
            <iframe
                ref={iframeRef}
                key={iframeKey}
                srcDoc={iframeContentToRender}
                title="Preview"
                className={`w-full h-full border-none bg-white ${isInspectModeActive ? 'iframe-inspect-mode' : ''}`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
             {/* Style for iframe pointer events during inspect mode, defined in a <style> tag in index.html for global access */}
        </div>
      )}
      {currentPreviewError && viewMode === 'preview' && (
        <PreviewErrorModal
          errorMessage={currentPreviewError.message}
          errorStack={currentPreviewError.stack}
          onFixWithAI={handleFixWithAI}
          onClose={() => setCurrentPreviewError(null)}
        />
      )}
    </div>
  );
};

export default EditorPreview;
