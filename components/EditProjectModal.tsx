
import React, { useState, useEffect, FormEvent } from 'react';
import { Project } from '../types';

interface EditProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onSave: (projectId: string, newName: string, newDescription: string) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, project, onSave, onClose, isSaving }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        alert("Project name cannot be empty."); // Or use a more elegant notification
        return;
    }
    await onSave(project.id, name.trim(), description.trim());
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out"
      aria-modal="true"
      role="dialog"
      aria-labelledby="edit-project-modal-title"
    >
      <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-2xl max-w-lg w-full border border-purple-500 transform transition-all duration-300 ease-in-out scale-100">
        <h3 id="edit-project-modal-title" className="text-2xl font-semibold text-purple-400 mb-6 text-center">
          Edit Project Details
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="edit-project-name" className="block text-sm font-medium text-gray-300 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
              disabled={isSaving}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="edit-project-description" className="block text-sm font-medium text-gray-300 mb-1">
              Project Description
            </label>
            <textarea
              id="edit-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none resize-y"
              disabled={isSaving}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                  Saving...
                </div>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;
