
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import SendIcon from './icons/SendIcon';
import RestoreIcon from './icons/RestoreIcon';
import GenerationAnimation from './GenerationAnimation';

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string) => Promise<void>;
  isLoading: boolean;
  projectDescription: string | null;
  onRestoreVersion: (messageId: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ messages, onSendMessage, isLoading, projectDescription, onRestoreVersion }) => {
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (userInput.trim() && !isLoading) {
      await onSendMessage(userInput.trim());
      setUserInput('');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full w-full bg-gray-900 text-white flex flex-col border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold">AI Software Engineer</h2>
        {projectDescription && <p className="text-xs text-gray-400 mt-1 truncate" title={projectDescription}>Project: {projectDescription}</p>}
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
              {msg.sender === 'system' ? <em>{msg.text}</em> : <pre className="whitespace-pre-wrap break-words font-sans">{msg.text}</pre>}
              <div className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {msg.sender === 'ai' && msg.project_files_snapshot && index < messages.length - 1 && (messages[index+1]?.sender !== 'system' || !messages[index+1]?.text.startsWith("Restored project")) && (
              <button
                onClick={() => onRestoreVersion(msg.id)}
                disabled={isLoading}
                title="Restore project to this version"
                className="mt-1.5 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-xs text-gray-200 rounded flex items-center transition-colors disabled:opacity-50"
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
        <div className="flex items-center bg-gray-800 rounded-lg">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask AI to build or modify..."
            className="flex-grow p-3 bg-transparent text-white placeholder-gray-500 focus:outline-none rounded-l-lg"
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !userInput.trim()}
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
