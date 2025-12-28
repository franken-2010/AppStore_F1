
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import ProfileMenu from '../components/ProfileMenu';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountType } from '../types';

const AccountingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumen' | 'cuentas' | 'proveedores'>('cuentas');
  
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountingAccount | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<AccountType>>(new Set());
  
  // Form States
  const [accName, setAccName] = useState('');
  const [accCode, setAccCode] = useState('');
  const [accType, setAccType] = useState<AccountType>('Activo');
  const [accDesc, setAccDesc] = useState('');
  const [accInitialBalance, setAccInitialBalance] = useState<string>('0');
  const [accParentId, setAccParentId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    
    const unsubAcc = onSnapshot(query(collection(db, "users", user.uid, "accounts")), (snap) => {
      const accs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingAccount));
      setAccounts(accs);
    }, (error) => {
      console.error("Error al leer cuentas:", error);
    });

    const unsubProv = onSnapshot(query(collection(db, "users", user.uid, "providers")), (snap) => {
      setProviders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAcc(); unsubProv(); };
  }, [user]);

  // Autogenerar código sugerido cuando cambia el tipo (solo si es cuenta nueva)
  useEffect(() => {
    if (!editingAccount && showAddAccount) {
      const prefixMap: Record<string, string> = { 'Activo': '1', 'Pasivo': '2', 'Capital': '3', 'Ingreso': '4', 'Gasto': '5' };
      const prefix = prefixMap[accType] || '1';
      const sameTypeAccs = accounts.filter(a => a.type === accType);
      const nextNum = sameTypeAccs.length + 1;
      setAccCode(`${prefix}${String(nextNum).padStart(3, '0')}`);
    }
  }, [accType, editingAccount, showAddAccount, accounts]);

  const toggleCategory = (category: AccountType) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) newCollapsed.delete(category);
    else newCollapsed.add(category);
    setCollapsedCategories(newCollapsed);
  };

  const saveAccount = async () => {
    if (!user) {
      alert("No hay una sesión activa.");
      return;
    }
    if (!accName.trim() || !accCode.trim()) {
      alert("Por favor completa el nombre y el código.");
      return;
    }

    setIsProcessing(true);
    try {
      const balanceNum = parseFloat(accInitialBalance) || 0;
      const accountData: any = {
        name: accName.trim(), 
        code: accCode.trim(), 
        type: accType, 
        description: accDesc,
        initialBalance: balanceNum, 
        parentId: accParentId || null,
        updatedAt: serverTimestamp()
      };

      if (editingAccount && editingAccount.id) {
        const diff = balanceNum - (editingAccount.initialBalance || 0);
        accountData.balance = (editingAccount.balance || 0) + diff;
        const ref = doc(db, "users", user.uid, "accounts", editingAccount.id);
        await updateDoc(ref, accountData);
      } else {
        accountData.balance = balanceNum;
        accountData.createdAt = serverTimestamp();
        await addDoc(collection(db, "users", user.uid, "accounts"), accountData);
      }
      closeAccountModal();
    } catch (err: any) { 
      console.error("Error al guardar:", err);
      alert(`Error: ${err.message}`); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !editingAccount || !editingAccount.id) {
      alert("Error: ID de cuenta no identificado.");
      return;
    }
    
    const hasChildren = accounts.some(a => a.parentId === editingAccount.id);
    if (hasChildren) {
      alert("⚠️ No puedes eliminar esta cuenta porque tiene sub-cuentas.");
      return;
    }

    const confirmed = window.confirm(`¿ELIMINAR PERMANENTEMENTE?\n\n"${editingAccount.name}" (${editingAccount.code}) será borrada de Firebase.`);
    
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const ref = doc(db, "users", user.uid, "accounts", editingAccount.id);
      await deleteDoc(ref);
      alert("✅ Cuenta eliminada correctamente.");
      closeAccountModal();
    } catch (err: any) { 
      console.error("Error al eliminar:", err);
      alert(`❌ Error: ${err.message}`); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const openEditAccount = (acc: AccountingAccount) => {
    setEditingAccount(acc); 
    setAccName(acc.name); 
    setAccCode(acc.code); 
    setAccType(acc.type);
    setAccDesc(acc.description || ''); 
    setAccInitialBalance(String(acc.initialBalance || 0));
    setAccParentId(acc.parentId || ''); 
    setShowAddAccount(true);
  };

  const closeAccountModal = () => {
    setShowAddAccount(false); 
    setEditingAccount(null);
    setAccName(''); setAccCode(''); setAccType('Activo'); setAccDesc('');
    setAccInitialBalance('0'); setAccParentId('');
  };

  const totalAssets = accounts.filter(a => a.type === 'Activo').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLiabilities = accounts.filter(a => a.type === 'Pasivo').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalCapital = accounts.filter(a => a.type === 'Capital').reduce((sum, a) => sum + (a.balance || 0), 0);
  const rootAccounts = accounts.filter(a => !a.parentId).sort((a, b) => a.code.localeCompare(b.code));

  const getAmountColor = (type: AccountType) => {
    if (type === 'Pasivo' || type === 'Gasto') return 'text-red-500';
    return 'text-sky-500';
  };

  const AccountRow: React.FC<{ acc: AccountingAccount, depth?: number }> = ({ acc, depth = 0 }) => {
    const children = accounts.filter(a => a.parentId === acc.id).sort((a, b) => a.code.localeCompare(b.code));
    return (
      <>
        <div 
          onClick={() => openEditAccount(acc)}
          className={`flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5 active:bg-slate-50 dark:active:bg-white/5 transition-colors cursor-pointer px-4`}
          style={{ paddingLeft: `${16 + (depth * 16)}px` }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 font-mono leading-none mb-1">{acc.code}</span>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{acc.name}</span>
          </div>
          <span className={`text-sm font-black ${getAmountColor(acc.type)}`}>
            $ {acc.balance?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </span>
        </div>
        {children.map(child => <AccountRow key={child.id} acc={child} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-1 -ml-1 text-slate-700 dark:text-slate-300">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-lg font-bold">Contabilidad</h1>
          </div>
          <ProfileMenu />
        </div>

        <div className="flex justify-between py-4 border-b border-slate-100 dark:border-white/5">
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Capital</p>
            <p className="text-sm font-black text-sky-500">${totalCapital.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center flex-1 border-x border-slate-100 dark:border-white/5">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">A deber</p>
            <p className="text-sm font-black text-red-500">${totalLiabilities.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Balance</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">${(totalAssets - totalLiabilities).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="flex p-1 bg-slate-100 dark:bg-surface-dark rounded-xl mt-4">
          {(['resumen', 'cuentas', 'proveedores'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white dark:bg-primary text-primary dark:text-white shadow-sm' : 'text-slate-500'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'cuentas' ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5 animate-in fade-in">
            {(['Activo', 'Pasivo', 'Capital', 'Ingreso', 'Gasto'] as AccountType[]).map(cat => {
              const catAccs = rootAccounts.filter(a => a.type === cat);
              if (catAccs.length === 0) return null;
              const isCollapsed = collapsedCategories.has(cat);
              const catTotal = accounts.filter(a => a.type === cat).reduce((sum, a) => sum + (a.balance || 0), 0);

              return (
                <div key={cat} className="flex flex-col">
                  <div 
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-white/5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-xs text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>expand_more</span>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{cat}s</h3>
                    </div>
                    <span className={`text-[10px] font-bold ${getAmountColor(cat)}`}>$ {catTotal.toLocaleString()}</span>
                  </div>
                  {!isCollapsed && catAccs.map(acc => <AccountRow key={acc.id} acc={acc} />)}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center space-y-4 animate-in fade-in">
            <span className="material-symbols-outlined text-6xl text-slate-200">dashboard_customize</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Pestaña en desarrollo</p>
          </div>
        )}
      </main>

      <div className="fixed bottom-[100px] right-6 z-40">
        <button 
          onClick={() => { closeAccountModal(); setShowAddAccount(true); }}
          className="size-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all border-4 border-white dark:border-background-dark"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </div>

      {showAddAccount && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAccountModal}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta F1'}</h3>
              <button onClick={closeAccountModal} className="p-2 text-slate-400"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre de la Cuenta</label>
                <input 
                  value={accName} 
                  onChange={e => setAccName(e.target.value)} 
                  className="w-full p-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary/20" 
                  placeholder="Ej: Caja Sucursal" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Código Contable</label>
                  <input 
                    value={accCode} 
                    onChange={e => setAccCode(e.target.value)} 
                    className="w-full p-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-black border-none font-mono" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Naturaleza</label>
                  <select 
                    value={accType} 
                    onChange={e => setAccType(e.target.value as any)} 
                    className="w-full p-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold border-none appearance-none"
                  >
                    {['Activo', 'Pasivo', 'Capital', 'Ingreso', 'Gasto'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Saldo Inicial</label>
                <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                   <input 
                    type="number" 
                    step="0.01"
                    inputMode="decimal"
                    value={accInitialBalance} 
                    onFocus={(e) => {
                      e.target.select();
                      if (accInitialBalance === '0' || accInitialBalance === '0.00') setAccInitialBalance('');
                    }}
                    onBlur={() => {
                      if (accInitialBalance.trim() === '') setAccInitialBalance('0');
                    }}
                    onChange={e => setAccInitialBalance(e.target.value)} 
                    className="w-full p-4 pl-8 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold border-none" 
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Depende de</label>
                <select 
                  value={accParentId} 
                  onChange={e => setAccParentId(e.target.value)} 
                  className="w-full p-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-bold border-none appearance-none"
                >
                  <option value="">Ninguna (Es Raíz)</option>
                  {accounts.filter(a => a.id !== editingAccount?.id).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button 
                  onClick={saveAccount} 
                  disabled={isProcessing} 
                  className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                  {editingAccount ? 'Actualizar Cuenta' : 'Crear Cuenta'}
                </button>
                
                {editingAccount && (
                  <button 
                    onClick={handleDeleteAccount} 
                    disabled={isProcessing} 
                    className="w-full py-3 text-red-500 font-black uppercase text-[11px] tracking-widest bg-red-500/10 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                  >
                    Eliminar Permanentemente
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default AccountingScreen;
