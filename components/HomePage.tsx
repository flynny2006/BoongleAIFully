
import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, createProject, getUserProjects, deleteProjectAndRelatedData, updateProject } from '../services/supabaseService';
import { Project, ModelId } from '../types';
import { AVAILABLE_MODELS, USER_SET_GEMINI_API_KEY_LS_KEY } from '../constants';
import { resetChatSession } from '../services/geminiService';
import { usePlan } from '../hooks/usePlan';
import DeleteIcon from './icons/DeleteIcon';
import SearchIcon from './icons/SearchIcon';
import EditIcon from './icons/EditIcon';
import EditProjectModal from './EditProjectModal';
import KeyIcon from './icons/KeyIcon'; 
import UserCircleIcon from './icons/UserCircleIcon'; 

type SortOrder = 'recent' | 'oldest' | 'alphabetical';

const HomePage: React.FC = () => {
  const { user, session, login, register, logout, verifyEmailOtp, loading: authLoading } = useAuth();
  const { plan: currentPlan } = usePlan(); 
  const navigate = useNavigate();

  // Auth form states
  const [email, setEmail] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  // OTP state
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectModel, setNewProjectModel] = useState<ModelId>(AVAILABLE_MODELS[0].id);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectCreationLoading, setProjectCreationLoading] = useState(false);
  const [projectDeletionLoading, setProjectDeletionLoading] = useState<string | null>(null);

  // Search and Sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');

  // Edit Project Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSavingProjectDetails, setIsSavingProjectDetails] = useState(false);

  // User-set Gemini API Key states
  const [userApiKeyInput, setUserApiKeyInput] = useState('');
  const [storedUserApiKey, setStoredUserApiKey] = useState<string | null>(null);
  const [apiKeyMessage, setApiKeyMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);


  useEffect(() => {
    if (user && session) {
      setProjectsLoading(true);
      setAuthError(null); 
      setAuthSuccessMessage(null);
      getUserProjects(user.id)
        .then(setProjects)
        .catch(err => {
          console.error("Error fetching projects:", err);
          setAuthError("Could not load your projects.");
        })
        .finally(() => setProjectsLoading(false));
      setShowOtpInput(false);
    } else {
      setProjects([]);
    }
  }, [user, session]);

  // Load user-set API key from localStorage on mount
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem(USER_SET_GEMINI_API_KEY_LS_KEY);
      if (savedKey) {
        setStoredUserApiKey(savedKey);
      }
    } catch (e) {
      console.warn("Could not access localStorage to get API key:", e);
      setApiKeyMessage({ type: 'error', text: 'Could not access local storage for API key.' });
    }
  }, []);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthActionLoading(true);
    setAuthError(null);
    setAuthSuccessMessage(null);
    setOtpError(null);

    if (isRegisterMode) {
      if (!username.trim()) {
        setAuthError("Username is required for registration.");
        setAuthActionLoading(false);
        return;
      }
      if (email.includes('+')) {
        setAuthError("Email addresses cannot contain '+' characters.");
        setAuthActionLoading(false);
        return;
      }
      const { data: signUpData, error } = await register(email, password, username);
      if (error) {
        setAuthError(error.message);
      } else if (signUpData?.user) {
        if (signUpData.user.identities && signUpData.user.identities.length > 0 && !signUpData.user.email_confirmed_at) {
            setAuthSuccessMessage(`Registration successful! A verification code has been sent to ${email}. Please enter it below.`);
            setRegisteredEmail(email);
            setShowOtpInput(true);
        } else if (signUpData.user.email_confirmed_at) {
            setAuthSuccessMessage("Registration successful and email confirmed!");
        } else {
            setAuthSuccessMessage("Registration successful! Proceed to login.");
        }
      }
    } else {
      const { error } = await login(email, password);
      if (error) {
        setAuthError(error.message);
      }
    }
    setAuthActionLoading(false);
  };

  const handleVerifyOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !registeredEmail) {
      setOtpError("Please enter the 6-digit code.");
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError(null);
    const { error } = await verifyEmailOtp(registeredEmail, otp);
    if (error) {
      setOtpError(error.message);
    } else {
      setAuthSuccessMessage("Email verified successfully! You are now logged in.");
      setShowOtpInput(false);
      setOtp('');
    }
    setIsVerifyingOtp(false);
  };
  
  const handleSkipOtp = () => {
    setShowOtpInput(false);
    setAuthSuccessMessage("Registration complete. You can verify your email later. Please log in.");
    setIsRegisterMode(false);
  }

  const handleCreateNewProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setProjectCreationLoading(true);
    setAuthError(null);
    setAuthSuccessMessage(null);
    resetChatSession(); // Important: Reset session to ensure new API key (if set) is picked up

    try {
      const createdProject = await createProject({
        name: newProjectName.trim(),
        description: `New project: ${newProjectName.trim()}`,
        model_id: newProjectModel,
        active_editor_file: 'index.html',
        active_preview_html_file: 'index.html',
        view_mode: 'preview',
      }, user.id);

       await supabase.from('project_files').insert([{
         project_id: createdProject.id,
         file_path: 'index.html',
         content: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New Project</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 text-gray-900 flex items-center justify-center h-screen"><h1 class="text-2xl">Welcome to your new project!</h1></body></html>'
       }]);

      setNewProjectName('');
      setAuthSuccessMessage(`Project "${createdProject.name}" created!`);
      setProjects(prev => [createdProject, ...prev]);
      navigate(`/project/${createdProject.id}`);
    } catch (err: any) {
      console.error("Error creating project:", err);
      setAuthError(err.message || "Failed to create project.");
    } finally {
      setProjectCreationLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      setProjectDeletionLoading(projectId);
      setAuthError(null);
      setAuthSuccessMessage(null);
      try {
        await deleteProjectAndRelatedData(projectId, user!.id);
        setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
        setAuthSuccessMessage(`Project "${projectName}" deleted successfully.`);
      } catch (err: any) {
        console.error("Error deleting project:", err);
        setAuthError(err.message || "Failed to delete project.");
      } finally {
        setProjectDeletionLoading(null);
      }
    }
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditingProject(null);
    setIsEditModalOpen(false);
  };

  const handleSaveProjectDetails = async (projectId: string, newName: string, newDescription: string) => {
    if (!user) return;
    setIsSavingProjectDetails(true);
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      const updatedProjectData = await updateProject(projectId, { name: newName, description: newDescription });
      setProjects(prevProjects => prevProjects.map(p => p.id === projectId ? updatedProjectData : p));
      setAuthSuccessMessage(`Project "${newName}" updated successfully.`);
      handleCloseEditModal();
    } catch (err: any) {
      console.error("Error updating project details:", err);
      setAuthError(err.message || "Failed to update project details.");
    } finally {
      setIsSavingProjectDetails(false);
    }
  };


  const handleLogout = async () => {
    setAuthActionLoading(true);
    await logout();
    setAuthActionLoading(false);
    setSearchTerm('');
    setSortOrder('recent');
    navigate('/');
  }

  const handleSaveApiKey = (e: FormEvent) => {
    e.preventDefault();
    if (!userApiKeyInput.trim()) {
      setApiKeyMessage({ type: 'error', text: 'API Key cannot be empty.' });
      return;
    }
    try {
      localStorage.setItem(USER_SET_GEMINI_API_KEY_LS_KEY, userApiKeyInput.trim());
      setStoredUserApiKey(userApiKeyInput.trim());
      setUserApiKeyInput(''); // Clear input field
      setApiKeyMessage({ type: 'success', text: 'API Key saved successfully!' });
      resetChatSession(); // Reset to force geminiService to pick up new key
    } catch (error) {
      console.error("Error saving API key to localStorage:", error);
      setApiKeyMessage({ type: 'error', text: 'Failed to save API Key.' });
    }
  };

  const handleClearApiKey = () => {
    try {
      localStorage.removeItem(USER_SET_GEMINI_API_KEY_LS_KEY);
      setStoredUserApiKey(null);
      setApiKeyMessage({ type: 'info', text: 'User-set API Key cleared.' });
      resetChatSession(); // Reset to force geminiService to re-evaluate key source
    } catch (error) {
      console.error("Error clearing API key from localStorage:", error);
      setApiKeyMessage({ type: 'error', text: 'Failed to clear API Key.' });
    }
  };

  const sortedAndFilteredProjects = useMemo(() => {
    let result = [...projects];

    if (searchTerm.trim()) {
      result = result.filter(proj =>
        proj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proj.description && proj.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    switch (sortOrder) {
      case 'recent':
        result.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.last_modified).getTime() - new Date(b.last_modified).getTime());
        break;
      case 'alphabetical':
        result.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        break;
    }
    return result;
  }, [projects, searchTerm, sortOrder]);


  if (authLoading && !showOtpInput) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session || !user) {
    if (showOtpInput) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">Verify Your Email</h1>
          <form onSubmit={handleVerifyOtpSubmit} className="w-full max-w-sm p-8 bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-center text-purple-400">Enter Verification Code</h2>
            {authSuccessMessage && <p className="mb-3 text-green-400 bg-green-900 p-2 rounded text-sm">{authSuccessMessage}</p>}
            {otpError && <p className="mb-3 text-red-400 bg-red-900 p-2 rounded text-sm">{otpError}</p>}
            <input
              type="text" value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="6-digit code" maxLength={6}
              className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none text-center tracking-[0.5em]"
            />
            <button type="submit" disabled={isVerifyingOtp || !otp.trim() || otp.length < 6}
              className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold transition-colors disabled:bg-gray-600"
            >
              {isVerifyingOtp ? 'Verifying...' : 'Verify Email'}
            </button>
            <button type="button" onClick={handleSkipOtp}
              className="w-full mt-4 text-sm text-purple-400 hover:text-purple-300"
            >
              Skip for now
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">AI Software Engineer Studio</h1>
        <form onSubmit={handleAuthSubmit} className="w-full max-w-sm p-8 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-center text-purple-400">{isRegisterMode ? 'Register New Account' : 'Login'}</h2>
          {authError && <p className="mb-4 text-red-400 bg-red-900 p-2 rounded text-sm">{authError}</p>}
          {authSuccessMessage && !showOtpInput && <p className="mb-4 text-green-400 bg-green-900 p-2 rounded text-sm">{authSuccessMessage}</p>}

          {isRegisterMode && (
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="Username" required={isRegisterMode}
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
            className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
          <button type="submit" disabled={authActionLoading}
            className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold transition-colors disabled:bg-gray-600"
          >
            {authActionLoading ? (isRegisterMode ? 'Registering...' : 'Logging in...') : (isRegisterMode ? 'Register' : 'Login')}
          </button>
          <button type="button" onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setAuthError(null);
              setAuthSuccessMessage(null);
            }}
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
    <div className="flex flex-col items-center min-h-screen bg-black text-white p-4 pt-10 overflow-y-auto pb-24">
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

        {authError && <p className="mb-4 text-red-400 bg-red-900 p-3 rounded text-sm" role="alert">{authError}</p>}
        {authSuccessMessage && <p className="mb-4 text-green-400 bg-green-900 p-3 rounded text-sm" role="status">{authSuccessMessage}</p>}

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

        {/* Gemini API Key Configuration Section */}
        <div className="mb-10 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-1 text-purple-400 flex items-center">
            <KeyIcon className="w-6 h-6 mr-2 text-yellow-400" />
            Gemini API Key Configuration
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Set your Gemini API Key here to be used by the AI. This key is stored locally in your browser.
          </p>

          {apiKeyMessage && (
            <p className={`mb-3 p-2 rounded text-sm ${
              apiKeyMessage.type === 'success' ? 'bg-green-700 text-green-200' :
              apiKeyMessage.type === 'error' ? 'bg-red-700 text-red-200' :
              'bg-blue-700 text-blue-200'
            }`}>
              {apiKeyMessage.text}
            </p>
          )}

          <form onSubmit={handleSaveApiKey} className="space-y-4">
            <div>
              <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-300 mb-1">
                Your Gemini API Key:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="gemini-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={userApiKeyInput}
                  onChange={(e) => setUserApiKeyInput(e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-l-md text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
                 <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-3 bg-gray-600 hover:bg-gray-500 text-white rounded-r-md text-xs h-full flex items-center justify-center"
                  title={showApiKey ? "Hide Key" : "Show Key"}
                  style={{minWidth: '60px'}}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
              <button
                type="submit"
                className="w-full sm:w-auto flex-grow p-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors disabled:bg-gray-600"
                disabled={!userApiKeyInput.trim()}
              >
                Save API Key
              </button>
              {storedUserApiKey && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="w-full sm:w-auto flex-grow p-3 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors"
                >
                  Clear Saved Key
                </button>
              )}
            </div>
          </form>
          {storedUserApiKey ? (
            <p className="mt-4 text-sm text-green-400">
              Current User API Key: <span className="font-mono bg-gray-700 px-1 py-0.5 rounded text-green-300">Ending with ...{storedUserApiKey.slice(-4)}</span>
            </p>
          ) : (
            <p className="mt-4 text-sm text-yellow-400">
              No user-set API Key found in local storage. The application will attempt to use a system-provided key if available.
            </p>
          )}
        </div>


        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
          <div className="relative flex-grow">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects by name or description..."
              className="w-full p-3 pl-10 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 outline-none"
              aria-label="Search projects"
            />
            <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <div className="flex-shrink-0">
            <label htmlFor="sort-order" className="sr-only">Sort projects by</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full sm:w-auto p-3 bg-gray-700 border border-gray-600 rounded text-white focus:ring-purple-500 focus:border-purple-500 outline-none"
            >
              <option value="recent">Sort by: Recent</option>
              <option value="oldest">Sort by: Oldest</option>
              <option value="alphabetical">Sort by: Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {projectsLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-400">Loading projects...</p>
          </div>
        ) : sortedAndFilteredProjects.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {searchTerm ? `No projects found matching "${searchTerm}".` : "You don't have any projects yet. Create one above!"}
          </p>
        ) : (
          <div className="space-y-4">
            {sortedAndFilteredProjects.map(proj => (
              <div key={proj.id} className="p-5 bg-gray-800 rounded-lg shadow-lg border border-gray-700 hover:border-purple-500 transition-all">
                <h3 className="text-xl font-semibold text-purple-400 mb-1">{proj.name}</h3>
                <p className="text-sm text-gray-400 mb-3 truncate" title={proj.description || ''}>{proj.description || 'No description'}</p>
                <p className="text-xs text-gray-500 mb-1">Model: {AVAILABLE_MODELS.find(m=>m.id === proj.model_id)?.name || proj.model_id}</p>
                <p className="text-xs text-gray-500 mb-3">Last Modified: {new Date(proj.last_modified).toLocaleString()}</p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => navigate(`/project/${proj.id}`)}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors text-sm"
                  >
                    Open Project
                  </button>
                   <button
                    onClick={() => handleOpenEditModal(proj)}
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors text-sm"
                    title="Edit Project Details"
                    aria-label={`Edit project ${proj.name}`}
                  >
                    <EditIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProject(proj.id, proj.name)}
                    disabled={projectDeletionLoading === proj.id}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded text-white transition-colors text-sm disabled:bg-gray-600"
                    title="Delete Project"
                    aria-label={`Delete project ${proj.name}`}
                  >
                    {projectDeletionLoading === proj.id ? (
                      <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    ) : (
                      <DeleteIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {user && session && (
        <div className="fixed bottom-0 left-0 m-4 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex items-center space-x-3 max-w-xs z-20">
          <UserCircleIcon className="w-10 h-10 text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-200 font-semibold truncate" title={user.email || 'User'}>{user.email || 'User'}</p>
            <p className="text-xs text-purple-400 bg-purple-900 bg-opacity-50 px-1.5 py-0.5 rounded-full inline-block">
              {currentPlan} Plan
            </p>
          </div>
        </div>
      )}

      <EditProjectModal
        isOpen={isEditModalOpen}
        project={editingProject}
        onSave={handleSaveProjectDetails}
        onClose={handleCloseEditModal}
        isSaving={isSavingProjectDetails}
      />
    </div>
  );
};

export default HomePage;
