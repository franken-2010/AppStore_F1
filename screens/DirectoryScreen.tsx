
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';

interface DirectoryContact {
  id: string;
  supplierName: string;
  contactName: string;
  whatsappPhone: string;
  isActive: boolean;
}

const DirectoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "suppliers_directory"),
      where("uid", "==", user.uid),
      where("isActive", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        // Scrubbing: Convertir a tipos primitivos planos
        return {
          id: doc.id,
          supplierName: String(data.supplierName || ''),
          contactName: String(data.contactName || ''),
          whatsappPhone: String(data.whatsappPhone || ''),
          isActive: data.isActive === true
        };
      }) as DirectoryContact[];
      
      list.sort((a, b) => (a.supplierName || '').localeCompare(b.supplierName || ''));
      setContacts(list);
      setLoading(false);
    }, (error) => {
      console.error("Error en Directory listener:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(c => 
      (c.supplierName || '').toLowerCase().includes(q) || 
      (c.contactName || '').toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-6 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-700 dark:text-white">
              <span className="material-symbols-outlined text-3xl">menu</span>
            </button>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Directorio</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/directorio/new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              Nuevo
            </button>
            <ProfileMenu />
          </div>
        </div>

        <div className="relative group">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por empresa o contacto..."
            className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
          />
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
        </div>
      </header>

      <main className="px-6 mt-6 flex-1">
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-3xl animate-pulse"></div>)}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-20 text-center opacity-30">
            <span className="material-symbols-outlined text-6xl mb-2">contact_support</span>
            <p className="text-xs font-black uppercase tracking-widest">{searchQuery ? 'Sin coincidencias' : 'No hay proveedores registrados'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContacts.map((p) => (
              <button 
                key={p.id}
                onClick={() => navigate(`/directorio/${p.id}`)}
                className="w-full flex flex-col p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 text-left active:scale-[0.98] transition-all hover:shadow-lg group"
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-tight group-hover:text-primary transition-colors">
                    {p.contactName}
                  </h3>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                </div>
                
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-2">
                  <span className="material-symbols-outlined text-[14px]">store</span>
                  <span className="text-[11px] font-bold uppercase tracking-tight">{p.supplierName}</span>
                </div>

                {p.whatsappPhone && (
                  <div className="flex items-center gap-1.5 text-emerald-500 border-t border-slate-50 dark:border-white/5 pt-2 mt-1">
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    <span className="text-[12px] font-black tracking-tight">{p.whatsappPhone}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default DirectoryScreen;
