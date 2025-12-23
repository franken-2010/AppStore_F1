
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const menuItems = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
    { label: 'Cortes de Caja', icon: 'point_of_sale', path: '/cortes' },
    { label: 'Herramientas', icon: 'build', path: '/tools' },
    { label: 'Notificaciones', icon: 'notifications', path: '/settings' },
    { label: 'Configuración', icon: 'settings', path: '/settings' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`fixed inset-y-0 left-0 z-[70] w-72 bg-white dark:bg-surface-dark shadow-2xl transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 bg-primary">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-12 rounded-full border-2 border-white/50 bg-cover bg-center" style={{backgroundImage: `url('${profile?.photoURL}')`}}></div>
              <div>
                <p className="text-white font-bold">{profile?.displayName}</p>
                <p className="text-white/70 text-xs">{profile?.email}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 py-4 overflow-y-auto">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                className={`flex items-center gap-4 w-full px-6 py-4 text-sm font-bold transition-colors ${location.pathname === item.path ? 'text-primary bg-primary/5 border-r-4 border-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-white/5">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 w-full text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
