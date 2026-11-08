
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
function requireStagingSetup(reason: string): never {
  if (typeof document !== 'undefined') {
    const show = () => {
      if (document.getElementById('f1-staging-setup')) return;
      const panel = document.createElement('section');
      panel.id = 'f1-staging-setup';
      panel.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#eff6ff;padding:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:600 16px system-ui;color:#14213d;text-align:center';
      const title = document.createElement('h1');
      title.textContent = 'Abarrotes F1 · Copia de pruebas';
      const message = document.createElement('p');
      message.textContent = 'No se ha conectado a ninguna base de datos. ' + reason;
      const help = document.createElement('p');
      help.textContent = 'Configura un Firebase de pruebas y consulta AI_STUDIO_PRUEBAS.md en el repositorio.';
      panel.append(title,message,help);
      document.body.append(panel);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, {once:true});
    else show();
  }
  throw new Error(reason);
}

const config = import.meta.env;
const stagingProject = String(config.VITE_F1_STAGING_PROJECT_ID || '').trim();
if (!stagingProject || stagingProject === 'adminf1-2213b') {
  requireStagingSetup('Falta un Firebase independiente de producción.');
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
  requireStagingSetup('Faltan valores de configuración Firebase de pruebas.');
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




