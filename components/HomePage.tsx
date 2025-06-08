
import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, createProject, getUserProjects } from '../services/supabaseService';
import { Project, ModelId } from '../types';
import { AVAILABLE_MODELS } from '../constants';
import { resetChatSession } from '../services/geminiService';


const HomePage: React.FC = () => {
  const { user, session, login, register, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // For registration
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectModel, setNewProjectModel] = useState<ModelId>(AVAILABLE_MODELS[0].id);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectCreationLoading, setProjectCreationLoading] = useState(false);


  useEffect(() => {
    if (user && session) {
      setProjectsLoading(true);
      getUserProjects(user.id)
        .then(setProjects)
        .catch(err => {
          console.error("Error fetching projects:", err);
          setAuthError("Could not load your projects.");
        })
        .finally(() => setProjectsLoading(false));
    } else {
      setProjects([]); // Clear projects if user logs out
    }
  }, [user, session]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthActionLoading(true);
    setAuthError(null);
    let authPromise;
    if (isRegisterMode) {
      if (!username.trim()) {
        setAuthError("Username is required for registration.");
        setAuthActionLoading(false);
        return;
      }
      authPromise = register(email, password, username);
    } else {
      authPromise = login(email, password);
    }
    const { error } = await authPromise;
    if (error) {
      setAuthError(error.message);
    } else {
      // Success, redirect or update UI will be handled by AuthContext effect
      setEmail(''); setPassword(''); setUsername(''); // Clear form
    }
    setAuthActionLoading(false);
  };

  const handleCreateNewProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setProjectCreationLoading(true);
    setAuthError(null);
    resetChatSession(); 

    try {
      const createdProject = await createProject({
        name: newProjectName.trim(),
        description: `New project: ${newProjectName.trim()}`, // Initial description
        model_id: newProjectModel,
        active_editor_file: 'index.html',
        active_preview_html_file: 'index.html',
        view_mode: 'preview',
      }, user.id);
      
      // Create a default index.html for the new project
       await supabase.from('project_files').insert([{
         project_id: createdProject.id,
         file_path: 'index.html',
         content: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New Project</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 text-gray-900 flex items-center justify-center h-screen"><h1 class="text-2xl">Welcome to your new project!</h1></body></html>'
       }]);

      setNewProjectName('');
      navigate(`/project/${createdProject.id}`);
    } catch (err: any) {
      console.error("Error creating project:", err);
      setAuthError(err.message || "Failed to create project.");
    } finally {
      setProjectCreationLoading(false);
    }
  };
  
  const handleLogout = async () => {
    setAuthActionLoading(true);
    await logout();
    setAuthActionLoading(false);
    navigate('/');
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">AI Software Engineer Studio</h1>
        <form onSubmit={handleAuthSubmit} className="w-full max-w-sm p-8 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-center text-purple-400">{isRegisterMode ? 'Register New Account' : 'Login'}</h2>
          {authError && <p className="mb-4 text-red-400 bg-red-900 p-2 rounded text-sm">{authError}</p>}
          
          {isRegisterMode && (
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="Username" required
              className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          )}
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" required
            className="w-full p-3 mb-6 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
          <button type="submit" disabled={authActionLoading}
            className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold transition-colors disabled:bg-gray-600"
          >
            {authActionLoading ? (isRegisterMode ? 'Registering...' : 'Logging in...') : (isRegisterMode ? 'Register' : 'Login')}
          </button>
          <button type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(null); }}
            className="w-full mt-4 text-sm text-purple-400 hover:text-purple-300"
          >
            {isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Register"}
          </button>
        </form>
      </div>
    );
  }

  // User is logged in
  return (
    <div className="flex flex-col items-center min-h-screen bg-black text-white p-4 pt-10 overflow-y-auto">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Your Projects</h1>
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/pricing')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors text-sm"
            >
              Pricing
            </button>
            <button onClick={handleLogout} disabled={authActionLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors text-sm"
            >
              {authActionLoading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
        
        {authError && <p className="mb-4 text-red-400 bg-red-900 p-3 rounded text-sm">{authError}</p>}

        {/* Create New Project Form */}
        <form onSubmit={handleCreateNewProject} className="mb-10 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-4 text-purple-400">Create New Project</h2>
          <input
            type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project Name (e.g., My Awesome App)" required
            className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
          <div className="mb-4">
            <label htmlFor="model-select-home" className="block text-sm font-medium text-gray-300 mb-1">Select AI Model:</label>
            <select 
              id="model-select-home"
              value={newProjectModel} 
              onChange={(e) => setNewProjectModel(e.target.value as ModelId)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white focus:ring-purple-500 focus:border-purple-500 outline-none"
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={!newProjectName.trim() || projectCreationLoading}
            className="w-full p-3 bg-green-600 hover:bg-green-700 rounded text-white font-semibold transition-colors disabled:bg-gray-600"
          >
            {projectCreationLoading ? 'Creating...' : 'Start Building'}
          </button>
        </form>

        {/* Projects List */}
        {projectsLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-400">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-gray-500 py-8">You don't have any projects yet. Create one above!</p>
        ) : (
          <div className="space-y-4">
            {projects.map(proj => (
              <div key={proj.id} className="p-5 bg-gray-800 rounded-lg shadow-lg border border-gray-700 hover:border-purple-500 transition-all">
                <h3 className="text-xl font-semibold text-purple-400 mb-1">{proj.name}</h3>
                <p className="text-sm text-gray-400 mb-3 truncate" title={proj.description || ''}>{proj.description || 'No description'}</p>
                <p className="text-xs text-gray-500 mb-1">Model: {AVAILABLE_MODELS.find(m=>m.id === proj.model_id)?.name || proj.model_id}</p>
                <p className="text-xs text-gray-500 mb-3">Last Modified: {new Date(proj.last_modified).toLocaleString()}</p>
                <button
                  onClick={() => navigate(`/project/${proj.id}`)}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors text-sm"
                >
                  Open Project
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
