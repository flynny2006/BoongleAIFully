
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AVAILABLE_MODELS } from '../constants';
import { ModelId } from '../types';
import LeftArrowIcon from './icons/LeftArrowIcon';
import InspectIcon from './icons/InspectIcon'; 

interface TopBarProps {
  selectedModel: ModelId;
  onModelChange: (newModelId: ModelId) => void;
  isLoading: boolean; 
  projectName: string;
  onPublish: () => void;
  isPublished: boolean;
  isPublishing: boolean;
  isInspectModeActive: boolean; 
  onToggleInspectMode: () => void; 
  isTerminalActive: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ 
  selectedModel, 
  onModelChange, 
  isLoading, 
  projectName,
  onPublish,
  isPublished,
  isPublishing,
  isInspectModeActive,
  onToggleInspectMode,
  isTerminalActive
}) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const commonDisabled = isLoading || isPublishing || isTerminalActive;

  return (
    <div className="p-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between space-x-4">
      <div className="flex items-center space-x-3">
        <button
          onClick={handleGoHome}
          title="Back to Home"
          className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          aria-label="Back to Home"
          disabled={commonDisabled} // Disable if busy or terminal active
        >
          <LeftArrowIcon className="w-5 h-5" />
        </button>
        <div className="text-lg font-semibold text-purple-400 truncate" title={projectName}>
          {projectName}
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleInspectMode}
          title={isInspectModeActive ? "Disable Element Inspector" : "Enable Element Inspector"}
          className={`p-2 rounded-md transition-colors
            ${isInspectModeActive ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}
            ${commonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={isInspectModeActive}
          disabled={commonDisabled}
        >
          <InspectIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onPublish}
          disabled={commonDisabled || isInspectModeActive}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center
            ${isPublishing ? 'bg-gray-600' : 
              (isPublished ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white')}
            ${(commonDisabled || isInspectModeActive) ? 'opacity-50 cursor-not-allowed' : ''}
            disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          {isPublishing ? (
            <>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2"></div>
              {isPublished ? 'Updating...' : 'Publishing...'}
            </>
          ) : (isPublished ? 'Update Site' : 'Publish Site')}
        </button>
        <div className="flex items-center space-x-2">
          <label htmlFor="model-switcher" className="text-sm text-gray-400">Model:</label>
          <select
            id="model-switcher"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value as ModelId)}
            disabled={commonDisabled || AVAILABLE_MODELS.length <= 1 || isInspectModeActive}
            className={`px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none 
            ${(commonDisabled || AVAILABLE_MODELS.length <= 1 || isInspectModeActive) ? 'opacity-50 cursor-not-allowed' : ''}
            disabled:opacity-70 disabled:cursor-not-allowed`}
            title={AVAILABLE_MODELS.length <= 1 ? "Only one model available" : "Select Gemini Model"}
          >
            {AVAILABLE_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
export default TopBar;
