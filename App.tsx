
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import CortesScreen from './screens/CortesScreen';
import ToolsScreen from './screens/ToolsScreen';
import PriceUpdateScreen from './screens/PriceUpdateScreen';
import ProductAddScreen from './screens/ProductAddScreen';
import SettingsScreen from './screens/SettingsScreen';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>;
  return user ? <>{children}</> : <Navigate to="/" />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardScreen /></ProtectedRoute>} />
            <Route path="/cortes" element={<ProtectedRoute><CortesScreen /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><ToolsScreen /></ProtectedRoute>} />
            <Route path="/tools/price-update" element={<ProtectedRoute><PriceUpdateScreen /></ProtectedRoute>} />
            <Route path="/tools/product-add" element={<ProtectedRoute><ProductAddScreen /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
