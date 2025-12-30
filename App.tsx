
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
import DatabaseUploadScreen from './screens/DatabaseUploadScreen';
import PriceVerificationScreen from './screens/PriceVerificationScreen';
import ChatScreen from './screens/ChatScreen';
import FinanceAccountsScreen from './screens/FinanceAccountsScreen';
import AccountUpsertScreen from './screens/AccountUpsertScreen';
import AccountVisibilityScreen from './screens/AccountVisibilityScreen';
import AccountDeleteScreen from './screens/AccountDeleteScreen';
import AccountReorderScreen from './screens/AccountReorderScreen';
import FinanceStatsTotalsScreen from './screens/FinanceStatsTotalsScreen';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>;
  return user ? <>{children}</> : <Navigate to="/" />;
};

const PlaceholderScreen: React.FC<{ title: string }> = ({ title }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark p-6 text-center">
    <h1 className="text-2xl font-bold mb-4">{title}</h1>
    <p className="text-slate-500 mb-8">Esta funcionalidad estará disponible pronto.</p>
    <button onClick={() => window.history.back()} className="px-6 py-2 bg-primary text-white rounded-xl">Regresar</button>
  </div>
);

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
            <Route path="/tools/price-verification" element={<ProtectedRoute><PriceVerificationScreen /></ProtectedRoute>} />
            
            {/* Sustitución de Contabilidad por Cuentas */}
            <Route path="/accounting" element={<ProtectedRoute><FinanceAccountsScreen /></ProtectedRoute>} />
            <Route path="/finance-accounts" element={<ProtectedRoute><FinanceAccountsScreen /></ProtectedRoute>} />
            <Route path="/finance-stats" element={<ProtectedRoute><FinanceStatsTotalsScreen /></ProtectedRoute>} />
            
            <Route path="/chat" element={<ProtectedRoute><ChatScreen /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
            <Route path="/settings/bdd" element={<ProtectedRoute><DatabaseUploadScreen /></ProtectedRoute>} />
            
            {/* Rutas de gestión de cuentas */}
            <Route path="/account/upsert" element={<ProtectedRoute><AccountUpsertScreen /></ProtectedRoute>} />
            <Route path="/account/edit/:accountId" element={<ProtectedRoute><AccountUpsertScreen /></ProtectedRoute>} />
            <Route path="/account/visibility" element={<ProtectedRoute><AccountVisibilityScreen /></ProtectedRoute>} />
            <Route path="/account/delete" element={<ProtectedRoute><AccountDeleteScreen /></ProtectedRoute>} />
            <Route path="/account/reorder" element={<ProtectedRoute><AccountReorderScreen /></ProtectedRoute>} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
