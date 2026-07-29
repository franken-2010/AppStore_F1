
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from "firebase/firestore";

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

// Inicialización avanzada de Firestore con soporte offline y fallback seguro para entornos iFrame/restringidos
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true // Mitiga problemas de conexión/timeout en iFrames y redes móviles
  });
} catch (error) {
  console.warn("No se pudo inicializar Firestore con cache offline (posiblemente un iframe restrictivo o ya inicializado):", error);
  try {
    // Intentar obtener la instancia ya existente o crear una estándar
    firestoreInstance = getFirestore(app);
  } catch (err2) {
    console.error("Fallo definitivo al inicializar Firestore:", err2);
  }
}

export const db = firestoreInstance;

