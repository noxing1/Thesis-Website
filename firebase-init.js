// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBrU2JSjCBQvhT1tSKimhYqf7nh6c9LZuE",
    authDomain: "beecoder-7c2c4.firebaseapp.com",
    projectId: "beecoder-7c2c4",
    storageBucket: "beecoder-7c2c4.firebasestorage.app",
    messagingSenderId: "495260021564",
    appId: "1:495260021564:web:4dd0cd75a3227ee5a8e439",
    measurementId: "G-P8SNFJFY8W"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
