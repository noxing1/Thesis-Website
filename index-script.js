/* ============================================================
   SCHOOL THEME SELECTION (TK / SD)
============================================================ */

let currentTheme = "tk";   // default

// Set theme TK on load

const btnTK = document.getElementById("btn-tk");
const btnSD = document.getElementById("btn-sd");
const body = document.body;

/* Hover TK */
btnTK.addEventListener("mouseenter", () => {
  body.classList.add("theme-tk-hover");
});
btnTK.addEventListener("mouseleave", () => {
  body.classList.remove("theme-tk-hover");
});

/* Hover SD */
btnSD.addEventListener("mouseenter", () => {
  body.classList.add("theme-sd-hover");
});
btnSD.addEventListener("mouseleave", () => {
  body.classList.remove("theme-sd-hover");
});



/* ============================================================
   BUTTON ACTIONS (GO TO NEXT PAGE)
============================================================ */

// TK → pindah halaman TK
btnTK.addEventListener("click", () => {
    window.location.href = "TK/challenge-list.html";
});

// SD → sementara hanya alert
btnSD.addEventListener("click", () => {
    alert("Placeholder");
});


/* ============================================================
   LANGUAGE TOGGLE BUTTON (IND ⇄ ENG)
============================================================ */

let currentLanguage = localStorage.getItem("lang") || "id";
const langBtn = document.getElementById("lang-toggle-btn");

// Apply language on page load
applyLanguage(currentLanguage);
updateLangButtonText();

// Toggle language on click
langBtn.onclick = () => {
    currentLanguage = (currentLanguage === "id") ? "en" : "id";
    localStorage.setItem("lang", currentLanguage);

    applyLanguage(currentLanguage);
    updateLangButtonText();
};

// Update button text (IND/ENG)
function updateLangButtonText() {
    langBtn.textContent = (currentLanguage === "id") ? "IND" : "ENG";
}


/* ============================================
   GLOBAL LANGUAGE SYSTEM (SAFE VERSION)
============================================ */

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem("lang", lang);
    applyLanguage(lang);
    updateLangButton();
}

function updateLangButton() {
    const btn = document.getElementById("lang-toggle-btn");
    if (btn) btn.textContent = (currentLanguage === "id") ? "IND" : "ENG";
}

function text(el, value) {
    if (el) el.textContent = value;
}

function applyLanguage(lang) {

    const L = {
        en: {
            // LOGIN PAGE
            login_title: `Welcome to <span class="brand">BeeCoder</span>!`,
            login_tagline: "Start your coding adventure with fun and easy challenges.",
            login_areyou: "Are you:",
            login_or: "or",
            login_footer: `New to <span class="brand">BeeCoder</span>? Learn basic coding while playing!`,
            btn_tk: "Kindergarten",
            btn_sd: "Elementary School",

            // CHALLENGE LIST PAGE
            progress_title: "Your Progress!",
            challenge_subtitle: "Choose a coding challenge that matches your skill level.",
            challenge_title: "Challenges",
            filter_text: "Difficulty Filter",
            filter_all: "All",
            filter_easy: "Easy",
            filter_medium: "Medium",
            filter_hard: "Hard",
            user_label: "User:",
            xp_label: "XP:",
            btn_best: "Start Best Challenge",

            // GAMEPLAY PAGE
            gp_title: "GO TO THE FLOWER!",
            gp_back: "⮌ Back",
            gp_run: "▶ RUN",
            gp_resetManual: "Restart?",
            gp_blocksTitle: "Blocks",
            gp_workspaceTitle: "Workspace",
            gp_winTitle: "🎉 YOU WIN! 🎉",
            gp_winBack: "⮌ Back",
            gp_reset: "↺ Clear"
        },

        id: {
            // LOGIN PAGE
            login_title: `Selamat Datang di <span class="brand">BeeCoder</span>!`,
            login_tagline: "Mulai perjalanan kodingmu dengan cara yang seru dan mudah.",
            login_areyou: "Apakah kamu:",
            login_or: "atau",
            login_footer: `Baru di <span class="brand">BeeCoder</span>? Pelajari dasar-dasar koding sambil bermain!`,
            btn_tk: "Taman Kanak-Kanak",
            btn_sd: "Sekolah Dasar",

            // CHALLENGE LIST PAGE
            progress_title: "Progresmu!",
            challenge_subtitle: "Pilih tantangan coding yang sesuai tingkat kemampuanmu.",
            challenge_title: "Tantangan",
            filter_text: "Filter Kesulitan",
            filter_all: "Semua",
            filter_easy: "Mudah",
            filter_medium: "Sedang",
            filter_hard: "Sulit",
            user_label: "Pengguna:",
            xp_label: "XP:",
            btn_best: "Mulai Tantangan Terbaik",

            // GAMEPLAY PAGE
            gp_title: "PERGI KE BUNGA!",
            gp_back: "⮌ Kembali",
            gp_run: "▶ Jalan",
            gp_resetManual: "Ulangi?",
            gp_blocksTitle: "Blok",
            gp_workspaceTitle: "Area Kerja",
            gp_winTitle: "🎉 KAMU MENANG! 🎉",
            gp_winBack: "⮌ Kembali",
            gp_reset: "↺ Hapus"
        }
    };

    const T = L[lang];

    /* -------------------------
       LOGIN PAGE (Safe)
    ------------------------- */
    const titleH1 = document.querySelector("h1");
    if (titleH1) titleH1.innerHTML = T.login_title;

    text(document.querySelector(".tagline"), T.login_tagline);
    text(document.querySelector("h3"), T.login_areyou);
    text(document.querySelector(".or-text"), T.login_or);

    const footer = document.querySelector(".footer-text");
    if (footer) footer.innerHTML = T.login_footer;

    text(document.getElementById("btn-tk"), T.btn_tk);
    text(document.getElementById("btn-sd"), T.btn_sd);


    /* -------------------------
       CHALLENGE LIST PAGE
    ------------------------- */
    text(document.getElementById("progress-title"), T.progress_title);
    text(document.getElementById("challenge-subtitle"), T.challenge_subtitle);
    text(document.getElementById("challenge-title"), T.challenge_title);

    text(document.getElementById("filter-text"), T.filter_text);
    text(document.getElementById("filter-all"), T.filter_all);
    text(document.getElementById("filter-easy"), T.filter_easy);
    text(document.getElementById("filter-medium"), T.filter_medium);
    text(document.getElementById("filter-hard"), T.filter_hard);

    text(document.getElementById("user-label"), T.user_label);
    text(document.getElementById("xp-label"), T.xp_label);
    text(document.getElementById("btn-best-text"), T.btn_best);


    /* -------------------------
       GAMEPLAY PAGE
    ------------------------- */
    text(document.getElementById("title-text"), T.gp_title);
    text(document.getElementById("btn-back"), T.gp_back);
    text(document.getElementById("btn-run"), T.gp_run);
    text(document.getElementById("btn-reset-manual"), T.gp_resetManual);

    text(document.getElementById("title-blocks"), T.gp_blocksTitle);
    text(document.getElementById("title-workspace"), T.gp_workspaceTitle);

    const winTitle = document.querySelector(".win-title");
    if (winTitle) winTitle.textContent = T.gp_winTitle;

    text(document.getElementById("btn-kembali-win"), T.gp_winBack);
    text(document.getElementById("btn-reset-workspace"), T.gp_reset);
}

// OPEN LOGIN ON PAGE LOAD
document.body.classList.add("login-mode");
document.getElementById("login-overlay").classList.remove("hidden");

/* ================================
   SWITCH LOGIN → CREATE
================================ */
document.getElementById("go-create").onclick = () => {
    document.getElementById("login-window").classList.add("hidden");
    document.getElementById("create-window").classList.remove("hidden");
};

document.getElementById("go-login").onclick = () => {
    document.getElementById("create-window").classList.add("hidden");
    document.getElementById("login-window").classList.remove("hidden");
};

import { auth } from "./firebase-init.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.getElementById("create-btn").onclick = async () => {
    const u = document.getElementById("create-username").value.trim();
    const p1 = document.getElementById("create-password").value;
    const p2 = document.getElementById("create-password2").value;

    if (p1 !== p2) {
        document.getElementById("create-error").textContent = "Password tidak sama!";
        document.getElementById("create-error").classList.remove("hidden");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, `${u}@beecoder.com`, p1);

        // SUCCESS → kembali ke login
        document.getElementById("go-login").click();
    } catch(err) {
        document.getElementById("create-error").textContent = err.message;
        document.getElementById("create-error").classList.remove("hidden");
    }
};

document.getElementById("login-btn").onclick = async () => {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value;

    try {
        await signInWithEmailAndPassword(auth, `${u}@beecoder.com`, p);

        // SUCCESS → fade out
        fadeOutLogin();
    } catch {
        document.getElementById("login-error").classList.remove("hidden");
    }
};

function fadeOutLogin() {
    const overlay = document.getElementById("login-overlay");

    // Fade out overlay login
    overlay.style.opacity = 0;

    setTimeout(() => {
        overlay.classList.add("hidden");   // matikan overlay login
        document.body.classList.remove("login-mode");

        // Tampilkan elemen TK/SD
        const img = document.querySelector(".left-image");
        const box = document.querySelector(".content-box");

        img.style.opacity = 1;
        img.style.transform = "translateX(0)";

        box.style.opacity = 1;
        box.style.transform = "translateX(0)";
        
    }, 700);
}
