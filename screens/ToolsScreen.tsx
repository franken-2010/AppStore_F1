
import React from 'react';
import BottomNav from '../components/BottomNav';

const ToolsScreen: React.FC = () => {
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32">
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-3xl">menu</span>
          </button>
          <div className="flex gap-3">
            <button className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-2xl">notifications</span>
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background-light dark:border-background-dark"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-primary cursor-pointer" style={{backgroundImage: 'url("https://picsum.photos/100/100?random=5")'}}></div>
          </div>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Herramientas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Gestión administrativa y formularios</p>
        </div>
        <div className="relative w-full group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 group-focus-within:text-primary">search</span>
          </div>
          <input className="block w-full pl-12 pr-4 py-3.5 rounded-2xl border-none bg-white dark:bg-surface-dark text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary shadow-sm text-base font-medium transition-all" placeholder="Buscar formulario..." type="text"/>
        </div>
      </header>

      <main className="flex-1 px-5 pt-2 flex flex-col gap-8">
        <section>
          <div className="flex items-center justify-between mb-4 pl-1">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Acceso Rápido</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
            {[
              { icon: 'qr_code_scanner', label: 'Escanear' },
              { icon: 'history', label: 'Historial' },
              { icon: 'bar_chart', label: 'Reportes' },
              { icon: 'settings', label: 'Ajustes' },
            ].map((btn, i) => (
              <button key={i} className="flex flex-col items-center gap-2 min-w-[72px] group">
                <div className="w-16 h-16 rounded-[1.25rem] bg-white dark:bg-surface-dark flex items-center justify-center group-active:scale-95 transition-all shadow-sm border border-slate-100 dark:border-white/5">
                  <span className="material-symbols-outlined text-primary text-2xl">{btn.icon}</span>
                </div>
                <span className="text-xs font-semibold text-center text-slate-600 dark:text-slate-300">{btn.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 pl-1 text-slate-800 dark:text-slate-200">Formularios Disponibles</h2>
          <div className="grid grid-cols-1 gap-5">
            <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-surface-dark p-1 shadow-md active:scale-[0.99] transition-transform duration-200 cursor-pointer group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent opacity-50"></div>
              <div className="relative flex flex-col p-6 h-full z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-lg shadow-primary/25 text-white transform group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-3xl">price_change</span>
                  </div>
                  <div className="bg-slate-100 dark:bg-white/5 p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors">arrow_forward_ios</span>
                  </div>
                </div>
                <div className="mt-auto">
                  <h3 className="text-2xl font-bold leading-tight mb-2 text-slate-900 dark:text-white">Actualización<br/>de precios</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Modificar costos, precios de venta y márgenes de ganancia por SKU.</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-surface-dark p-1 shadow-md active:scale-[0.99] transition-transform duration-200 cursor-pointer group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:to-transparent opacity-50"></div>
              <div className="relative flex flex-col p-6 h-full z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white transform group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-3xl">inventory_2</span>
                  </div>
                  <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Nuevo</span>
                  </div>
                </div>
                <div className="mt-auto">
                  <h3 className="text-2xl font-bold leading-tight mb-2 text-slate-900 dark:text-white">Alta de<br/>productos</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Registrar nuevo inventario, asignar categorías y proveedores.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default ToolsScreen;
