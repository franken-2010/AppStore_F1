
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
 * Configuración EXCLUSIVA para la copia de pruebas en AI Studio.
 * No reutilizar el proyecto Firebase de producción ni sus credenciales.
 * Las claves de configuración web Firebase son identificadores públicos:
 * aquí nunca debe incluirse una clave privada o service account.
 */
const config = import.meta.env;
const stagingProject = String(config.VITE_F1_STAGING_PROJECT_ID || '').trim();
if (!stagingProject || stagingProject === 'adminf1-2213b') {
  throw new Error('F1 PRUEBAS: falta un proyecto Firebase independiente. Prohibido conectar a adminf1-2213b.');
}
const firebaseConfig = {
  apiKey: String(config.VITE_F1_STAGING_API_KEY || '').trim(),
  authDomain: String(config.VITE_F1_STAGING_AUTH_DOMAIN || '').trim(),
  projectId: stagingProject,
  appId: String(config.VITE_F1_STAGING_APP_ID || '').trim(),
  messagingSenderId: String(config.VITE_F1_STAGING_MESSAGING_SENDER_ID || '').trim(),
  storageBucket: String(config.VITE_F1_STAGING_STORAGE_BUCKET || '').trim(),
};
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.appId) {
  throw new Error('F1 PRUEBAS: configuración Firebase de pruebas incompleta.');
}
const app = getApps().find(item => item.name === 'f1-staging-app')
  || initializeApp(firebaseConfig, 'f1-staging-app');
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




