import { auth, db } from "./firebase-init.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ============================================================
    GLOBAL STATE & LANGUAGE DEFINITION
============================================================ */
let currentLanguage = localStorage.getItem("lang") || "id";
let lastErrorMsg = null; 
let currentUsername = "Pengguna"; 

const L = {
    en: {
        login_title: `Welcome, <span id="current-username-display">User</span> to <span class="brand">BeeCoder</span>!`,
        login_tagline: "Start your coding adventure with fun and easy challenges.",
        login_areyou: "Are you:",
        login_or: "or",
        login_footer: `New to <span class="brand">BeeCoder</span>? Learn basic coding while playing!`,
        btn_tk: "Kindergarten",
        btn_sd: "Elementary School",
        btn_logout: "Log Out", 
        logout_status: `Not your account? <span id="btn-logout" class="link">Log Out</span>`, 

        error_empty: "Do not leave fields empty!",
        error_wrong: "Incorrect username or password!",
        error_password_mismatch: "Passwords do not match!",
        error_general: "An unexpected error occurred.",

        modal_login_title: "Login",
        modal_create_title: "Create Account",
        modal_username_ph: "Username",
        modal_password_ph: "Password",
        modal_repeat_password_ph: "Repeat Password",
        modal_remember_me: "Remember me",
        modal_not_account: `Don't have an account? <span id="go-create" class="link">Create</span>`,
        modal_has_account: `Already have an account? <span id="go-login" class="link">Login</span>`,
        modal_login_btn: "Login",
        modal_create_btn: "Create Account"
    },
    id: {
        login_title: `Selamat Datang, <span id="current-username-display">Pengguna</span> di <span class="brand">BeeCoder</span>!`,
        login_tagline: "Mulai perjalanan kodingmu dengan cara yang seru dan mudah.",
        login_areyou: "Apakah kamu:",
        login_or: "atau",
        login_footer: `Baru di <span class="brand">BeeCoder</span>? Pelajari dasar-dasar koding sambil bermain!`,
        btn_tk: "Taman Kanak-Kanak",
        btn_sd: "Sekolah Dasar",
        btn_logout: "Keluar", 
        logout_status: `Bukan akunmu? <span id="btn-logout" class="link">Keluar</span>`, 

        error_empty: "Jangan kosongi kolom!",
        error_wrong: "Username atau password salah!",
        error_password_mismatch: "Password tidak sama!",
        error_general: "Terjadi kesalahan tak terduga.",

        modal_login_title: "Masuk",
        modal_create_title: "Buat Akun",
        modal_username_ph: "Nama Pengguna",
        modal_password_ph: "Kata Sandi",
        modal_repeat_password_ph: "Ulangi Kata Sandi",
        modal_remember_me: "Ingat saya",
        modal_not_account: `Belum punya akun? <span id="go-create" class="link">Buat Akun</span>`,
        modal_has_account: `Sudah punya akun? <span id="go-login" class="link">Masuk</span>`,
        modal_login_btn: "Masuk",
        modal_create_btn: "Buat Akun"
    }
};

/* ============================================================
    UI DOM REFERENCES
============================================================ */
const body = document.body;
const loginWin = document.getElementById("login-window");
const createWin = document.getElementById("create-window");
const overlay = document.getElementById("login-overlay");
const btnTK = document.getElementById("btn-tk");
const btnSD = document.getElementById("btn-sd");
const btnLogout = document.getElementById("btn-logout"); 
const logoutStatusText = document.getElementById("logout-status-text"); 
const langBtn = document.getElementById("lang-toggle-btn");

let switching = false;

document.addEventListener("DOMContentLoaded", () => {
    
    body.classList.add(`theme-${currentLanguage === 'id' ? 'tk' : 'sd'}`); 
    applyLanguage(currentLanguage);
    updateLangButtonText();

    /* ============================================================
        THEME HOVER ACTIONS
    ============================================================ */
    btnTK.addEventListener("mouseenter", () => { body.classList.add("theme-tk-hover"); });
    btnTK.addEventListener("mouseleave", () => { body.classList.remove("theme-tk-hover"); });

    btnSD.addEventListener("mouseenter", () => { body.classList.add("theme-sd-hover"); });
    btnSD.addEventListener("mouseleave", () => { body.classList.remove("theme-sd-hover"); });

    /* ============================================================
        NAVIGATION ACTIONS
    ============================================================ */
    btnTK.addEventListener("click", () => {
        localStorage.setItem("theme", "tk");
        window.location.href = "TK/challenge-list.html";
    });

    btnSD.addEventListener("click", () => {
        localStorage.setItem("theme", "sd");
        window.location.href = "SD/challenge-list.html";
    });
    
    if (btnLogout) {
        btnLogout.onclick = handleLogout;
    }

    /* ============================================================
        LANGUAGE LOGIC
    ============================================================ */
    langBtn.onclick = () => {
        currentLanguage = (currentLanguage === "id") ? "en" : "id";
        localStorage.setItem("lang", currentLanguage);
        applyLanguage(currentLanguage);
        updateLangButtonText();
        updateErrorLanguage();
    };

    function updateLangButtonText() {
        langBtn.textContent = (currentLanguage === "id") ? "IND" : "ENG";
    }

    function applyLanguage(lang) {
        const T = L[lang];

        const titleH1 = document.querySelector("h1");
        if (titleH1) titleH1.innerHTML = T.login_title;

        const usernameDisplay = document.getElementById("current-username-display");
        if (usernameDisplay) {
            usernameDisplay.textContent = currentUsername; 
        }

        text(document.querySelector(".tagline"), T.login_tagline);
        text(document.querySelector("h3"), T.login_areyou);
        text(document.querySelector(".or-text"), T.login_or);

        const footer = document.querySelector(".footer-text");
        if (footer) footer.innerHTML = T.login_footer;

        text(btnTK, T.btn_tk);
        text(btnSD, T.btn_sd);
        
        if (logoutStatusText) {
             logoutStatusText.innerHTML = T.logout_status;
             const newBtnLogout = document.getElementById("btn-logout");
             if (newBtnLogout) {
                 newBtnLogout.onclick = handleLogout;
             }
        }

        /* -------------------------
            MODAL TEXTS
        ------------------------- */
        text(document.querySelector('#login-window .modal-title'), T.modal_login_title);
        document.getElementById('login-username').placeholder = T.modal_username_ph;
        document.getElementById('login-password').placeholder = T.modal_password_ph;
        text(document.querySelector('#login-window .toggle span'), T.modal_remember_me);
        text(document.getElementById('login-btn'), T.modal_login_btn);
        document.querySelector('#login-window .small-text').innerHTML = T.modal_not_account;

        text(document.querySelector('#create-window .modal-title'), T.modal_create_title);
        document.getElementById('create-username').placeholder = T.modal_username_ph;
        document.getElementById('create-password').placeholder = T.modal_password_ph;
        document.getElementById('create-password2').placeholder = T.modal_repeat_password_ph;
        text(document.getElementById('create-btn'), T.modal_create_btn);
        document.querySelector('#create-window .small-text').innerHTML = T.modal_has_account;
        
        updateErrorLanguage();
    }

    /* ============================================================
        ERROR MESSAGE HANDLING
    ============================================================ */
    function updateErrorLanguage() {
        if (!lastErrorMsg) return;

        let errorEl;
        let msg = L[currentLanguage].error_general;
        
        if (loginWin.classList.contains("active") && !document.getElementById("login-error").classList.contains("hidden")) {
            errorEl = document.getElementById("login-error");
        } else if (createWin.classList.contains("active") && !document.getElementById("create-error").classList.contains("hidden")) {
            errorEl = document.getElementById("create-error");
        } else {
             return; 
        }

        if (lastErrorMsg === 'empty') {
            msg = L[currentLanguage].error_empty;
        } else if (lastErrorMsg === 'wrong_credentials') {
            msg = L[currentLanguage].error_wrong;
        } else if (lastErrorMsg === 'mismatch') {
            msg = L[currentLanguage].error_password_mismatch;
        } else if (typeof lastErrorMsg === 'string' && lastErrorMsg.includes('auth/')) {
             msg = L[currentLanguage].error_general;
        } else if (typeof lastErrorMsg === 'string') {
             msg = lastErrorMsg;
        }
        
        if (errorEl) {
             errorEl.textContent = msg;
        }
    }

    function showModalError(id, msgCode) {
        lastErrorMsg = msgCode; 
        let msg = L[currentLanguage].error_general;

        if (msgCode === 'empty') {
            msg = L[currentLanguage].error_empty;
        } else if (msgCode === 'wrong_credentials') {
            msg = L[currentLanguage].error_wrong;
        } else if (msgCode === 'mismatch') {
            msg = L[currentLanguage].error_password_mismatch;
        } else if (typeof msgCode === 'string' && msgCode.includes('auth/')) {
             msg = L[currentLanguage].error_general;
        } else if (typeof msgCode === 'string') {
            msg = msgCode;
        }
        
        const el = document.getElementById(id);
        el.textContent = msg;
        el.classList.remove("hidden");
    }

    function hideAllErrors() {
        document.getElementById("login-error").classList.add("hidden");
        document.getElementById("create-error").classList.add("hidden");
        lastErrorMsg = null;
    }

    /* ============================================================
        HELPER FUNCTIONS
    ============================================================ */
    function text(el, value) {
        if (el) el.textContent = value;
    }

    /* ============================================================
        AUTH STATE HANDLER
    ============================================================ */
    onAuthStateChanged(auth, async (user) => { 
        localStorage.removeItem("username");
        localStorage.removeItem("xp");
        localStorage.removeItem("completedChallenges");

        if (user) {
            const docRef = doc(db, "artifacts", auth.app.options.appId, "users", user.uid, "profile", "data");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                
                currentUsername = userData.username || "Pengguna";
                const userTheme = userData.theme || 'tk';
                const userXP = userData.xp || 0;
                const completedChallenges = userData.completedChallenges || []; 
                
                localStorage.setItem("username", currentUsername);
                localStorage.setItem("xp", userXP.toString());
                localStorage.setItem("theme", userTheme); 
                localStorage.setItem("completedChallenges", JSON.stringify(completedChallenges)); 

                body.classList.remove("theme-tk", "theme-sd");
                body.classList.add(`theme-${userTheme}`);
                applyLanguage(currentLanguage);

            } else {
                console.warn("User profile data not found in Firestore for UID:", user.uid);
                currentUsername = user.email.split('@')[0];
                localStorage.setItem("username", currentUsername);
            }

            fadeOutLogin();
        } else {
            currentUsername = "Pengguna"; 
            applyLanguage(currentLanguage); 
            showLogin();
        }
    });

    /* ============================================================
        LOGOUT STATUS TEXT (NEW)
    ============================================================ */
    async function handleLogout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }

    /* ============================================================
        LOGIN / CREATE WINDOW ACTIONS
    ============================================================ */
    function showLogin() {
        overlay.classList.remove("hidden");
        overlay.style.opacity = 1;
        body.classList.add("login-mode");
        if (logoutStatusText) {
            logoutStatusText.classList.add("hidden");
        }
    }

    function fadeOutLogin() {
        overlay.style.opacity = 0;
        body.classList.remove("login-mode");
        if (logoutStatusText) {
            logoutStatusText.classList.remove("hidden");
        }

        setTimeout(() => {
            overlay.classList.add("hidden");
            overlay.style.opacity = '';
        }, 700);
    }

    function switchToCreate() {
        if (switching) return;
        switching = true;

        hideAllErrors();
        lastErrorMsg = null;

        loginWin.classList.add("slide-up");
        loginWin.classList.remove("active");

        createWin.classList.add("active", "slide-up-reverse");
        createWin.classList.remove("hidden");

        setTimeout(() => {
            loginWin.classList.add("hidden");
            loginWin.classList.remove("slide-up");
            createWin.classList.remove("slide-up-reverse");
            switching = false;
        }, 450);
    }

    function switchToLogin() {
        if (switching) return;
        switching = true;

        hideAllErrors();
        lastErrorMsg = null;

        createWin.classList.add("slide-up");
        createWin.classList.remove("active");

        loginWin.classList.add("active", "slide-up-reverse");
        loginWin.classList.remove("hidden");

        setTimeout(() => {
            createWin.classList.add("hidden");
            createWin.classList.remove("slide-up");
            loginWin.classList.remove("slide-up-reverse");
            switching = false;
        }, 450);
    }

    document.addEventListener("click", (e) => {
        if (e.target.id === "go-create") switchToCreate();
        if (e.target.id === "go-login") switchToLogin();
    });

    /* ============================================================
        FIREBASE AUTH ACTIONS
    ============================================================ */
    document.getElementById("create-btn").onclick = async () => {
        hideAllErrors();

        const u = document.getElementById("create-username").value.trim();
        const p1 = document.getElementById("create-password").value;
        const p2 = document.getElementById("create-password2").value;

        if (!u || !p1 || !p2) {
            showModalError("create-error", 'empty');
            return;
        }

        if (p1 !== p2) {
            showModalError("create-error", 'mismatch');
            return;
        }
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, `${u}@beecoder.com`, p1);
            
            await setDoc(doc(db, "artifacts", auth.app.options.appId, "users", userCredential.user.uid, "profile", "data"), {
                username: u,
                xp: 0,
                lastLevel: 0,
                theme: 'tk', 
                completedChallenges: [] 
            });
            
            switchToLogin(); 
        } catch(err) {
            showModalError("create-error", err.message);
        }
    };

    document.getElementById("login-btn").onclick = async () => {
        hideAllErrors();

        const u = document.getElementById("login-username").value.trim();
        const p = document.getElementById("login-password").value;

        if (!u || !p) {
            showModalError("login-error", 'empty');
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, `${u}@beecoder.com`, p);
        } catch (err) {
            showModalError("login-error", 'wrong_credentials');
        }
    };
});