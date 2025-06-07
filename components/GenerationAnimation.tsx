
import React from 'react';
import GlobeIcon from './icons/GlobeIcon';
import RightArrowIcon from './icons/RightArrowIcon';

const GenerationAnimation: React.FC = () => {
  return (
    <div className="flex items-center justify-start p-3 my-2 bg-gray-800 rounded-lg shadow-md">
      <GlobeIcon className="w-6 h-6 text-blue-400 mr-3 animate-pulse" />
      <div className="flex flex-col mr-3">
        <p className="text-sm text-gray-300 font-medium">AI is crafting your files...</p>
        <p className="text-xs text-gray-500">Please wait a moment.</p>
      </div>
      <div className="w-5 h-5 border-2 border-t-purple-500 border-gray-600 rounded-full animate-spin mr-3" role="status">
        <span className="sr-only">Loading...</span>
      </div>
      <RightArrowIcon className="w-5 h-5 text-purple-400" />
    </div>
  );
};

export default GenerationAnimation;
