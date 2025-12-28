
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md h-[72px] flex items-center justify-between rounded-full bg-white dark:bg-[#252031] px-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-800">
        <Link to="/dashboard" className={`flex flex-col items-center justify-center gap-1 ${isActive('/dashboard') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary'} transition-colors`}>
          <span className="material-symbols-outlined text-2xl">home</span>
          {isActive('/dashboard') && <span className="text-[10px] font-bold">Inicio</span>}
        </Link>

        <Link to="/chat" className={`flex flex-col items-center justify-center gap-1 ${isActive('/chat') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary'} transition-colors`}>
          <span className="material-symbols-outlined text-2xl">voice_chat</span>
          {isActive('/chat') && <span className="text-[10px] font-bold">IA F1</span>}
        </Link>

        <Link to="/accounting" className={`flex flex-col items-center justify-center gap-1 ${isActive('/accounting') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary'} transition-colors relative`}>
          {isActive('/accounting') ? (
            <div className="absolute -top-10 bg-primary rounded-full p-3 shadow-lg shadow-primary/40 border-[6px] border-background-light dark:border-background-dark">
              <span className="material-symbols-outlined text-white text-2xl">account_balance</span>
            </div>
          ) : (
            <span className="material-symbols-outlined text-2xl">account_balance</span>
          )}
          {isActive('/accounting') && <span className="text-[10px] font-bold mt-8">Conta</span>}
        </Link>

        <Link to="/tools" className={`flex flex-col items-center justify-center gap-1 ${isActive('/tools') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary'} transition-colors`}>
          <span className="material-symbols-outlined text-2xl">build</span>
          {isActive('/tools') && <span className="text-[10px] font-bold">Tools</span>}
        </Link>

        <Link to="/settings" className={`flex flex-col items-center justify-center gap-1 ${isActive('/settings') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary'} transition-colors`}>
          <span className="material-symbols-outlined text-2xl">settings</span>
          {isActive('/settings') && <span className="text-[10px] font-bold">Ajustes</span>}
        </Link>
      </div>
    </div>
  );
};

export default BottomNav;
