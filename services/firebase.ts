
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel 
} from "firebase/firestore";

// Silenciar advertencias internas de conexión y timeouts de Firestore en la consola
try {
  setLogLevel('silent');
} catch (e) {
  // Ignorar en caso de restricciones de entorno
}

/**
 * Configuración oficial del proyecto adminf1-2213b
 */
const firebaseConfig = {
  apiKey: "AIzaSyDSYCYBK3zb4U6AtXHRJ-QMZp-RPZsyymc",
  authDomain: "adminf1-2213b.firebaseapp.com",
  projectId: "adminf1-2213b",
  storageBucket: "adminf1-2213b.firebasestorage.app",
  messagingSenderId: "40750376460",
  appId: "1:40750376460:web:2d299a670792aa9ca2f029",
  measurementId: "G-F0E3LK9QND"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Inicialización de Firestore optimizada para contenedores web, iframes y entornos sandboxed
let firestoreInstance: any;

try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  try {
    firestoreInstance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    });
  } catch (err2) {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;




