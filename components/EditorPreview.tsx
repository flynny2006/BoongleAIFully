import React, { useState, useEffect, useRef } from 'react';
import CodeIcon from './icons/CodeIcon';
import PreviewIcon from './icons/PreviewIcon';
import ReloadIcon from './icons/ReloadIcon';
import { getPreviewLoadingScreenHtml } from './PreviewLoadingScreen';
import PreviewErrorModal from './PreviewErrorModal'; // Import the error modal

interface EditorPreviewProps {
  projectFiles: Record<string, string>;
  activeEditorFile: string;
  onActiveEditorFileChange: (filePath: string) => void;
  activePreviewHtmlFile: string;
  onActivePreviewHtmlFileChange: (filePath: string) => void;
  onCodeChange: (filePath: string, newCode: string) => void;
  viewMode: 'editor' | 'preview';
  onViewModeChange: (mode: 'editor' | 'preview') => void;
  onPreviewError: (error: { message: string; stack?: string }) => void; // Callback for AI fix
}

const defaultPreviewContent = getPreviewLoadingScreenHtml();

const EditorPreview: React.FC<EditorPreviewProps> = ({
  projectFiles,
  activeEditorFile,
  onActiveEditorFileChange,
  activePreviewHtmlFile,
  onActivePreviewHtmlFileChange,
  onCodeChange,
  viewMode,
  onViewModeChange,
  onPreviewError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [showDelayedPreviewContent, setShowDelayedPreviewContent] = useState<boolean>(false);
  const [currentPreviewError, setCurrentPreviewError] = useState<{ message: string; stack?: string } | null>(null);

  const availableFiles = Object.keys(projectFiles);
  const htmlFiles = availableFiles.filter(file => file.endsWith('.html'));

  const currentEditorContent = projectFiles[activeEditorFile] || '';
  const actualPreviewFileContent = projectFiles[activePreviewHtmlFile] || defaultPreviewContent;

  const iframeContentToRender = (viewMode === 'preview' && !showDelayedPreviewContent) 
    ? defaultPreviewContent 
    : actualPreviewFileContent;
  
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (viewMode === 'preview') {
      setCurrentPreviewError(null); // Clear previous errors on mode switch or file change
      setShowDelayedPreviewContent(false); 
      setIframeKey(prevKey => prevKey + 1); 

      timerId = setTimeout(() => {
        setShowDelayedPreviewContent(true); 
        setIframeKey(prevKey => prevKey + 1); 
      }, 350); // Changed from 3000 to 350
    } else {
      setShowDelayedPreviewContent(false); 
      clearTimeout(timerId); 
    }

    return () => {
      clearTimeout(timerId);
    };
  }, [viewMode, activePreviewHtmlFile, projectFiles]); // projectFiles added to reset error on AI update


  const handleReloadPreview = () => {
    setCurrentPreviewError(null); // Clear error on manual reload
    if (viewMode === 'preview') {
        setShowDelayedPreviewContent(false);
        setIframeKey(prevKey => prevKey + 1);
        const timerId = setTimeout(() => {
            setShowDelayedPreviewContent(true);
            setIframeKey(prevKey => prevKey + 1);
        }, 350); // Changed from 3000 to 350
        return () => clearTimeout(timerId);
    } else {
        setIframeKey(Date.now());
    }
  };
  
  useEffect(() => {
    const iframe = iframeRef.current;
    if (viewMode === 'preview' && iframe && showDelayedPreviewContent) {
      const handleNavigation = (event: Event) => {
        const target = event.target as HTMLAnchorElement;
        if (target.tagName === 'A' && target.href && iframe.contentDocument && iframe.contentDocument.body.contains(target)) {
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
              console.warn(`Preview navigation: File "${resolvedPath}" (from "${target.getAttribute('href')}") not found or not an HTML file in projectFiles.`);
            }
          }
        }
      };

      const handleIframeError = (event: ErrorEvent | Event) => {
        // For standard ErrorEvent
        if (event instanceof ErrorEvent && event.message) {
            setCurrentPreviewError({ message: event.message, stack: event.error?.stack });
        } 
        // Fallback for other error-like events if necessary, though less common for `window.onerror`
        else if ('message' in event && typeof event.message === 'string') {
             setCurrentPreviewError({ message: event.message as string });
        } else {
            setCurrentPreviewError({ message: 'An unknown error occurred in the preview.' });
        }
        // Prevent default browser error handling in console for the iframe if needed
        // event.preventDefault(); 
      };


      const onLoad = () => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.document.addEventListener('click', handleNavigation, true);
            // Listen for errors within the iframe
            iframe.contentWindow.onerror = (message, source, lineno, colno, error) => {
                 setCurrentPreviewError({ 
                    message: String(message), 
                    stack: error?.stack || `at ${source}:${lineno}:${colno}` 
                });
                return true; // Prevents the browser's default error handling
            };
          }
        } catch (e) { console.error("Error attaching listeners to iframe:", e); }
      };
      
      iframe.addEventListener('load', onLoad);
      return () => {
        if (iframe.contentWindow) {
          try { 
            iframe.contentWindow.document.removeEventListener('click', handleNavigation, true);
            if (iframe.contentWindow.onerror) iframe.contentWindow.onerror = null;
          } 
          catch (e) { /* ignore */ }
        }
        iframe.removeEventListener('load', onLoad);
      };
    }
  }, [viewMode, projectFiles, onActivePreviewHtmlFileChange, activePreviewHtmlFile, iframeKey, showDelayedPreviewContent]);

  const handleFixWithAI = () => {
    if (currentPreviewError) {
      onPreviewError(currentPreviewError);
      setCurrentPreviewError(null); // Close modal after initiating AI fix
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-800 relative"> {/* Added relative for modal positioning */}
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
          onClick={() => onViewModeChange('editor')}
          title="Switch to Editor Mode"
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors
            ${viewMode === 'editor' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          <CodeIcon className="w-4 h-4 mr-2" /> Editor
        </button>

        {viewMode === 'editor' && (
          <select
            value={activeEditorFile}
            onChange={(e) => onActiveEditorFileChange(e.target.value)}
            title="Select file to edit"
            className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none"
            disabled={availableFiles.length === 0}
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
              disabled={htmlFiles.length === 0}
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
            >
                <ReloadIcon className="w-4 h-4 mr-2" /> Reload
            </button>
          </>
        )}
      </div>

      {viewMode === 'editor' ? (
        <textarea
          key={activeEditorFile} 
          value={currentEditorContent}
          onChange={(e) => onCodeChange(activeEditorFile, e.target.value)}
          className="flex-grow w-full h-full p-4 bg-gray-800 text-gray-200 font-mono text-sm border-none outline-none resize-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
          placeholder={availableFiles.length > 0 && projectFiles[activeEditorFile] !== undefined ? `Edit ${activeEditorFile}` : (availableFiles.length > 0 ? "Select a file to edit or AI will generate files." : "AI will generate files here...")}
          disabled={availableFiles.length === 0 || projectFiles[activeEditorFile] === undefined}
        />
      ) : (
        <iframe
          ref={iframeRef}
          key={iframeKey} 
          srcDoc={iframeContentToRender}
          title="Preview"
          className="flex-grow w-full h-full border-none bg-white" 
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
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