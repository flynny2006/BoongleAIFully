import React, { useState, useEffect, useRef } from 'react';
import CodeIcon from './icons/CodeIcon';
import PreviewIcon from './icons/PreviewIcon';
import ReloadIcon from './icons/ReloadIcon';
import { getPreviewLoadingScreenHtml } from './PreviewLoadingScreen';

interface EditorPreviewProps {
  projectFiles: Record<string, string>;
  activeEditorFile: string;
  onActiveEditorFileChange: (filePath: string) => void;
  activePreviewHtmlFile: string;
  onActivePreviewHtmlFileChange: (filePath: string) => void;
  onCodeChange: (filePath: string, newCode: string) => void;
  viewMode: 'editor' | 'preview';
  onViewModeChange: (mode: 'editor' | 'preview') => void;
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
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState<number>(Date.now());

  const availableFiles = Object.keys(projectFiles);
  const htmlFiles = availableFiles.filter(file => file.endsWith('.html'));

  const currentEditorContent = projectFiles[activeEditorFile] || '';
  // Use project file content if available, otherwise default loading screen
  const currentPreviewContent = projectFiles[activePreviewHtmlFile] || defaultPreviewContent;


  const handleReloadPreview = () => {
    setIframeKey(Date.now());
  };
  
  useEffect(() => {
    const iframe = iframeRef.current;
    if (viewMode === 'preview' && iframe) {
      const handleNavigation = (event: Event) => {
        const target = event.target as HTMLAnchorElement;
        // Check if the click originated from an anchor tag within the iframe's document body
        if (target.tagName === 'A' && target.href && iframe.contentDocument && iframe.contentDocument.body.contains(target)) {
          
          const targetUrl = new URL(target.href, target.baseURI); // Resolve href against baseURI of iframe doc

          // Check if it's a relative link within the "same origin" (srcDoc is effectively same origin)
          // and not an absolute link to an external site.
          // For srcDoc, target.baseURI will be about:srcdoc or similar.
          // We are interested in relative paths like './about.html' or 'page.html'
          
          let intendedPath = target.getAttribute('href'); // Get the raw href attribute

          if (intendedPath && !intendedPath.startsWith('http') && !intendedPath.startsWith('//') && !intendedPath.startsWith('mailto:') && !intendedPath.startsWith('tel:')) {
            event.preventDefault(); 
            
            if (intendedPath.startsWith('./')) {
              intendedPath = intendedPath.substring(2);
            } else if (intendedPath.startsWith('/')) {
              // Absolute path relative to "root" of srcDoc context
              intendedPath = intendedPath.substring(1);
            }
            
            // Resolve relative path based on current activePreviewHtmlFile's directory
            const currentDirMatch = activePreviewHtmlFile.match(/^(.*\/)[^/]*$/);
            const currentDir = currentDirMatch ? currentDirMatch[1] : '';
            // If intendedPath is already absolute-like (e.g. from root '/file.html'), currentDir shouldn't apply
            const resolvedPath = intendedPath.includes('/') ? intendedPath : (currentDir + intendedPath);


            if (projectFiles[resolvedPath] && resolvedPath.endsWith('.html')) {
              onActivePreviewHtmlFileChange(resolvedPath);
            } else {
              console.warn(`Preview navigation: File "${resolvedPath}" (from "${target.getAttribute('href')}") not found or not an HTML file in projectFiles.`);
            }
          }
        }
      };

      const onLoad = () => {
        try {
          if (iframe.contentWindow && iframe.contentWindow.document) {
            // Use capture phase for the click listener to catch it early
            iframe.contentWindow.document.addEventListener('click', handleNavigation, true);
          } else {
            console.warn("Cannot access iframe content document to attach navigation listeners.");
          }
        } catch (e) {
          console.error("Error attaching navigation listeners to iframe:", e);
        }
      };
      
      iframe.addEventListener('load', onLoad);
      return () => {
        if (iframe.contentWindow && iframe.contentWindow.document) {
          try {
            iframe.contentWindow.document.removeEventListener('click', handleNavigation, true);
          } catch (e) { /* ignore cleanup errors */ }
        }
        iframe.removeEventListener('load', onLoad);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, projectFiles, onActivePreviewHtmlFileChange, activePreviewHtmlFile, iframeKey]);

  return (
    <div className="h-full w-full flex flex-col bg-gray-800">
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
          key={`${activePreviewHtmlFile}-${iframeKey}`}
          srcDoc={currentPreviewContent} // Uses defaultPreviewContent if projectFiles[activePreviewHtmlFile] is empty/undefined
          title="Preview"
          className="flex-grow w-full h-full border-none bg-white" 
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      )}
    </div>
  );
};

export default EditorPreview;
