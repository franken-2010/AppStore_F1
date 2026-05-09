
import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';
import NotificationBell from '../components/NotificationBell';

const ToolsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const toolCategories = [
    {
      name: 'Precios y Costos',
      icon: 'payments',
      tools: [
        {
          title: 'Verificación de precios',
          description: 'Consulta precios sugeridos con IA en la base de datos.',
          icon: 'price_check',
          color: 'bg-blue-500',
          path: '/tools/price-verification'
        },
        {
          title: 'Actualización masiva',
          description: 'Sincroniza costos y precios masivamente vía Make.',
          icon: 'sync_saved_locally',
          color: 'bg-indigo-500',
          path: '/tools/price-update'
        }
      ]
    },
    {
      name: 'Catálogo de Productos',
      icon: 'inventory_2',
      tools: [
        {
          title: 'Alta de productos',
          description: 'Registra manualmente nuevos ítems en el catálogo.',
          icon: 'add_box',
          color: 'bg-emerald-500',
          path: '/tools/product-add'
        }
      ]
    },
    {
      name: 'Operaciones y Pedidos',
      icon: 'local_shipping',
      tools: [
        {
          title: 'Generador de Pedidos',
          description: 'Crea listas inteligentes para WhatsApp usando IA.',
          icon: 'shopping_basket',
          color: 'bg-amber-500',
          path: '/tools/orders'
        }
      ]
    }
  ];

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-slate-50 dark:bg-background-dark pb-32 font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-6 pb-6">
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
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">Herramientas</h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-300"></span>
            Panel de Gestión F1-AI
          </p>
        </div>
      </header>

      <main className="px-6 space-y-8">
        {toolCategories.map((category, catIndex) => (
          <section key={catIndex} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-slate-400 text-lg">{category.icon}</span>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">{category.name}</h2>
            </div>
            
            <div className="grid gap-3">
              {category.tools.map((tool, toolIndex) => (
                <button 
                  key={toolIndex}
                  onClick={() => navigate(tool.path)}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-surface-dark rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 active:scale-[0.97] transition-all text-left group relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${tool.color} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                  
                  <div className={`size-12 rounded-2xl ${tool.color} text-white flex items-center justify-center shadow-lg shadow-current/20 group-hover:rotate-6 transition-transform`}>
                    <span className="material-symbols-outlined text-2xl">{tool.icon}</span>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">{tool.title}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-tight line-clamp-1">
                      {tool.description}
                    </p>
                  </div>
                  
                  <div className="size-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700 group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>

      <BottomNav />
    </div>
  );
};

export default ToolsScreen;
