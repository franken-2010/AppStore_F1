
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import CortesScreen from './screens/CortesScreen';
import ToolsScreen from './screens/ToolsScreen';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/cortes" element={<CortesScreen />} />
        <Route path="/tools" element={<ToolsScreen />} />
      </Routes>
    </Router>
  );
};

export default App;
