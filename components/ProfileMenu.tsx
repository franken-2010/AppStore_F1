
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-primary active:scale-95 transition-transform" 
        style={{backgroundImage: `url('${profile?.photoURL || 'https://picsum.photos/100/100?random=5'}')`}}
      ></button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-white/5">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
            </div>
            <div className="p-2">
              <button 
                onClick={() => { navigate('/settings'); setIsOpen(false); }}
                className="flex items-center gap-3 w-full p-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
                Configuración
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfileMenu;
