
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SelectedElementDetails } from '../types';
import SendIcon from './icons/SendIcon';
import RestoreIcon from './icons/RestoreIcon';
import GenerationAnimation from './GenerationAnimation';

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string, selectedElementContext?: SelectedElementDetails | null) => Promise<void>;
  isLoading: boolean;
  projectDescription: string | null;
  onRestoreVersion: (messageId: string) => void;
  selectedElementContext: SelectedElementDetails | null;
  onClearElementSelection: () => void;
  isInspectModeActive: boolean;
  applyAiChanges: boolean; // New prop
  onToggleApplyAiChanges: () => void; // New prop
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  projectDescription, 
  onRestoreVersion,
  selectedElementContext,
  onClearElementSelection,
  isInspectModeActive,
  applyAiChanges, // Destructure new prop
  onToggleApplyAiChanges // Destructure new prop
}) => {
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (userInput.trim() && !isLoading) {
      await onSendMessage(userInput.trim(), selectedElementContext);
      setUserInput('');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const placeholderText = selectedElementContext 
    ? `Modifying <${selectedElementContext.tagName}>: ${selectedElementContext.textSnippet || selectedElementContext.id || selectedElementContext.classList[0] || 'element'}...`
    : "Ask AI to build or modify...";

  useEffect(() => {
    if (userInput && selectedElementContext && !isInspectModeActive) {
      // Logic for handling stale selection with user input
    }
  }, [userInput, selectedElementContext, isInspectModeActive, onClearElementSelection]);

  return (
    <div className="h-full w-full bg-gray-900 text-white flex flex-col border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold">AI Software Engineer</h2>
        {projectDescription && <p className="text-xs text-gray-400 mt-1 truncate" title={projectDescription}>Project: {projectDescription}</p>}
        
        <div className="mt-3 flex items-center justify-between">
          <label htmlFor="apply-ai-changes-toggle" className="text-sm text-gray-300 cursor-pointer">
            Apply AI Changes to App:
          </label>
          <button
            id="apply-ai-changes-toggle"
            onClick={onToggleApplyAiChanges}
            disabled={isLoading || isInspectModeActive}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed
              ${applyAiChanges ? 'bg-purple-600' : 'bg-gray-600'}`}
            role="switch"
            aria-checked={applyAiChanges}
          >
            <span
              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform
                ${applyAiChanges ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
        {!applyAiChanges && (
          <p className="text-xs text-yellow-400 mt-1.5 bg-yellow-900 bg-opacity-50 p-1.5 rounded-md">
            Chat-Only Mode: AI file changes won't be applied.
          </p>
        )}
      </div>
      
      <div className="flex-grow p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800" role="log" aria-live="polite">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg shadow ${
                msg.sender === 'user'
                  ? 'bg-purple-600 text-white'
                  : msg.sender === 'ai'
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-yellow-600 text-white text-sm italic' 
              }`}
            >
              {msg.selected_element_context && msg.sender === 'user' && (
                <div className="mb-1.5 p-1.5 bg-purple-700 rounded text-xs text-purple-100 border border-purple-500">
                  <p className="font-semibold">Context: Selected Element</p>
                  <p className="truncate" title={msg.selected_element_context.descriptionForAI}>
                    {msg.selected_element_context.descriptionForAI.length > 60 ? msg.selected_element_context.descriptionForAI.substring(0, 57) + "..." : msg.selected_element_context.descriptionForAI}
                  </p>
                </div>
              )}
              {msg.sender === 'system' ? <em>{msg.text}</em> : <pre className="whitespace-pre-wrap break-words font-sans">{msg.text}</pre>}
              <div className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {msg.sender === 'ai' && msg.project_files_snapshot && index < messages.length - 1 && (messages[index+1]?.sender !== 'system' || !messages[index+1]?.text.startsWith("Restored project")) && (
              <button
                onClick={() => onRestoreVersion(msg.id)}
                disabled={isLoading || isInspectModeActive || !applyAiChanges} // Disable if applyAiChanges is false
                title={!applyAiChanges ? "Enable 'Apply AI Changes' to restore" : "Restore project to this version"}
                className="mt-1.5 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-xs text-gray-200 rounded flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RestoreIcon className="w-3 h-3 mr-1.5" />
                Restore this version
              </button>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start"> 
            <GenerationAnimation />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-gray-700 bg-gray-900">
        {selectedElementContext && (
            <div className="mb-2 p-2 bg-gray-800 border border-purple-500 rounded-md text-xs text-purple-300">
                Modifying: <span className="font-semibold">{selectedElementContext.tagName.toUpperCase()}</span>
                {selectedElementContext.id && `#${selectedElementContext.id}`}
                {selectedElementContext.classList.length > 0 && `.${selectedElementContext.classList.join('.')}`}
                {selectedElementContext.textSnippet && <span className="italic"> (text: "{selectedElementContext.textSnippet.substring(0,20)}...")</span>}
                <button onClick={onClearElementSelection} className="ml-2 text-red-400 hover:text-red-300 text-xs font-bold" title="Clear selection">[x]</button>
            </div>
        )}
        <div className="flex items-center bg-gray-800 rounded-lg">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholderText}
            className="flex-grow p-3 bg-transparent text-white placeholder-gray-500 focus:outline-none rounded-l-lg"
            disabled={isLoading || isInspectModeActive}
            aria-label="Chat input"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !userInput.trim() || isInspectModeActive}
            className="p-3 bg-purple-600 text-white rounded-r-lg hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" role="status" aria-label="Loading"></div>
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
