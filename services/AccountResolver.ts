
import { db } from './firebase';
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountIndex, AccountingAccount } from '../types';

export class AccountResolver {
  private static cache: Record<string, AccountIndex> = {};
  private static lastLoad: number = 0;
  private static CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  /**
   * Load the accountIndex into memory for fast lookup
   */
  static async loadIndex(uid: string, force = false) {
    const now = Date.now();
    if (!force && this.lastLoad > 0 && (now - this.lastLoad < this.CACHE_TTL)) {
      return;
    }

    try {
      const q = query(collection(db, "users", uid, "accountIndex"), where("isActive", "==", true));
      const snap = await getDocs(q);
      const newCache: Record<string, AccountIndex> = {};
      snap.docs.forEach(d => {
        newCache[d.id] = { accountId: d.id, ...d.data() } as AccountIndex;
      });
      this.cache = newCache;
      this.lastLoad = now;
    } catch (e) {
      console.error("Error loading account index:", e);
    }
  }

  /**
   * Returns account information from cache or null if not found/inactive
   */
  static getAccount(accountId: string): AccountIndex | null {
    const normalized = this.normalizeId(accountId);
    return this.cache[normalized] || null;
  }

  /**
   * Ensures the account exists in the index, otherwise throws a descriptive error
   */
  static async assertAccount(uid: string, accountId: string): Promise<AccountIndex> {
    const normalized = this.normalizeId(accountId);
    
    // Check cache first
    let account = this.getAccount(normalized);
    
    // If not in cache, try direct fetch (maybe it was just created)
    if (!account) {
      const snap = await getDoc(doc(db, "users", uid, "accountIndex", normalized));
      if (snap.exists() && snap.data()?.isActive === true) {
        account = { accountId: normalized, ...snap.data() } as AccountIndex;
        this.cache[normalized] = account; // Update cache
      }
    }

    if (!account) {
      throw new Error(`Cuenta requerida "${normalized}" no encontrada en el Índice Canónico. Vaya a Configuración > BDD > Diagnóstico.`);
    }

    return account;
  }

  static normalizeId(id: string): string {
    return id.toLowerCase().trim().replace(/\s+/g, '_');
  }

  /**
   * Get the Firestore Document ID (accounts collection) for a given accountId (index)
   */
  static async getDocId(uid: string, accountId: string): Promise<string> {
    const acc = await this.assertAccount(uid, accountId);
    return acc.accountDocId;
  }

  /**
   * Resolves a full account object from its canonical accountId
   */
  static async resolveFullAccount(uid: string, accountId: string): Promise<AccountingAccount | null> {
    const accIndex = await this.assertAccount(uid, accountId);
    const snap = await getDoc(doc(db, "users", uid, "accounts", accIndex.accountDocId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as AccountingAccount;
    }
    return null;
  }
}
