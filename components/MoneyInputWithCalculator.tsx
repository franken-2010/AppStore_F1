
import React, { useState, useCallback, useRef, useEffect } from 'react';

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
  const [calcError, setCalcError] = useState<boolean>(false);

  // Refs for auto-scrolling display
  const expressionRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to end when expression or result changes
  useEffect(() => {
    if (expressionRef.current) {
      expressionRef.current.scrollLeft = expressionRef.current.scrollWidth;
    }
    if (resultRef.current) {
      resultRef.current.scrollLeft = resultRef.current.scrollWidth;
    }
  }, [expression, calcResult]);

  const formatNumber = (num: number) => 
    new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const handleCalcAction = (val: string) => {
    setCalcError(false);
    
    // Clear All
    if (val === 'C') {
      setExpression('');
      setCalcResult(null);
      return;
    }

    // Backspace
    if (val === '⌫') {
      setExpression(prev => prev.slice(0, -1));
      setCalcResult(null);
      return;
    }

    // Evaluate Result
    if (val === '=') {
      if (!expression) return;
      try {
        // Cleanup trailing operators like "5+5+" -> "5+5"
        let sanitized = expression.replace(/[+\-*/]+$/, '');
        
        // Evaluate using Function constructor (safer and more robust than eval)
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${sanitized}`)();
        
        if (!isFinite(result)) throw new Error("Infinite result");
        
        const roundedResult = Number(result.toFixed(2));
        setCalcResult(roundedResult);
        setExpression(roundedResult.toString());
      } catch (e) {
        console.error("Calc Error:", e);
        setCalcError(true);
        setCalcResult(null);
      }
      return;
    }

    const operators = ['+', '-', '*', '/'];
    const isOperator = operators.includes(val);
    const lastChar = expression.slice(-1);
    const isLastCharOperator = operators.includes(lastChar);

    // Handle Decimal Point
    if (val === '.') {
      const lastNumberPart = expression.split(/[+\-*/]/).pop() || '';
      if (lastNumberPart.includes('.')) return; // Already has a dot
      setExpression(prev => prev + (prev === '' || isLastCharOperator ? '0.' : '.'));
      return;
    }

    // Handle Operators
    if (isOperator) {
      if (expression === '' && val !== '-') return; // Only minus can start an empty expr
      if (isLastCharOperator) {
        setExpression(prev => prev.slice(0, -1) + val); // Replace last operator
      } else {
        setExpression(prev => prev + val);
      }
      setCalcResult(null); // Reset result state to allow continuing operation
      return;
    }

    // Handle Numbers
    if (calcResult !== null && !isOperator) {
      // If we just got a result and start typing a number, restart
      setExpression(val);
      setCalcResult(null);
    } else {
      setExpression(prev => prev + val);
    }
  };

  const confirmResult = () => {
    let finalValue = "0";
    if (calcResult !== null) {
      finalValue = calcResult.toString();
    } else if (expression) {
      try {
        let sanitized = expression.replace(/[+\-*/]+$/, '');
        const result = new Function(`return ${sanitized}`)();
        if (isFinite(result)) finalValue = result.toFixed(2);
      } catch (e) {
        finalValue = "0";
      }
    }
    
    onChange(field, finalValue);
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setExpression('');
    setCalcResult(null);
    setCalcError(false);
  };

  const CalcBtn = ({ v, l, c = "" }: { v: string, l?: string, c?: string }) => (
    <button
      type="button"
      onClick={() => handleCalcAction(v)}
      className={`h-full w-full rounded-2xl text-lg font-black transition-all active:scale-90 flex items-center justify-center shadow-sm border border-transparent select-none touch-manipulation ${c}`}
    >
      {l || v}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1">
        {icon && <span className="material-symbols-outlined text-xs">{icon}</span>}
        {label}
      </label>
      <div className="relative group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
        <input
          type="number"
          step="0.01"
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full py-4 pl-8 pr-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white transition-all"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">calculate</span>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0f1d] animate-in fade-in duration-200 h-[100dvh]">
          <header className="pt-12 px-6 pb-4 flex items-center justify-between border-b border-white/5 bg-[#0a0f1d]">
            <button onClick={closeModal} className="p-2 -ml-2 text-slate-400 active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[28px]">close</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">calculate</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Calculadora F1</h3>
            </div>
            <div className="w-10"></div>
          </header>

          <main className="flex-1 flex flex-col p-6 overflow-hidden bg-[#0a0f1d]">
            {/* Pantalla ampliada (35% aprox) con scroll horizontal y tipografía ajustada */}
            <div className="h-[35%] bg-white/5 rounded-[2.5rem] p-6 mb-4 flex flex-col justify-end text-right border border-white/5 shadow-inner overflow-hidden">
              <div 
                ref={expressionRef}
                className="text-slate-500 text-xs font-bold mb-1 overflow-x-auto whitespace-nowrap no-scrollbar h-5"
              >
                {expression || '0'}
              </div>
              <div 
                ref={resultRef}
                className={`text-4xl font-black tracking-tighter leading-normal overflow-x-auto whitespace-nowrap no-scrollbar py-1 ${calcError ? 'text-rose-500' : 'text-white'}`}
              >
                {calcError ? 'ERROR' : (calcResult !== null ? `$${formatNumber(calcResult)}` : (expression ? expression : '0.00'))}
              </div>
            </div>

            {/* Teclado compacto */}
            <div className="flex-1 grid grid-cols-4 gap-2.5">
              <CalcBtn v="C" c="bg-rose-500/10 text-rose-500" />
              <CalcBtn v="⌫" c="bg-white/5 text-slate-400" />
              <CalcBtn v="/" l="÷" c="bg-white/10 text-primary" />
              <CalcBtn v="*" l="×" c="bg-white/10 text-primary" />

              <CalcBtn v="7" c="bg-white/5 text-white" />
              <CalcBtn v="8" c="bg-white/5 text-white" />
              <CalcBtn v="9" c="bg-white/5 text-white" />
              <CalcBtn v="-" c="bg-white/10 text-primary" />

              <CalcBtn v="4" c="bg-white/5 text-white" />
              <CalcBtn v="5" c="bg-white/5 text-white" />
              <CalcBtn v="6" c="bg-white/5 text-white" />
              <CalcBtn v="+" c="bg-white/10 text-primary" />

              <CalcBtn v="1" c="bg-white/5 text-white" />
              <CalcBtn v="2" c="bg-white/5 text-white" />
              <CalcBtn v="3" c="bg-white/5 text-white" />
              <CalcBtn v="=" c="row-span-2 bg-primary text-white shadow-xl shadow-primary/20" />

              <CalcBtn v="0" c="col-span-2 bg-white/5 text-white" />
              <CalcBtn v="." c="bg-white/5 text-white" />
            </div>

            {/* Acción Final con márgenes optimizados */}
            <div className="mt-6 mb-2">
              <button
                type="button"
                onClick={confirmResult}
                className="w-full py-4.5 bg-indigo-600 text-white font-black text-sm rounded-[2rem] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-xl">check_circle</span>
                Usar Resultado
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default MoneyInputWithCalculator;
