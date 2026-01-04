
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
import AccountCategorySettingsScreen from './screens/AccountCategorySettingsScreen';
import AccountHistoryScreen from './screens/AccountHistoryScreen';
import AccountChartsScreen from './screens/AccountChartsScreen';
import AddMovementScreen from './screens/AddMovementScreen';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
            <Route path="/tools/price-verification" element={<ProtectedRoute><PriceVerificationScreen /></ProtectedRoute>} />
            
            <Route path="/accounting" element={<ProtectedRoute><FinanceAccountsScreen /></ProtectedRoute>} />
            <Route path="/finance-accounts" element={<ProtectedRoute><FinanceAccountsScreen /></ProtectedRoute>} />
            <Route path="/finance-stats" element={<ProtectedRoute><FinanceStatsTotalsScreen /></ProtectedRoute>} />
            
            <Route path="/chat" element={<ProtectedRoute><ChatScreen /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
            <Route path="/settings/bdd" element={<ProtectedRoute><DatabaseUploadScreen /></ProtectedRoute>} />
            <Route path="/settings/account-categories" element={<ProtectedRoute><AccountCategorySettingsScreen /></ProtectedRoute>} />
            
            <Route path="/account/upsert" element={<ProtectedRoute><AccountUpsertScreen /></ProtectedRoute>} />
            <Route path="/account/edit/:accountId" element={<ProtectedRoute><AccountUpsertScreen /></ProtectedRoute>} />
            <Route path="/account/history/:accountId" element={<ProtectedRoute><AccountHistoryScreen /></ProtectedRoute>} />
            <Route path="/account/charts/:accountId" element={<ProtectedRoute><AccountChartsScreen /></ProtectedRoute>} />
            <Route path="/account/add-movement/:accountId" element={<ProtectedRoute><AddMovementScreen /></ProtectedRoute>} />
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
