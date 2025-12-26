
import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';
import NotificationBell from '../components/NotificationBell';

const ToolsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const tools = [
    {
      title: 'Verificación de precios',
      description: 'Consulta precios sugeridos con IA en la base de datos.',
      icon: 'search_check',
      color: 'bg-blue-600',
      path: '/tools/price-verification'
    },
    {
      title: 'Actualización de productos',
      description: 'Sincroniza costos y precios masivamente vía Make.',
      icon: 'sync_alt',
      color: 'bg-indigo-600',
      path: '/tools/price-update'
    },
    {
      title: 'Alta de productos',
      description: 'Registra manualmente nuevos ítems en el catálogo.',
      icon: 'add_circle',
      color: 'bg-emerald-600',
      path: '/tools/product-add'
    }
  ];

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-6 pb-6">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">menu</span>
          </button>
          <div className="flex gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Herramientas</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Panel Administrativo</p>
        </div>
      </header>

      <main className="px-6 flex flex-col gap-4">
        {tools.map((tool, index) => (
          <button 
            key={index}
            onClick={() => navigate(tool.path)}
            className="flex items-center gap-5 p-5 bg-white dark:bg-surface-dark rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 active:scale-[0.98] transition-all text-left group"
          >
            <div className={`size-14 rounded-2xl ${tool.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
              <span className="material-symbols-outlined text-3xl">{tool.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{tool.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                {tool.description}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 group-hover:text-primary transition-colors">chevron_right</span>
          </button>
        ))}
      </main>

      <BottomNav />
    </div>
  );
};

export default ToolsScreen;
