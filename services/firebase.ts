
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Inicialización avanzada de Firestore para soporte Offline y Redes Inestables (Long Polling)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true // Mitiga problemas de conexión/timeout en iFrames y redes móviles
});
