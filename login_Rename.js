/* ============================================================
   SCHOOL THEME SELECTION (TK / SD)
============================================================ */

const body = document.body;
const btnTK = document.getElementById("btn-tk");
const btnSD = document.getElementById("btn-sd");

let currentTheme = "tk";   // default

// Set theme TK on load
body.classList.add("theme-tk");

// Hover TK → set theme
btnTK.addEventListener("mouseenter", () => {
    setTheme("tk");
});

// Hover SD → set theme
btnSD.addEventListener("mouseenter", () => {
    setTheme("sd");
});

function setTheme(theme) {
    currentTheme = theme;

    if (theme === "tk") {
        body.classList.add("theme-tk");
        body.classList.remove("theme-sd");
    } else {
        body.classList.add("theme-sd");
        body.classList.remove("theme-tk");
    }
}

/* ============================================================
   BUTTON ACTIONS (GO TO NEXT PAGE)
============================================================ */

// TK → pindah halaman TK
btnTK.addEventListener("click", () => {
    window.location.href = "TK/challenge-list.html";
});

// SD → sementara hanya alert
btnSD.addEventListener("click", () => {
    alert("RAPE RAPE RAPE.");
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


/* ============================================================
   APPLY LANGUAGE TO TEXT CONTENT
============================================================ */

function applyLanguage(lang) {
    if (lang === "id") {

        document.querySelector("h1").innerHTML =
            `Selamat Datang di <span class="brand">HateNiggers.com</span>!`;

        document.querySelector(".tagline").textContent =
            "Mulai perjalanan kodingmu dengan cara yang seru dan mudah.";

        document.querySelector("h3").textContent = "Apakah kamu:";
        document.querySelector(".or-text").textContent = "atau";

        document.querySelector(".footer-text").innerHTML =
            `Baru di <span class="brand">HateNiggers.com</span>? Pelajari dasar-dasar koding sambil bermain!`;

        document.querySelector("#btn-tk").textContent = "Taman Kanak-Kanak";
        document.querySelector("#btn-sd").textContent = "Sekolah Dasar";

    } else {

        document.querySelector("h1").innerHTML =
            `Welcome to <span class="brand">HateNiggers.com</span>!`;

        document.querySelector(".tagline").textContent =
            "Start your coding adventure with fun and easy challenges.";

        document.querySelector("h3").textContent = "Are you:";
        document.querySelector(".or-text").textContent = "or";

        document.querySelector(".footer-text").innerHTML =
            `New to <span class="brand">HateNiggers.com</span>? Learn basic coding while playing!`;

        document.querySelector("#btn-tk").textContent = "Kindergarten";
        document.querySelector("#btn-sd").textContent = "Elementary School";
    }
}
