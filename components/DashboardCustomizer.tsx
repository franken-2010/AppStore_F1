
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import { DashboardConfig, AccountIndex } from '../types';

interface DashboardCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  
  const defaultConfig: DashboardConfig = {
    showBalance: true,
    showLogistics: true,
    showClosings: true
  };

  const [config, setConfig] = useState<DashboardConfig>(profile?.dashboardConfig || defaultConfig);

  useEffect(() => {
    if (profile?.dashboardConfig) {
      setConfig(profile.dashboardConfig);
    }
  }, [profile?.dashboardConfig]);

  const handleToggleModule = (key: keyof DashboardConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        dashboardConfig: config
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 max-w-lg mx-auto bg-[#0a0f1d] border-t border-white/5 rounded-t-[2.5rem] z-[101] overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Personalizar</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Configura tu vista principal</p>
              </div>
              <button onClick={onClose} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Módulos Principales</h3>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { key: 'showBalance', label: 'Balance de Hoy', icon: 'account_balance_wallet' },
                    { key: 'showLogistics', label: 'Logística (Inventario)', icon: 'inventory_2' },
                    { key: 'showClosings', label: 'Cierre Reciente', icon: 'verified' }
                  ].map((m) => (
                    <button 
                      key={m.key}
                      onClick={() => handleToggleModule(m.key as any)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${config[m.key as keyof DashboardConfig] ? 'bg-primary/10 border-primary/20' : 'bg-white/5 border-white/5 opacity-60'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined ${config[m.key as keyof DashboardConfig] ? 'text-primary' : 'text-slate-500'}`}>{m.icon}</span>
                        <span className="text-sm font-bold text-white">{m.label}</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${config[m.key as keyof DashboardConfig] ? 'bg-primary' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 size-3 bg-white rounded-full transition-all ${config[m.key as keyof DashboardConfig] ? 'right-1' : 'left-1'}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>


            </div>

            <div className="p-6 bg-[#0a0f1d] border-t border-white/5">
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Guardar Cambios'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DashboardCustomizer;
