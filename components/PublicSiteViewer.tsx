
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublishedProject } from '../services/supabaseService';
import { PublishedProject } from '../types';

const PublicSiteViewer: React.FC = () => {
  const { publishId } = useParams<{ publishId: string }>();
  const navigate = useNavigate();
  const [publishedData, setPublishedData] = useState<PublishedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [activeFileInPreview, setActiveFileInPreview] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [iframeContent, setIframeContent] = useState<string>('');


  useEffect(() => {
    if (!publishId) {
      setError("No publish ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    getPublishedProject(publishId)
      .then(data => {
        if (data) {
          setPublishedData(data);
          setActiveFileInPreview(data.entry_point_file);
          const initialContent = data.files_snapshot[data.entry_point_file];
          if (initialContent === undefined) {
            setError(`Entry point file "${data.entry_point_file}" not found in published data.`);
            setIframeContent(`<div style="font-family:sans-serif;color:red;padding:20px;">Error: Entry point file <strong>${data.entry_point_file}</strong> not found.</div>`);
          } else {
            setIframeContent(initialContent);
          }
        } else {
          setError("Published site not found.");
          setIframeContent(`<div style="font-family:sans-serif;color:red;padding:20px;">Error: Published site not found.</div>`);
        }
      })
      .catch(err => {
        console.error("Error fetching published site:", err);
        setError(err.message || "Could not load published site.");
        setIframeContent(`<div style="font-family:sans-serif;color:red;padding:20px;">Error: Could not load published site. ${err.message}</div>`);
      })
      .finally(() => setLoading(false));
  }, [publishId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !publishedData) return;

    const currentFileContent = publishedData.files_snapshot[activeFileInPreview];
    if (currentFileContent === undefined && activeFileInPreview) {
       // Only set error content if activeFileInPreview is something (not initial blank state)
        setIframeContent(`<div style="font-family:sans-serif;color:red;padding:20px;">Error: File <strong>${activeFileInPreview}</strong> not found in this project.</div>`);
    } else if (currentFileContent) {
        setIframeContent(currentFileContent);
    }
    // Update iframeKey to ensure re-render if content string itself changes for the same file path (less likely)
    // or when activeFileInPreview changes leading to new content.
    setIframeKey(Date.now());

  }, [activeFileInPreview, publishedData]);


  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !publishedData ) return;

    const handleLoad = () => {
      try {
        if (!iframe.contentWindow || !iframe.contentDocument) return;

        const documentBaseUrl = activeFileInPreview 
            ? new URL(activeFileInPreview, "file:///project-root/").href 
            : "file:///project-root/index.html";

        const handleNavigation = (event: Event) => {
          const target = event.target as HTMLElement;
          const anchor = target.closest('a');

          if (!anchor || !anchor.hasAttribute('href')) return;

          const href = anchor.getAttribute('href')!;
          let resolvedUrl: URL;

          try {
            resolvedUrl = new URL(href, documentBaseUrl);
          } catch (e) {
            console.warn("PublicSiteViewer: Could not parse href:", href, "with base", documentBaseUrl, e);
            return;
          }

          if (resolvedUrl.protocol === 'http:' || resolvedUrl.protocol === 'https:') {
            // External link, let it open, preferably in a new tab
             if (anchor.target !== '_blank') {
                anchor.target = '_blank'; // Force new tab for external links if not already set
                // Re-trigger click might be complex, simpler to just instruct users or rely on browser defaults
             }
            return; 
          }

          if (resolvedUrl.protocol === 'file:') { // Our virtual project links
            event.preventDefault();

            const potentialNewFilePath = resolvedUrl.pathname.startsWith('/project-root/')
                ? resolvedUrl.pathname.substring('/project-root/'.length)
                : resolvedUrl.pathname.substring(1); 

            // Check for hash link on the *current* page
            if (resolvedUrl.hash && potentialNewFilePath === activeFileInPreview) {
              const elementId = resolvedUrl.hash.substring(1); // Remove #
              if (iframeRef.current?.contentDocument) {
                const elementToScroll = iframeRef.current.contentDocument.getElementById(elementId);
                if (elementToScroll) {
                  elementToScroll.scrollIntoView({ behavior: 'smooth' });
                } else {
                  console.warn(`PublicSiteViewer: Element with ID "${elementId}" not found in ${activeFileInPreview}`);
                }
              }
              return;
            }

            // Check for navigation to a different HTML page
            if (potentialNewFilePath.endsWith('.html') || potentialNewFilePath.endsWith('.htm')) {
              if (publishedData.files_snapshot.hasOwnProperty(potentialNewFilePath)) {
                setActiveFileInPreview(potentialNewFilePath); // This will trigger the other useEffect to update iframeContent and key
              } else {
                console.warn(`PublicSiteViewer: Target HTML file "${potentialNewFilePath}" (from href "${href}") not found in project files.`);
                if(iframeRef.current?.contentDocument?.body) {
                  iframeRef.current.contentDocument.body.innerHTML = `<div style="font-family:sans-serif;color:red;padding:20px;">Error: Linked page <strong>${potentialNewFilePath}</strong> not found.</div>`;
                }
              }
              return;
            }
          }
          console.log("PublicSiteViewer: Unhandled link type or path:", href, "Resolved to:", resolvedUrl.href);
        };
        
        iframe.contentDocument.addEventListener('click', handleNavigation, true);

        // Cleanup this specific event listener
        return () => {
          if (iframe.contentDocument) {
            try {
              iframe.contentDocument.removeEventListener('click', handleNavigation, true);
            } catch (e) { /* ignore cleanup errors if iframe is already gone */ }
          }
        };

      } catch (e) {
        console.error("Error in iframe onLoad (PublicSiteViewer):", e);
      }
    };
    
    iframe.addEventListener('load', handleLoad);
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleLoad);
      }
    };

  }, [publishedData, activeFileInPreview, iframeKey]); // Re-run if key data changes

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin mb-4"></div>
        <p>Loading Published Site...</p>
      </div>
    );
  }

  // Error state is handled by iframeContent being set to an error message.
  // The initial error from fetching publishedData is also handled by setting iframeContent.

  if (!publishedData && !loading) { // If loading is done and still no data (e.g. invalid publishId early on)
     return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-red-400 p-4">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p>{error || "Published site data is unavailable."}</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Go Home</button>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      key={iframeKey} // Force re-render on key change
      srcDoc={iframeContent}
      title={`Published Site: ${publishId}`}
      className="w-full h-screen border-none bg-white"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
};

export default PublicSiteViewer;
