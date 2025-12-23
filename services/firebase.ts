
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
export const db = getFirestore(app);
