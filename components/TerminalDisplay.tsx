
import React, { useState, useEffect, useRef } from 'react';

export interface TerminalLine {
  line: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system';
  timestamp?: number;
}

interface TerminalDisplayProps {
  outputLines: TerminalLine[];
  onCommand: (command: string) => void;
  onClear: () => void;
  isLoading: boolean; // For disabling input during AI processing or simulations
}

const TerminalDisplay: React.FC<TerminalDisplayProps> = ({ outputLines, onCommand, onClear, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  const endOfOutputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endOfOutputRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputLines]);

  useEffect(() => {
    // Focus input when terminal becomes visible and not loading
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onCommand(inputValue.trim()); // The ProjectPage will call addTerminalLine for the input
      setInputValue('');
    }
  };

  const getLineClass = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'input':
        return 'text-purple-300'; // User input brighter
      case 'success':
        return 'text-green-400'; 
      case 'error':
        return 'text-red-400';   
      case 'system':
        return 'text-blue-400'; 
      case 'output':
      default:
        return 'text-gray-200'; 
    }
  };

  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="h-full w-full flex flex-col bg-black text-gray-200 font-mono text-sm">
      <div className="p-2 bg-gray-950 border-b border-gray-700 flex justify-end sticky top-0 z-10">
        <button
          onClick={onClear}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isLoading}
          aria-label="Clear terminal output"
        >
          Clear Terminal
        </button>
      </div>
      <div 
        className="flex-grow p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        onClick={() => inputRef.current?.focus()} 
      >
        {outputLines.map((item, index) => (
          <div key={index} className="flex items-start mb-0.5">
            {item.timestamp && (
              <span className="text-gray-600 text-xs mr-2 select-none shrink-0 w-16 text-right">
                [{formatTimestamp(item.timestamp)}]
              </span>
            )}
            <span className={`flex-grow whitespace-pre-wrap break-words ${getLineClass(item.type)}`}>
              {item.type === 'input' && <span className="text-blue-400 select-none">user@ai-studio:~$ </span>}
              {item.line}
            </span>
          </div>
        ))}
        <div ref={endOfOutputRef} />
      </div>
      <form onSubmit={handleFormSubmit} className="p-2 border-t border-gray-700 bg-gray-950 sticky bottom-0 z-10">
        <div className="flex items-center">
          <span className="text-blue-400 mr-2 select-none">user@ai-studio:~$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className="flex-grow bg-transparent text-gray-200 focus:outline-none placeholder-gray-500 caret-purple-400"
            placeholder={isLoading ? "Processing..." : "Type a command and press Enter..."}
            disabled={isLoading}
            spellCheck="false"
            autoCapitalize="none"
            aria-label="Terminal command input"
          />
        </div>
      </form>
    </div>
  );
};

export default TerminalDisplay;
