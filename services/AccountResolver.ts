
import { db } from './firebase';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountIndex, AccountingAccount } from '../types';

const ACCOUNT_ALIAS: Record<string, string> = {
  "cxc_pago": "cxc",
  "pagos_cxc": "cxc",
  "pago_cxc": "cxc",
  "cxcpago": "cxc",
  "cxc_venta": "cxc"
};

const CACHE_VERSION = "f1_idx_v4"; 

export class AccountResolver {
  private static cache: Record<string, AccountIndex> = {};
  private static lastLoad: number = 0;
  private static CACHE_TTL = 1000 * 60 * 5; 

  static async loadIndex(uid: string, force = false) {
    if (!uid) return;
    const now = Date.now();
    const storedVersion = localStorage.getItem('f1_index_version');
    
    if (storedVersion !== CACHE_VERSION) {
      force = true;
      this.cache = {};
      localStorage.setItem('f1_index_version', CACHE_VERSION);
    }

    if (!force && this.lastLoad > 0 && (now - this.lastLoad < this.CACHE_TTL)) {
      return;
    }

    try {
      const q = query(collection(db, "users", uid, "accountIndex"), where("isActive", "==", true));
      const snap = await getDocs(q);
      const newCache: Record<string, AccountIndex> = {};
      
      snap.docs.forEach(d => {
        const id = d.id.toLowerCase().trim();
        if (id === 'cxc_pago') return;
        
        const data = d.data();
        // Scrubbing estricto de campos de Firestore
        newCache[id] = {
          accountId: String(d.id),
          accountDocId: String(data.accountDocId || ''),
          name: String(data.name || ''),
          type: data.type as any,
          categoryId: data.categoryId ? String(data.categoryId) : null,
          isActive: data.isActive === true,
          isContable: data.isContable !== false,
          inventoryMin: data.inventoryMin !== undefined ? Number(data.inventoryMin) : undefined,
          inventoryMax: data.inventoryMax !== undefined ? Number(data.inventoryMax) : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null
        } as AccountIndex;
      });
      
      this.cache = newCache;
      this.lastLoad = now;
    } catch (e) {
      console.error("Error loading account index:", e);
    }
  }

  private static normalizeRequestedId(id: string): string {
    const norm = id.toLowerCase().trim().replace(/\s+/g, '_');
    return ACCOUNT_ALIAS[norm] || norm;
  }

  static getAccount(accountId: string): AccountIndex | null {
    const canonicalId = this.normalizeRequestedId(accountId);
    return this.cache[canonicalId] || null;
  }

  static async assertAccount(uid: string, accountId: string): Promise<AccountIndex> {
    const canonicalId = this.normalizeRequestedId(accountId);
    let account = this.getAccount(canonicalId);
    
    if (!account) {
      const snap = await getDoc(doc(db, "users", uid, "accountIndex", canonicalId));
      if (snap.exists() && snap.data()?.isActive === true) {
        const data = snap.data();
        account = { 
          accountId: canonicalId, 
          accountDocId: String(data.accountDocId || ''),
          name: String(data.name || ''),
          type: data.type as any,
          isActive: true
        } as AccountIndex;
        this.cache[canonicalId] = account; 
      }
    }

    if (!account) {
      throw new Error(`Cuenta "${canonicalId}" no encontrada.`);
    }

    return account;
  }

  static async resolveFullAccount(uid: string, accountId: string): Promise<AccountingAccount | null> {
    if (!uid) return null;
    const canonicalId = this.normalizeRequestedId(accountId);
    try {
      const accIndex = await this.assertAccount(uid, canonicalId);
      const snap = await getDoc(doc(db, "users", uid, "accounts", accIndex.accountDocId));
      if (snap.exists()) {
        const data = snap.data();
        return { 
          id: snap.id, 
          accountId: canonicalId,
          name: String(data.name || ''),
          balance: Number(data.balance || 0),
          type: data.type,
          inventoryMin: data.inventoryMin,
          inventoryMax: data.inventoryMax
        } as AccountingAccount;
      }
    } catch (e) {
      console.warn("Could not resolve full account:", canonicalId);
    }
    return null;
  }
}
