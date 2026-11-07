import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
import '../index.css';
import MultiStoreCorteDraftPanel from '../components/MultiStoreCorteDraftPanel';
import MultiStorePreviewScreen from '../screens/MultiStorePreviewScreen';
import { parseMultiStoreDraftFallback } from '../services/multiStoreCorteDraft';
import { F1_CATEGORY_LABELS, F1_STORES } from '../services/multiStoreAccounting';

const sampleCategorySales = [
  ['abarrotes', 2500], ['fiesta', 700], ['recargas', 380], ['estancias', 450],
  ['frutas_verduras', 1250], ['pan_galletas', 650], ['comida_preparada', 990],
] as const;
const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN',maximumFractionDigits:0}).format(value);

const demoAnalyzer = async (text: string, dateKey: string, storeId: 'local_01' | 'local_02') =>
  parseMultiStoreDraftFallback(text,storeId,dateKey);

function StatusStrip() {
  return (
    <div className="border-b border-amber-600/30 bg-amber-400/10 px-4 py-3 text-center text-xs font-bold text-amber-200">
      VERSIÓN DE PRUEBA · Datos de ejemplo · Sin acceso a Firebase · Sin pagos ni registros reales
    </div>
  );
}

function Header() {
  const location = useLocation();
  const title = location.pathname.startsWith('/cortes') ? 'Corte de caja'
    : location.pathname.startsWith('/tools') ? 'Herramientas' : 'Abarrotes F1';
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-lg font-black text-white">F1</div>
          <div>
            <div className="text-xs font-black tracking-widest text-blue-300">ABARROTES F1</div>
            <h1 className="text-lg font-black text-white">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-600/40 bg-amber-400/10 px-3 py-2 text-[10px] font-black text-amber-200">
          <span className="material-symbols-outlined text-sm">science</span> DEMO
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const items = [
    {to:'/dashboard',name:'Inicio',icon:'dashboard'},
    {to:'/cortes',name:'Cortes',icon:'receipt_long'},
    {to:'/tools',name:'Herramientas',icon:'apps'},
  ];
  return (
    <nav aria-label="Navegación de prueba" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl justify-around py-2">
        {items.map(item=>(
          <NavLink key={item.to} to={item.to}
            className={({isActive})=>'flex min-w-24 flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-xs font-bold ' +
              (isActive?'bg-blue-600/20 text-blue-300':'text-slate-400')}>
            <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function HomeScreen() {
  const sum1=sampleCategorySales.slice(0,4).reduce((sum,x)=>sum+x[1],0);
  const sum2=sampleCategorySales.slice(4).reduce((sum,x)=>sum+x[1],0);
  return (
    <div className="space-y-5 px-4 py-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-900 p-6 shadow-xl">
        <p className="text-xs font-black uppercase tracking-widest text-blue-100">Panel multilocal · Prueba</p>
        <h2 className="mt-2 text-3xl font-black text-white">Dos locales. Una visión.</h2>
        <p className="mt-2 text-sm leading-relaxed text-blue-100">
          Esta vista usa los componentes del nuevo desarrollo F1, con un corte por local y siete categorías.
          Todo lo que ves aquí es ficticio.
        </p>
        <Link to="/cortes" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-900">
          <span className="material-symbols-outlined">mic</span> Probar corte por voz
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-slate-800 p-4">
          <div className="text-xs font-bold text-slate-400">Local 1 · Ventas ejemplo</div>
          <div className="mt-2 text-xl font-black tabular-nums text-white">{formatMoney(sum1)}</div>
          <div className="mt-1 text-xs text-slate-400">4 categorías</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-800 p-4">
          <div className="text-xs font-bold text-slate-400">Local 2 · Ventas ejemplo</div>
          <div className="mt-2 text-xl font-black tabular-nums text-white">{formatMoney(sum2)}</div>
          <div className="mt-1 text-xs text-slate-400">3 categorías</div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/5 bg-slate-800 p-5">
        <h3 className="text-base font-black text-white">Categorías comerciales</h3>
        <p className="mt-1 text-xs text-slate-400">Importes ficticios para ilustrar la distribución.</p>
        {F1_STORES.map(s=>(
          <div key={s.id} className="mt-4">
            <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-blue-300">{s.name}</h4>
            {s.categories.map(id=>{
              const amount=sampleCategorySales.find(x=>x[0]===id)?.[1]||0;
              const max=3000;
              return (
                <div className="mb-3" key={id}>
                  <div className="mb-1 flex justify-between gap-3 text-xs text-slate-200">
                    <span>{F1_CATEGORY_LABELS[id]}</span><strong>{formatMoney(amount)}</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                    <div className="h-full rounded-full bg-blue-500" style={{width:String(Math.min(100,100*amount/max))+'%'}}/>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
        <strong className="text-white">Sin datos reales:</strong> esta página no incluye acceso a los reportes,
        cuentas, inventarios, precios, ni movimientos históricos de Abarrotes F1.
        Es una prueba del nuevo módulo, no una copia productiva.
      </div>
    </div>
  );
}

function CorteScreen() {
  const [dateKey,setDateKey]=useState(()=>{
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  });
  return (
    <div className="space-y-5 px-4 py-5">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-800 p-1 text-center">
        <span className="rounded-xl px-2 py-3 text-[10px] font-black text-slate-500">Carga manual <small className="block font-normal">Solo app real</small></span>
        <span className="rounded-xl px-2 py-3 text-[10px] font-black text-slate-500">Pegar corte <small className="block font-normal">Solo app real</small></span>
        <span className="rounded-xl bg-blue-600 px-2 py-3 text-[10px] font-black text-white">F1-AI <small className="block font-normal">2 locales</small></span>
      </div>
      <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
        Fecha del corte
        <input type="date" value={dateKey} onChange={e=>setDateKey(e.target.value)}
          className="mt-2 block w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-base font-bold text-white"/>
      </label>
      <MultiStoreCorteDraftPanel dateKey={dateKey} demoMode={true} analyzeDraft={demoAnalyzer}/>
      <p className="pb-3 text-xs leading-relaxed text-slate-400">
        El reconocimiento por voz se procesa con el sistema disponible en tu navegador.
        Aquí el análisis utiliza reglas locales: Gemini y el guardado en Firebase
        se probarán cuando exista un backend aislado.
      </p>
    </div>
  );
}

function ToolsScreen() {
  const tools=[
    {name:'Simulador de cortes y gastos',icon:'calculate',description:'Prueba las siete categorías y el prorrateo de gastos.',to:'/tools/multilocal'},
    {name:'Dictado de corte multilocal',icon:'mic',description:'Analiza movimientos y revisa el resultado antes de guardar.',to:'/cortes'},
  ];
  return (
    <div className="space-y-5 px-4 py-6">
      <h2 className="text-lg font-black text-white">Operaciones de prueba</h2>
      {tools.map(tool=>(
        <Link key={tool.to} to={tool.to} className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white">
            <span className="material-symbols-outlined">{tool.icon}</span>
          </div>
          <div className="flex-1">
            <strong className="text-sm text-white">{tool.name}</strong>
            <p className="mt-1 text-xs text-slate-400">{tool.description}</p>
          </div>
          <span className="material-symbols-outlined text-slate-500">arrow_forward</span>
        </Link>
      ))}
      <div className="rounded-2xl border border-white/5 bg-slate-800 p-4">
        <h3 className="font-black text-white">Otras herramientas existentes</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Verificación de precios, Actualización masiva, Alta de productos,
          Generador de pedidos y Reportes PDF permanecen en tu aplicación actual.
          No están conectadas a esta vista pública para evitar trabajar con registros reales.
        </p>
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <div className="min-h-screen bg-slate-900 font-display text-slate-200">
      <StatusStrip/>
      <Header/>
      <main className="mx-auto max-w-xl pb-24">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
          <Route path="/dashboard" element={<HomeScreen/>}/>
          <Route path="/cortes" element={<CorteScreen/>}/>
          <Route path="/tools" element={<ToolsScreen/>}/>
          <Route path="/tools/multilocal" element={<MultiStorePreviewScreen/>}/>
          <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
        </Routes>
      </main>
      <BottomNav/>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><HashRouter><AppShell/></HashRouter></React.StrictMode>
);
