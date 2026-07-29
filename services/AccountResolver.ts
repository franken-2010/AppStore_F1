
import { db } from './firebase';
import { doc, getDoc, collection, getDocs, query, where, setDoc, writeBatch, updateDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from './errorHandling';
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

  static async deduplicateGastosAdministrativos(uid: string) {
    try {
      const qAcc = query(collection(db, "users", uid, "accounts"), where("accountId", "==", "gastos_administrativos"));
      const snap = await getDocs(qAcc);
      if (snap.size > 1) {
        console.log(`Found ${snap.size} duplicate 'gastos_administrativos' accounts. Remediating...`);
        const docs = snap.docs;
        
        const indexSnap = await getDoc(doc(db, "users", uid, "accountIndex", 'gastos_administrativos'));
        let preferredDocId = indexSnap.exists() ? indexSnap.data()?.accountDocId : null;
        
        let bestDoc = docs.find(d => d.id === preferredDocId);
        if (!bestDoc) {
          bestDoc = docs.find(d => Number(d.data().balance || 0) !== 0) || docs[0];
          preferredDocId = bestDoc.id;
        } else {
          const nonZeroDoc = docs.find(d => Number(d.data().balance || 0) !== 0);
          if (nonZeroDoc && Number(bestDoc.data().balance || 0) === 0) {
            bestDoc = nonZeroDoc;
            preferredDocId = bestDoc.id;
          }
        }

        const batch = writeBatch(db);
        for (const docOfList of docs) {
          if (docOfList.id !== preferredDocId) {
            batch.update(docOfList.ref, {
              isVisible: false,
              updatedAt: new Date()
            });
          }
        }

        batch.update(doc(db, "users", uid, "accounts", preferredDocId), {
          isVisible: true,
          updatedAt: new Date()
        });

        const indexDocRef = doc(db, "users", uid, "accountIndex", 'gastos_administrativos');
        batch.set(indexDocRef, {
          accountId: 'gastos_administrativos',
          accountDocId: preferredDocId,
          name: 'Gastos Administrativos',
          type: 'Capital',
          isActive: true,
          updatedAt: new Date()
        }, { merge: true });

        await batch.commit();
        console.log(`Successfully deduplicated 'gastos_administrativos' down to doc: ${preferredDocId}`);
      }
    } catch (e) {
      console.error("Error in deduplicateGastosAdministrativos", e);
    }
  }

  static async provisionGastosAdministrativos(uid: string) {
    try {
      const qCat = query(collection(db, "users", uid, "categories"));
      const catSnap = await getDocs(qCat);
      let categoryId: string | null = null;
      
      const operacionCat = catSnap.docs.find(d => String(d.data().name || '').toUpperCase() === 'OPERACIÓN');
      if (operacionCat) {
        categoryId = operacionCat.id;
      } else {
        const capitalCat = catSnap.docs.find(d => String(d.data().accountingType || '') === 'Capital');
        if (capitalCat) {
          categoryId = capitalCat.id;
        } else if (!catSnap.empty) {
          categoryId = catSnap.docs[0].id;
        }
      }

      const qAcc = query(collection(db, "users", uid, "accounts"), where("accountId", "==", "gastos_administrativos"));
      const accSnap = await getDocs(qAcc);
      
      let accDocId = "";
      if (!accSnap.empty) {
        accDocId = accSnap.docs[0].id;
        await setDoc(doc(db, "users", uid, "accounts", accDocId), {
          accountId: 'gastos_administrativos',
          name: 'Gastos Administrativos',
          code: 'VEN_GASTOS_ADMIN',
          type: 'Capital',
          categoryId: categoryId,
          isVisible: true,
          updatedAt: new Date()
        }, { merge: true });
      } else {
        const accDocRef = doc(collection(db, "users", uid, "accounts"));
        accDocId = accDocRef.id;
        await setDoc(accDocRef, {
          accountId: 'gastos_administrativos',
          name: 'Gastos Administrativos',
          code: 'VEN_GASTOS_ADMIN',
          type: 'Capital',
          categoryId: categoryId,
          balance: 0,
          order: 7,
          isVisible: true,
          description: 'Gastos administrativos generales',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      const indexDocRef = doc(db, "users", uid, "accountIndex", 'gastos_administrativos');
      await setDoc(indexDocRef, {
        accountId: 'gastos_administrativos',
        accountDocId: accDocId,
        name: 'Gastos Administrativos',
        type: 'Capital',
        categoryId: categoryId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log("Account 'gastos_administrativos' was successfully provisioned.");
    } catch (e) {
      console.error("Error auto-provisioning 'gastos_administrativos'", e);
    }
  }

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
      let snap = await getDocs(q);
      const newCache: Record<string, AccountIndex> = {};
      
      const populateCache = (s: any) => {
        s.docs.forEach((d: any) => {
          const id = d.id.toLowerCase().trim();
          if (id === 'cxc_pago') return;
          
          const data = d.data();
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
      };

      populateCache(snap);

      const hasGastosAdm = Object.keys(newCache).includes('gastos_administrativos');
      if (!hasGastosAdm) {
        await this.provisionGastosAdministrativos(uid);
        snap = await getDocs(q);
        populateCache(snap);
      }
      
      await this.deduplicateGastosAdministrativos(uid);

      this.cache = newCache;
      this.lastLoad = now;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `users/${uid}/accountIndex`);
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
      try {
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
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `users/${uid}/accountIndex/${canonicalId}`);
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
      handleFirestoreError(e, OperationType.GET, `users/${uid}/accounts`);
    }
    return null;
  }
}
