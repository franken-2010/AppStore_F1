
import React, { useState } from 'react';

interface MoneyInputWithCalculatorProps {
  label: string;
  field: string;
  icon?: string;
  value: number;
  onChange: (field: string, value: string) => void;
  placeholder?: string;
  className?: string;
}

const MoneyInputWithCalculator: React.FC<MoneyInputWithCalculatorProps> = ({
  label,
  field,
  icon,
  value,
  onChange,
  placeholder = "0.00",
  className = ""
}) => {
  const [showModal, setShowModal] = useState(false);
  
  // Calculator States
  const [expression, setExpression] = useState('');
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const formatNumber = (num: number) => num.toFixed(2);

  const handleCalcButtonClick = (val: string) => {
    setCalcError(null);
    if (val === '=') {
      try {
        const sanitized = expression.replace(/[^-+*/.0-9]/g, '');
        // eslint-disable-next-line no-eval
        const evaluated = eval(sanitized);
        if (!isFinite(evaluated)) throw new Error();
        setCalcResult(Number(evaluated.toFixed(2)));
      } catch (e) {
        setCalcError('Operación no válida');
        setCalcResult(null);
      }
    } else if (val === 'C') {
      setExpression('');
      setCalcResult(null);
    } else if (val === '⌫') {
      setExpression(prev => prev.slice(0, -1));
    } else {
      setExpression(prev => prev + val);
    }
  };

  const confirmResult = () => {
    if (calcResult !== null) {
      onChange(field, calcResult.toString());
      closeModal();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setExpression('');
    setCalcResult(null);
    setCalcError(null);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1">
        {icon && <span className="material-symbols-outlined text-xs">{icon}</span>}
        {label}
      </label>
      <div className="relative group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
        <input
          type="number"
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full py-3 pl-8 pr-12 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white transition-all"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-xl">calculate</span>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-background-light dark:bg-background-dark animate-in fade-in duration-200 overflow-hidden h-[100dvh] w-screen">
          {/* Header - Fixed to top */}
          <header className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0 bg-background-light dark:bg-background-dark">
            <button onClick={closeModal} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-[28px]">arrow_back</span>
            </button>
            <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">calculate</span>
              Calculadora F1
            </h3>
            <div className="w-10"></div>
          </header>

          {/* Main Layout Area - No Scroll */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
            
            {/* Display - Sized to take roughly 20% of vertical space */}
            <div className="h-[20%] min-h-[100px] bg-slate-50 dark:bg-black/20 rounded-[2rem] p-6 mb-4 text-right flex flex-col justify-end border border-slate-100 dark:border-white/5 shadow-inner">
              <div className="text-slate-400 text-sm sm:text-base font-medium mb-1 overflow-hidden truncate">
                {expression || '0'}
              </div>
              <div className={`text-4xl sm:text-5xl font-black ${calcError ? 'text-red-500 text-base' : 'text-slate-900 dark:text-white'} tracking-tighter leading-none`}>
                {calcError || (calcResult !== null ? `$ ${formatNumber(calcResult)}` : '0.00')}
              </div>
            </div>

            {/* Keypad - Takes up remaining space */}
            <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-4 mb-4">
              {['C', '⌫', '/', '*'].map(btn => (
                <button key={btn} onClick={() => handleCalcButtonClick(btn)} className="rounded-2xl sm:rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black text-xl active:scale-90 transition-all flex items-center justify-center">
                  {btn}
                </button>
              ))}
              {['7', '8', '9', '-'].map(btn => (
                <button key={btn} onClick={() => handleCalcButtonClick(btn)} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">
                  {btn}
                </button>
              ))}
              {['4', '5', '6', '+'].map(btn => (
                <button key={btn} onClick={() => handleCalcButtonClick(btn)} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">
                  {btn}
                </button>
              ))}
              
              <button onClick={() => handleCalcButtonClick('1')} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">1</button>
              <button onClick={() => handleCalcButtonClick('2')} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">2</button>
              <button onClick={() => handleCalcButtonClick('3')} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">3</button>
              <button onClick={() => handleCalcButtonClick('=')} className="row-span-2 rounded-2xl sm:rounded-3xl bg-primary text-white shadow-lg shadow-primary/20 font-black text-3xl active:scale-90 transition-all flex items-center justify-center">=</button>
              
              <button onClick={() => handleCalcButtonClick('0')} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">0</button>
              <button onClick={() => handleCalcButtonClick('.')} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-white/10 shadow-sm border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white font-black text-xl sm:text-2xl active:scale-90 transition-all flex items-center justify-center">.</button>
              <div className="rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">functions</span>
              </div>
            </div>

            {/* Final Actions - Minimal spacing to ensure fit */}
            <div className="shrink-0 space-y-2 pb-safe">
              <button
                onClick={confirmResult}
                disabled={calcResult === null}
                className="w-full py-4 sm:py-5 bg-primary text-white font-black text-lg rounded-2xl sm:rounded-[2rem] shadow-xl shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
              >
                Insertar Resultado
              </button>
              <button
                onClick={closeModal}
                className="w-full py-2 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em] active:opacity-50 transition-opacity"
              >
                Cerrar Calculadora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoneyInputWithCalculator;
