import React from 'react';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface PreviewErrorModalProps {
  errorMessage: string;
  errorStack?: string;
  onFixWithAI: () => void;
  onClose: () => void;
}

const PreviewErrorModal: React.FC<PreviewErrorModalProps> = ({
  errorMessage,
  errorStack,
  onFixWithAI,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="error-modal-title"
    >
      <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-2xl max-w-2xl w-full border border-red-500">
        <div className="flex items-center mb-4">
          <AlertTriangleIcon className="w-8 h-8 text-red-400 mr-3 flex-shrink-0" />
          <h3 id="error-modal-title" className="text-2xl font-semibold text-red-400">
            Build Unsuccessful
          </h3>
        </div>
        <p className="text-gray-300 mb-2">An error occurred in the preview:</p>
        <div className="bg-gray-900 p-3 rounded-md mb-4 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
          <p className="text-red-300 text-sm font-mono whitespace-pre-wrap break-all">
            {errorMessage}
          </p>
        </div>
        {errorStack && (
          <>
            <p className="text-gray-400 mb-1 text-sm">Stack Trace:</p>
            <div className="bg-gray-900 p-3 rounded-md mb-6 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
              <pre className="text-gray-400 text-xs font-mono whitespace-pre-wrap break-all">
                {errorStack}
              </pre>
            </div>
          </>
        )}
        <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
          <button
            onClick={onFixWithAI}
            className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
          >
            Fix with AI
          </button>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewErrorModal;