
import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import { HISTORY } from '../constants';
import { GeminiService } from '../services/geminiService';

const CortesScreen: React.FC = () => {
  const [cash, setCash] = useState<string>('');
  const [terminal, setTerminal] = useState<string>('');
  const [expenses, setExpenses] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string>('');

  const validateAndSet = (value: string, setter: (val: string) => void) => {
    // Allows empty string for clearing
    if (value === '') {
      setter('');
      return;
    }

    // Regular expression to allow:
    // 1. Only digits
    // 2. Optional single decimal point
    // 3. Up to 2 decimal places (common for currency)
    // 4. Non-negative numbers only
    const regex = /^\d*\.?\d{0,2}$/;
    
    if (regex.test(value)) {
      setter(value);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanMessage('Subiendo imagen...');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        setScanMessage('Analizando reporte con Gemini Pro...');
        const result = await GeminiService.analyzeReceiptImage(base64String);
        
        if (result) {
          setCash(result.cashAmount.toFixed(2));
          setTerminal(result.terminalAmount.toFixed(2));
          setExpenses(result.expenses.toFixed(2));
          setScanMessage(`¡Escaneo exitoso! ${result.summary}`);
          setTimeout(() => setScanMessage(''), 5000);
        } else {
          setScanMessage('No se pudo analizar la imagen. Intenta de nuevo.');
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setScanMessage('Error al procesar la imagen.');
      setIsScanning(false);
    }
  };

  const calculatedTotal = (Number(cash) || 0) + (Number(terminal) || 0) - (Number(expenses) || 0);
  const systemMeta = 45000;
  const difference = calculatedTotal - systemMeta;

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto">
      <div className="flex items-center justify-between p-4 pt-12 pb-2 sticky top-0 z-20 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary" style={{backgroundImage: 'url("https://picsum.photos/100/100?random=1")'}}></div>
          <div>
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-none">Cortes</h2>
            <span className="text-xs text-primary font-bold">Sucursal Norte</span>
          </div>
        </div>
        <button className="relative p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-slate-700 dark:text-white">notifications</span>
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-background-dark"></span>
        </button>
      </div>

      <div className="px-4 py-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">Hola, Admin</h1>
          <p className="text-slate-500 dark:text-[#a89ac1] text-base font-normal">Hoy es <span className="text-slate-800 dark:text-white font-semibold">24 de Octubre</span></p>
        </div>
      </div>

      <div className="flex gap-4 p-4">
        <div className="flex flex-1 flex-col justify-between gap-4 rounded-xl p-5 bg-white dark:bg-[#322942] shadow-sm border border-slate-100 dark:border-none">
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </div>
            <span className="text-emerald-500 text-xs font-bold bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">+12%</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal mb-1">Ventas Semanales</p>
            <p className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight">$124,500</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between gap-4 rounded-xl p-5 bg-white dark:bg-[#322942] shadow-sm border border-slate-100 dark:border-none">
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
            </div>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal mb-1">Cajas Abiertas</p>
            <p className="text-slate-900 dark:text-white tracking-tight text-xl font-bold leading-tight">3</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl bg-white dark:bg-surface-dark shadow-xl border border-slate-100 dark:border-none p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Registro de Corte</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Capture los montos finales</p>
            </div>
            <label className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-all active:scale-95 shadow-lg shadow-primary/5">
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isScanning} />
              <span className="material-symbols-outlined text-2xl">{isScanning ? 'sync' : 'photo_camera'}</span>
            </label>
          </div>

          {scanMessage && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-primary text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-sm animate-pulse">auto_awesome</span>
              {scanMessage}
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 ml-1">Total en Efectivo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400">payments</span>
                </div>
                <input 
                  className="block w-full pl-12 pr-12 py-4 text-lg font-bold text-slate-900 dark:text-white bg-background-light dark:bg-background-dark border-none rounded-lg focus:ring-2 focus:ring-primary placeholder:text-slate-400/50 transition-all appearance-none shadow-inner" 
                  inputMode="decimal" placeholder="0.00" type="text"
                  value={cash} onChange={(e) => validateAndSet(e.target.value, setCash)}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold text-xs">MXN</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 ml-1">Terminales / Tarjetas</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400">credit_card</span>
                </div>
                <input 
                  className="block w-full pl-12 pr-12 py-4 text-lg font-bold text-slate-900 dark:text-white bg-background-light dark:bg-background-dark border-none rounded-lg focus:ring-2 focus:ring-primary placeholder:text-slate-400/50 transition-all appearance-none shadow-inner" 
                  inputMode="decimal" placeholder="0.00" type="text"
                  value={terminal} onChange={(e) => validateAndSet(e.target.value, setTerminal)}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold text-xs">MXN</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 ml-1">Gastos / Salidas</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                </div>
                <input 
                  className="block w-full pl-12 pr-12 py-4 text-lg font-bold text-slate-900 dark:text-white bg-background-light dark:bg-background-dark border-none rounded-lg focus:ring-2 focus:ring-primary placeholder:text-slate-400/50 transition-all appearance-none shadow-inner" 
                  inputMode="decimal" placeholder="0.00" type="text"
                  value={expenses} onChange={(e) => validateAndSet(e.target.value, setExpenses)}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold text-xs">MXN</span>
                </div>
              </div>
            </div>

            <div className="mt-2 p-5 rounded-lg bg-background-light dark:bg-background-dark border border-slate-200 dark:border-white/5 flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Meta del Sistema</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono tracking-tight">${systemMeta.toLocaleString()}.00</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Calculado</span>
                <span className="font-bold text-primary font-mono tracking-tight">${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px w-full bg-slate-300 dark:bg-white/10"></div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Diferencia</span>
                <span className={`font-bold font-mono text-base tracking-tight ${difference >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {difference >= 0 ? '+' : '-'} ${Math.abs(difference).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button className="group w-full mt-2 bg-primary hover:bg-primary-dark active:scale-[0.98] transition-all text-white h-14 rounded-full font-bold text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2" type="button">
              <span className="material-symbols-outlined group-hover:animate-pulse">check</span>
              Guardar Corte
            </button>
          </form>
        </div>
      </div>

      <div className="px-4 pt-2 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Historial Recente</h2>
        <button className="text-primary text-sm font-semibold hover:text-primary-dark">Ver todo</button>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {HISTORY.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#252031] border border-slate-100 dark:border-none shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center size-10 rounded-full ${item.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                <span className="material-symbols-outlined">{item.status === 'completed' ? 'check_circle' : 'warning'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.date}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${item.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                {item.status === 'completed' ? 'Completado' : 'Revisión'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
};

export default CortesScreen;
