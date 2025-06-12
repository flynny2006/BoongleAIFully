
import React from 'react';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface PublishSuccessModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  publicUrl: string;
  onClose: () => void;
}

const PublishSuccessModal: React.FC<PublishSuccessModalProps> = ({
  isOpen,
  title,
  message,
  publicUrl,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      aria-modal="true"
      role="dialog"
      aria-labelledby="publish-success-modal-title"
    >
      <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-2xl max-w-md w-full border border-green-500 transform transition-all duration-300 ease-in-out scale-100">
        <div className="flex flex-col items-center text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
          <h3 id="publish-success-modal-title" className="text-2xl font-semibold text-green-300 mb-3">
            {title}
          </h3>
          <p className="text-gray-300 mb-4 text-sm">{message}</p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2 mb-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors text-sm shadow-md hover:shadow-lg"
          >
            View Site
          </a>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
            aria-label="Close success message"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishSuccessModal;
