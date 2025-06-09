
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import ProjectPage from './components/ProjectPage'; // Ensured this refers to the fixed ProjectPage
import PublicSiteViewer from './components/PublicSiteViewer';
import PricingPage from './components/PricingPage'; // New import
import { AuthProvider, useAuth } from './contexts/AuthContext';

const AppRoutes: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="w-16 h-16 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route 
        path="/project/:projectId" 
        element={session ? <ProjectPage /> : <Navigate to="/" replace />} 
      />
      <Route path="/view/:publishId" element={<PublicSiteViewer />} />
      <Route path="/pricing" element={<PricingPage />} /> {/* New route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <div className="bg-black text-white h-full font-sans">
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </div>
  );
};

export default App;