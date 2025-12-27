
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
  runTransaction,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountingProvider, AccountType } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import VoiceInputButton from '../components/VoiceInputButton';

const AccountingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumen' | 'cuentas' | 'proveedores'>('resumen');
  
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountingAccount | null>(null);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form States - Account
  const [accName, setAccName] = useState('');
  const [accCode, setAccCode] = useState('');
  const [accType, setAccType] = useState<AccountType>('Activo');
  const [accDesc, setAccDesc] = useState('');
  const [accInitialBalance, setAccInitialBalance] = useState<number>(0);
  const [accParentId, setAccParentId] = useState<string>('');
  
  // Form States - Provider
  const [provName, setProvName] = useState('');
  const [provContact, setProvContact] = useState('');
  const [provWhatsapp, setProvWhatsapp] = useState('');

  // Form States - Transfer
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNotes, setTransferNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubAcc = onSnapshot(query(collection(db, "users", user.uid, "accounts")), (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingAccount)));
    });
    const unsubProv = onSnapshot(query(collection(db, "users", user.uid, "providers")), (snap) => {
      setProviders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAcc(); unsubProv(); };
  }, [user]);

  const handlePickContact = async () => {
    const supportsContacts = 'contacts' in navigator && !!(navigator as any).contacts.select;
    if (!supportsContacts) {
      alert("Tu dispositivo o navegador no soporta la selección de contactos.");
      return;
    }
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        if (contact.name && contact.name.length > 0) setProvContact(contact.name[0]);
        if (contact.tel && contact.tel.length > 0) {
          setProvWhatsapp(contact.tel[0].replace(/[^\d+]/g, ''));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') alert("No se pudo acceder a los contactos: " + err.message);
    }
  };

  const saveAccount = async () => {
    if (!user || !accName || !accCode) return;
    setIsProcessing(true);
    try {
      const accountData: any = {
        name: accName,
        code: accCode,
        type: accType,
        description: accDesc,
        initialBalance: Number(accInitialBalance),
        parentId: accParentId || null,
        updatedAt: serverTimestamp()
      };

      if (editingAccount && editingAccount.id) {
        // Al editar saldo inicial, ajustamos el balance actual proporcionalmente
        const diff = Number(accInitialBalance) - (editingAccount.initialBalance || 0);
        accountData.balance = (editingAccount.balance || 0) + diff;
        
        await updateDoc(doc(db, "users", user.uid, "accounts", editingAccount.id), accountData);
      } else {
        accountData.balance = Number(accInitialBalance);
        accountData.createdAt = serverTimestamp();
        await addDoc(collection(db, "users", user.uid, "accounts"), accountData);
      }
      closeAccountModal();
    } catch (err) {
      alert("Error al guardar la cuenta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || !editingAccount || !editingAccount.id) return;
    
    const hasChildren = accounts.some(a => a.parentId === editingAccount.id);
    if (hasChildren) {
      alert("No puedes eliminar una cuenta que tiene sub-cuentas. Elimina primero las sub-cuentas.");
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la cuenta "${editingAccount.name}"? Esta acción no se puede deshacer.`)) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "accounts", editingAccount.id));
      closeAccountModal();
    } catch (err) {
      alert("Error al eliminar la cuenta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!user || !transferFrom || !transferTo || transferAmount <= 0) {
      alert("Por favor completa todos los campos con montos válidos.");
      return;
    }

    if (transferFrom === transferTo) {
      alert("La cuenta de origen y destino deben ser diferentes.");
      return;
    }

    setIsProcessing(true);
    try {
      const fromRef = doc(db, "users", user.uid, "accounts", transferFrom);
      const toRef = doc(db, "users", user.uid, "accounts", transferTo);

      await runTransaction(db, async (transaction) => {
        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);

        if (!fromSnap.exists() || !toSnap.exists()) {
          throw "Una de las cuentas no existe.";
        }

        const fromBalance = fromSnap.data().balance || 0;
        const toBalance = toSnap.data().balance || 0;

        transaction.update(fromRef, { balance: fromBalance - transferAmount });
        transaction.update(toRef, { balance: toBalance + transferAmount });

        // Opcional: Registrar transacción en una colección histórica
        const historyRef = doc(collection(db, "users", user.uid, "transactions"));
        transaction.set(historyRef, {
          type: 'transfer',
          from: fromSnap.data().name,
          to: toSnap.data().name,
          amount: transferAmount,
          notes: transferNotes,
          timestamp: serverTimestamp()
        });
      });

      setShowTransferModal(false);
      setTransferAmount(0);
      setTransferNotes('');
      alert("Transferencia realizada con éxito.");
    } catch (err) {
      alert("Error en la transferencia: " + err);
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
    setAccInitialBalance(acc.initialBalance || 0);
    setAccParentId(acc.parentId || '');
    setShowAddAccount(true);
  };

  const closeAccountModal = () => {
    setShowAddAccount(false);
    setEditingAccount(null);
    setAccName(''); setAccCode(''); setAccType('Activo'); setAccDesc('');
    setAccInitialBalance(0); setAccParentId('');
  };

  const saveProvider = async () => {
    if (!user || !provName) return;
    setIsAiLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "providers"), {
        name: provName, contactName: provContact, whatsapp: provWhatsapp,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setShowAddProvider(false);
      setProvName(''); setProvContact(''); setProvWhatsapp('');
    } catch (err) { alert("Error al guardar proveedor."); }
    finally { setIsAiLoading(false); }
  };

  const getTypeColor = (type: AccountType) => {
    switch (type) {
      case 'Activo': return 'bg-emerald-500/10 text-emerald-600';
      case 'Pasivo': return 'bg-red-500/10 text-red-600';
      case 'Ingreso': return 'bg-blue-500/10 text-blue-600';
      case 'Gasto': return 'bg-amber-500/10 text-amber-600';
      case 'Capital': return 'bg-indigo-500/10 text-indigo-600';
      default: return 'bg-slate-500/10 text-slate-600';
    }
  };

  const rootAccounts = accounts.filter(a => !a.parentId).sort((a, b) => a.code.localeCompare(b.code));
  const totalAssets = accounts.filter(a => a.type === 'Activo').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLiabilities = accounts.filter(a => a.type === 'Pasivo').reduce((sum, a) => sum + (a.balance || 0), 0);

  const AccountItem: React.FC<{ acc: AccountingAccount, isSub?: boolean }> = ({ acc, isSub = false }) => {
    const children = accounts.filter(a => a.parentId === acc.id).sort((a, b) => a.code.localeCompare(b.code));
    return (
      <div className="space-y-2">
        <div onClick={() => openEditAccount(acc)} className={`p-4 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-white/5 flex items-center gap-4 group hover:border-primary/50 transition-all shadow-sm cursor-pointer ${isSub ? 'ml-6' : ''}`}>
          <div className={`size-10 rounded-xl flex items-center justify-center font-black text-[9px] shrink-0 ${getTypeColor(acc.type)} shadow-inner`}>
            {acc.code}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{acc.name}</p>
            {!isSub && <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{acc.type}</p>}
          </div>
          <div className="text-right">
            <p className="font-black text-sm tracking-tighter text-slate-900 dark:text-white">${(acc.balance || 0).toLocaleString()}</p>
          </div>
          <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-lg">edit</span>
        </div>
        {children.length > 0 && (
          <div className="relative pl-2 border-l border-slate-100 dark:border-slate-800 ml-5 space-y-2">
            {children.map(child => <AccountItem key={child.id} acc={child} isSub={true} />)}
          </div>
        )}
      </div>
    );
  };

  const accountCategories: AccountType[] = ['Activo', 'Pasivo', 'Capital', 'Ingreso', 'Gasto'];

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-xl font-extrabold tracking-tight">Finanzas F1</h1>
        </div>
        <ProfileMenu />
      </header>

      <div className="px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
        {['resumen', 'cuentas', 'proveedores'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-100 dark:bg-surface-dark text-slate-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
            <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-primary to-indigo-700 text-white shadow-xl relative overflow-hidden">
               <span className="material-symbols-outlined absolute right-[-10px] top-[-10px] text-9xl opacity-10">payments</span>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">Patrimonio Neto F1</p>
               <h2 className="text-4xl font-black tracking-tighter">${(totalAssets - totalLiabilities).toLocaleString()}</h2>
               <div className="mt-6 grid grid-cols-2 gap-3">
                 <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
                   <p className="text-[9px] font-black uppercase opacity-60 mb-1">Activos</p>
                   <p className="text-lg font-black">${totalAssets.toLocaleString()}</p>
                 </div>
                 <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
                   <p className="text-[9px] font-black uppercase opacity-60 mb-1">Pasivos</p>
                   <p className="text-lg font-black">${totalLiabilities.toLocaleString()}</p>
                 </div>
               </div>
            </div>

            <button 
              onClick={() => setShowTransferModal(true)}
              className="w-full p-5 bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 rounded-3xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined">swap_horiz</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black">Transferir Fondos</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entre tus propias cuentas</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
            </button>
          </div>
        )}

        {activeTab === 'cuentas' && (
          <div className="space-y-8 animate-in fade-in pb-12">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Plan de Cuentas</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estructura Financiera F1</p>
              </div>
              <button onClick={() => setShowAddAccount(true)} className="size-11 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>

            {accountCategories.map(category => {
              const categoryAccounts = rootAccounts.filter(a => a.type === category);
              if (categoryAccounts.length === 0) return null;
              const categoryTotal = accounts.filter(a => a.type === category).reduce((sum, a) => sum + (a.balance || 0), 0);

              return (
                <section key={category} className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1 h-4 rounded-full ${getTypeColor(category).split(' ')[1]}`}></div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{category}s</h3>
                    </div>
                    <span className="text-[11px] font-black text-slate-900 dark:text-white">${categoryTotal.toLocaleString()}</span>
                  </div>
                  <div className="space-y-3">
                    {categoryAccounts.map(acc => <AccountItem key={acc.id} acc={acc} />)}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {activeTab === 'proveedores' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Socios Comerciales</h2>
              <button onClick={() => setShowAddProvider(true)} className="size-10 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <span className="material-symbols-outlined">person_add</span>
              </button>
            </div>
            {providers.map(prov => (
              <div key={prov.id} className="p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 flex items-center gap-4 shadow-sm group">
                <div className="size-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">business</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{prov.name}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{prov.contactName || 'Sin contacto'}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">{prov.whatsapp || 'Sin Teléfono'}</p>
                </div>
                {prov.whatsapp && (
                  <a href={`https://wa.me/${prov.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="size-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center active:scale-90 shadow-sm">
                    <span className="material-symbols-outlined text-lg font-bold">chat</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Nueva / Editar Cuenta */}
      {showAddAccount && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-background-dark rounded-t-[3rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-y-auto max-h-[90vh] no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black tracking-tight">{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
              <button onClick={closeAccountModal} className="size-10 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center text-slate-500">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre Descriptivo</label>
                <input value={accName} onChange={(e) => setAccName(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 text-base font-bold outline-none shadow-inner" placeholder="Ej: Caja Chica" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input value={accCode} onChange={(e) => setAccCode(e.target.value)} className="bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold outline-none shadow-inner" placeholder="Código" />
                <select value={accType} onChange={(e) => setAccType(e.target.value as any)} className="bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold outline-none shadow-inner appearance-none">
                  <option value="Activo">Activo</option>
                  <option value="Pasivo">Pasivo</option>
                  <option value="Capital">Capital</option>
                  <option value="Ingreso">Ingreso</option>
                  <option value="Gasto">Gasto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Saldo Inicial ($)</label>
                <input type="number" value={accInitialBalance} onChange={(e) => setAccInitialBalance(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold outline-none shadow-inner" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Cuenta Principal</label>
                <select value={accParentId} onChange={(e) => setAccParentId(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 text-base font-bold outline-none appearance-none shadow-inner">
                  <option value="">Cuenta Raíz</option>
                  {accounts.filter(a => a.id !== editingAccount?.id).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 space-y-3">
                <button onClick={saveAccount} disabled={isProcessing} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">
                  {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                {editingAccount && (
                  <button onClick={deleteAccount} disabled={isProcessing} className="w-full bg-red-500/10 text-red-500 font-black py-4 rounded-2xl border border-red-500/20 active:scale-95 transition-all">
                    Eliminar Cuenta por Completo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferencia */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-background-dark rounded-t-[3rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black tracking-tight text-primary">Transferencia</h3>
              <button onClick={() => setShowTransferModal(false)} className="size-10 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">De Cuenta</label>
                  <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold outline-none shadow-inner appearance-none">
                    <option value="">Seleccionar origen...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance?.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1">A Cuenta</label>
                  <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold outline-none shadow-inner appearance-none">
                    <option value="">Seleccionar destino...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance?.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Monto a Transferir ($)</label>
                <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold text-xl outline-none shadow-inner" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nota (Opcional)</label>
                <input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold outline-none shadow-inner" placeholder="Ej: Movimiento de caja a banco" />
              </div>
              <button onClick={handleTransfer} disabled={isProcessing} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all mt-4">
                {isProcessing ? 'Procesando...' : 'Confirmar Transferencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Proveedor */}
      {showAddProvider && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-background-dark rounded-t-[3rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-indigo-500">Nuevo Socio F1</h3>
              <button onClick={() => setShowAddProvider(false)} className="size-10 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-6">
              <button onClick={handlePickContact} className="w-full py-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 font-black rounded-2xl border-2 border-dashed border-indigo-200 active:scale-95 transition-all">Importar de Mis Contactos</button>
              <div className="space-y-4">
                <input value={provName} onChange={(e) => setProvName(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold shadow-inner outline-none" placeholder="Razón Social (Empresa)" />
                <input value={provContact} onChange={(e) => setProvContact(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold shadow-inner outline-none" placeholder="Nombre de Contacto (Persona)" />
                <input value={provWhatsapp} onChange={(e) => setProvWhatsapp(e.target.value)} className="w-full bg-slate-50 dark:bg-surface-dark rounded-2xl py-4 px-5 font-bold shadow-inner outline-none" placeholder="WhatsApp / Teléfono" />
              </div>
              <button onClick={saveProvider} disabled={isAiLoading} className="w-full bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all mt-4 disabled:opacity-50">
                {isAiLoading ? 'Guardando...' : 'Registrar Socio F1'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default AccountingScreen;
