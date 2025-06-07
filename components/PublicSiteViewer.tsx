import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getPublishedProject } from '../services/supabaseService';
import { PublishedProject } from '../types';

const PublicSiteViewer: React.FC = () => {
  const { publishId } = useParams<{ publishId: string }>();
  const [publishedData, setPublishedData] = useState<PublishedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        } else {
          setError("Published site not found.");
        }
      })
      .catch(err => {
        console.error("Error fetching published site:", err);
        setError(err.message || "Could not load published site.");
      })
      .finally(() => setLoading(false));
  }, [publishId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin mb-4"></div>
        <p>Loading Published Site...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-red-400 p-4">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p>{error}</p>
        <a href="#/" className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Go Home</a>
      </div>
    );
  }

  if (!publishedData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-gray-400 p-4">
        <p>Published site not found or data is unavailable.</p>
         <a href="#/" className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Go Home</a>
      </div>
    );
  }

  const entryPointContent = publishedData.files_snapshot[publishedData.entry_point_file];

  if (!entryPointContent) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-red-400 p-4">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p>Entry point file ({publishedData.entry_point_file}) not found in published data.</p>
         <a href="#/" className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Go Home</a>
      </div>
    );
  }
  
  // Basic mechanism to serve other files for the iframe
  // This is a simplified approach. A more robust solution might involve a service worker
  // or more complex iframe message passing if files need to be loaded dynamically by scripts in the iframe.
  // For now, if the HTML directly includes relative paths to CSS/JS that are also in files_snapshot,
  // it won't work automatically with srcDoc unless those files are also embedded or served.
  // This basic render will work for self-contained HTML or HTML that uses external CDNs.
  // To handle relative paths for CSS/JS within the snapshot, the HTML would need to be processed
  // to inline them or use data URLs, which is complex.
  // The AI should be prompted to produce self-contained HTML as much as possible or use CDNs.

  return (
    <iframe
      ref={iframeRef}
      srcDoc={entryPointContent}
      title={`Published Site: ${publishId}`}
      className="w-full h-screen border-none bg-white"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms" // Standard sandbox
    />
  );
};

export default PublicSiteViewer;
