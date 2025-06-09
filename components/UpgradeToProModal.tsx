
import React from 'react';
import { useNavigate } from 'react-router-dom';
import AlertTriangleIcon from './icons/AlertTriangleIcon'; // Or a specific "Upgrade" icon

interface UpgradeToProModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradeToProModal: React.FC<UpgradeToProModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNavigateToPricing = () => {
    onClose(); // Close modal before navigating
    navigate('/pricing');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-2xl max-w-md w-full border border-purple-500">
        <div className="flex items-center mb-4">
          <AlertTriangleIcon className="w-8 h-8 text-yellow-400 mr-3 flex-shrink-0" />
          <h3 id="upgrade-modal-title" className="text-2xl font-semibold text-yellow-400">
            Upgrade Required
          </h3>
        </div>
        
        <p className="text-gray-200 mb-6 text-center text-md">
          Access to the code editor is a <span className="font-semibold text-purple-400">PRO</span> feature.
        </p>
        <p className="text-gray-300 mb-6 text-center text-sm">
          Please upgrade your plan to edit project files directly and unlock more powerful features.
        </p>
        
        <div className="flex flex-col sm:flex-row sm:justify-center sm:space-x-3 space-y-3 sm:space-y-0">
          <button
            onClick={handleNavigateToPricing}
            className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
          >
            View Plans
          </button>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeToProModal;
