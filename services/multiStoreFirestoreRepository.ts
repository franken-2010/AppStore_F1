import {
  collection, doc, getDoc, getDocs, query, orderBy, runTransaction,
  type Firestore,
} from 'firebase/firestore';
import {
  type ClosingRepository, type ClosingRevision, type RegisteredClosing,
} from './multiStoreClosingRepository';

/**
 * Adaptador FUTURO para Firestore aislado.
 * NO está conectado a las rutas actuales ni a los datos de producción.
 * Las reglas existentes no autorizan esta colección; requiere entorno
 * Firebase de PRUEBAS con reglas verificadas antes de cualquier uso.
 *
 * Cada corte es un solo documento inmutable por local/fecha, con movimientos
 * embebidos; cada corrección agrega un snapshot inmutable de revisión.
 * No actualiza cuentas contables antiguas ni inventarios.
 */
export class FirestoreMultiStoreClosingRepository implements ClosingRepository {
  constructor(private readonly db: Firestore) {}

  private closingRef(uid: string, id: string) {
    return doc(this.db,'users',uid,'multistoreClosings',id);
  }
  private revisionRef(uid: string, id: string, rev: number) {
    const revisionId='rev_'+String(rev).padStart(4,'0');
    return doc(this.db,'users',uid,'multistoreClosings',id,'revisions',revisionId);
  }

  async get(uid: string, id: string): Promise<RegisteredClosing | null> {
    const snap=await getDoc(this.closingRef(uid,id));
    return snap.exists() ? snap.data() as RegisteredClosing : null;
  }

  async createIfAbsent(record: RegisteredClosing, revision: ClosingRevision): Promise<boolean> {
    const parent=this.closingRef(record.uid,record.id);
    const rev=this.revisionRef(record.uid,record.id,1);
    // Dos documentos en una sola transacción, no múltiples movimientos dispersos.
    return runTransaction(this.db,async tx=>{
      const current=await tx.get(parent);
      if(current.exists())return false;
      const existingRevision=await tx.get(rev);
      if(existingRevision.exists())throw new Error('Historia ya existente: revisar integridad');
      tx.set(parent,record);
      tx.set(rev,revision);
      return true;
    });
  }

  async updateIfVersion(
    record: RegisteredClosing,expectedRevision: number,revision: ClosingRevision,
  ): Promise<boolean> {
    const parent=this.closingRef(record.uid,record.id);
    const rev=this.revisionRef(record.uid,record.id,record.revision);
    return runTransaction(this.db,async tx=>{
      const existing=await tx.get(parent);
      if(!existing.exists())return false;
      const current=existing.data() as RegisteredClosing;
      if(current.revision!==expectedRevision)return false;
      if(current.id!==record.id || current.uid!==record.uid ||
         current.storeId!==record.storeId || current.dateKey!==record.dateKey ||
         record.revision!==expectedRevision+1 ||
         revision.number!==record.revision || revision.kind!=='correction')
        throw new Error('Correción de corte no válida');
      const duplicateRevision=await tx.get(rev);
      if(duplicateRevision.exists())return false;
      tx.set(parent,record);
      tx.set(rev,revision);
      return true;
    });
  }

  async getRevisions(uid: string,id: string): Promise<ClosingRevision[]> {
    const revisions=collection(this.db,'users',uid,'multistoreClosings',id,'revisions');
    const snapshots=await getDocs(query(revisions,orderBy('number','asc')));
    return snapshots.docs.map(s=>s.data() as ClosingRevision);
  }
}
