import React from 'react';
import { AVAILABLE_MODELS } from '../constants';
import { ModelId } from '../types';

interface TopBarProps {
  selectedModel: ModelId;
  onModelChange: (newModelId: ModelId) => void;
  isLoading: boolean; // General loading state, e.g., for AI
  projectName: string;
  onPublish: () => void;
  isPublished: boolean;
  isPublishing: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ 
  selectedModel, 
  onModelChange, 
  isLoading, 
  projectName,
  onPublish,
  isPublished,
  isPublishing
}) => {
  return (
    <div className="p-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between space-x-4">
      <div className="text-lg font-semibold text-purple-400 truncate" title={projectName}>
        {projectName}
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onPublish}
          disabled={isPublishing || isLoading}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center
            ${isPublishing ? 'bg-gray-600 cursor-not-allowed' : 
              (isPublished ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white')}
            disabled:opacity-70`}
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
            disabled={isLoading || isPublishing || AVAILABLE_MODELS.length <= 1}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 outline-none appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
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
