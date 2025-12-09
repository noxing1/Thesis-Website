// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Hapus import yang tidak diperlukan: doc, setDoc, getDoc, updateDoc, arrayUnion.
// Sebaiknya impor hanya di file yang menggunakannya (misalnya index-script.js)

// Variabel global yang disediakan oleh lingkungan Canvas (jika ada)
const __app_id = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const __firebase_config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;


// Konfigurasi Default (Fallbacks) - HARAP GANTI DENGAN NILAI ASLI DARI FIREBASE CONSOLE ANDA
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBrU2JSjCBQvhT1tSKimhYqf7nh6c9LZuE", // HARUS MENGGUNAKAN KUNCI API ASLI
    authDomain: "beecoder-7c2c4.firebaseapp.com",
    projectId: "beecoder-7c2c4",
    storageBucket: "beecoder-7c2c4.firebasestorage.app",
    messagingSenderId: "495260021564",
    appId: "1:495260021564:web:4dd0cd75a3227ee5a8e439", // HARUS MENGGUNAKAN APP ID ASLI
    measurementId: "G-P8SNFJFY8W"
};

// Gunakan konfigurasi Canvas jika tersedia, jika tidak, gunakan default/fallback
const firebaseConfig = __firebase_config || DEFAULT_FIREBASE_CONFIG;


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);