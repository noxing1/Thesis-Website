// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Mengakses variabel global menggunakan 'window' untuk menghindari Temporal Dead Zone (TDZ)
// dan memastikan kompatibilitas saat dijalankan di luar lingkungan Canvas.
const canvasAppId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const canvasFirebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : null;


// Konfigurasi Default (Fallbacks) - HARAP GANTI DENGAN NILAI ASLI DARI FIREBASE CONSOLE ANDA
// *Jika menjalankan di GitHub Pages, pastikan ini adalah konfigurasi Firebase Anda yang valid*
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBrU2JSjCBQvhT1tSKimhYqf7nh6c9LZuE", 
    authDomain: "beecoder-7c2c4.firebaseapp.com",
    projectId: "beecoder-7c2c4",
    storageBucket: "beecoder-7c2c4.firebasestorage.app",
    messagingSenderId: "495260021564",
    appId: "1:495260021564:web:4dd0cd75a3227ee5a8e439", 
    measurementId: "G-P8SNFJFY8W"
};

// Gunakan konfigurasi Canvas jika tersedia, jika tidak, gunakan default/fallback
const firebaseConfig = canvasFirebaseConfig || DEFAULT_FIREBASE_CONFIG;


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);