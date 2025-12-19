const CHALLENGE_TEXT = {
    id: [
        { title: "Langkah Pertama", tags: "[mudah]", blocks: { loop: false, conditional: false } },
        { title: "Kolam Kecil", tags: "[mudah]", blocks: { loop: false, conditional: false } },
        { title: "Blokade Kupu-kupu", tags: "[mudah] [musuh]", blocks: { loop: false, conditional: false } },
        { title: "Jalur Zig-Zag", tags: "[sedang] [musuh]", blocks: { loop: false, conditional: false } },
        { title: "Blokade Balik", tags: "[sedang] [musuh]", blocks: { loop: false, conditional: false } },
        { title: "Gerbang Ganda", tags: "[sedang] [musuh] [loop]", blocks: { loop: true, conditional: false } },
        { title: "Labirin Mini", tags: "[sulit] [musuh] [conditional]", blocks: { loop: false, conditional: true } },
        { title: "Simpang Tiga", tags: "[sulit] [musuh]", blocks: { loop: false, conditional: false } },
        { title: "Pola Zig-Zag", tags: "[sulit] [musuh] [loop]", blocks: { loop: true, conditional: false } },
        { title: "Labirin", tags: "[sulit] [loop] [conditional]", blocks: { loop: true, conditional: true } }
    ],

    en: [
        { title: "First Step", tags: "[easy]", blocks: { loop: false, conditional: false } },
        { title: "Small Pond", tags: "[easy]", blocks: { loop: false, conditional: false } },
        { title: "Butterfly Blockade", tags: "[easy] [enemy]", blocks: { loop: false, conditional: false } },
        { title: "Zig-Zag Path", tags: "[medium] [enemy]", blocks: { loop: false, conditional: false } },
        { title: "Reverse Blockade", tags: "[medium] [enemy]", blocks: { loop: false, conditional: false } },
        { title: "Double Gate", tags: "[medium] [enemy] [loop]", blocks: { loop: true, conditional: false } },
        { title: "Mini Maze", tags: "[hard] [enemy] [conditional]", blocks: { loop: false, conditional: true } },
        { title: "Three-Way Intersection", tags: "[hard] [enemy]", blocks: { loop: false, conditional: false } },
        { title: "Zig-Zag Pattern", tags: "[hard] [enemy] [loop]", blocks: { loop: true, conditional: false } },
        { title: "Labirynth", tags: "[hard] [loop] [conditional]", blocks: { loop: true, conditional: true } }
    ]
};

/* ============================================================
   INIT: User Data & Theme
============================================================ */
const userTheme = localStorage.getItem("theme") || "tk";
document.body.classList.remove("theme-tk", "theme-sd");
document.body.classList.add(`theme-${userTheme}`);

let completedChallenges = [];
try {
    const storedChallenges = localStorage.getItem("completedChallenges");
    if (storedChallenges) {
        completedChallenges = JSON.parse(storedChallenges);
    }
} catch (e) {
    console.error("Error parsing completed challenges:", e);
}

const TOTAL_CHALLENGES = 10;
const completedCount = completedChallenges.length;
const progressPercentage = Math.min(100, (completedCount / TOTAL_CHALLENGES) * 100);

/* ============================================================
   CLOCK (DIGITAL CLOCK WITH ANIMATION)
============================================================ */
function updateClock() {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");

    const hourEl = document.getElementById("clock-hour");
    const minEl = document.getElementById("clock-minute");

    if (hourEl.textContent !== hour) {
        hourEl.classList.add("time-animate");
        setTimeout(() => {
            hourEl.textContent = hour;
            hourEl.classList.remove("time-animate");
        }, 200);
    }

    if (minEl.textContent !== minute) {
        minEl.classList.add("time-animate");
        setTimeout(() => {
            minEl.textContent = minute;
            minEl.classList.remove("time-animate");
        }, 200);
    }
}

setInterval(updateClock, 1000);
updateClock();

/* ============================================================
   LANGUAGE TOGGLE (IND ⇄ ENG)
============================================================ */
let currentLanguage = localStorage.getItem("lang") || "id";
const langBtn = document.getElementById("lang-toggle-btn");

applyLanguage(currentLanguage);
updateLangButton();

langBtn.onclick = () => {
    currentLanguage = (currentLanguage === "id") ? "en" : "id";
    localStorage.setItem("lang", currentLanguage);
    applyLanguage(currentLanguage);
    updateLangButton();
};

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

/* ============================================================
   APPLY LANGUAGE STRINGS AND USER DATA
============================================================ */
function applyLanguage(lang) {
    const L = {
        en: {
            progress_title: "Your Progress!",
            challenge_subtitle: "Choose a coding challenge that matches your skill level.",
            challenge_title: "Challenges",
            filter_text: "Difficulty Filter",
            filter_all: "All",
            filter_easy: "Easy",
            filter_medium: "Medium",
            filter_hard: "Hard",
            user_label: "User:",
            xp_label: "Completed:",
            btn_best: "Start Best Challenge",
        },
        id: {
            progress_title: "Progresmu!",
            challenge_subtitle: "Pilih tantangan coding yang sesuai tingkat kemampuanmu.",
            challenge_title: "Tantangan",
            filter_text: "Filter Kesulitan",
            filter_all: "Semua",
            filter_easy: "Mudah",
            filter_medium: "Sedang",
            filter_hard: "Sulit",
            user_label: "Pengguna:",
            xp_label: "Selesai:",
            btn_best: "Mulai Tantangan Terbaik",
        }
    };

    const T = L[lang];

    const storedUsername = localStorage.getItem("username") || "Pengguna";
    document.getElementById("user-name-display").textContent = storedUsername;
    document.getElementById("user-xp-display").textContent = completedCount;
    document.getElementById("user-xp-max").textContent = TOTAL_CHALLENGES;
    document.getElementById("exp-fill").style.width = `${progressPercentage}%`;

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
    
    document.querySelectorAll(".challenge-box").forEach(box => {
        const cid = parseInt(box.dataset.id);
        const titleEl = box.querySelector(".cl-title");
        const tagEl = box.querySelector(".cl-tags");

        if (CHALLENGE_TEXT[lang][cid]) {
            titleEl.textContent = CHALLENGE_TEXT[lang][cid].title;
            tagEl.textContent = CHALLENGE_TEXT[lang][cid].tags;
        }
        
        const badge = box.querySelector(".completion-badge");
        if (badge) {
             if (completedChallenges.includes(cid)) {
                 badge.classList.remove("hidden");
             } else {
                 badge.classList.add("hidden");
             }
        }
    });
}

/* ============================================================
   FILTER CHALLENGES
============================================================ */
const radioButtons = document.querySelectorAll('input[name="difficulty"]');
const challengeBoxes = document.querySelectorAll('.challenge-box');

radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
        const v = radio.value;
        challengeBoxes.forEach(box => {
            if (v === 'all') box.style.display = "block";
            else box.style.display = box.classList.contains(v) ? "block" : "none";
        });
    });
});

/* ============================================================
   BUTTON ACTIONS (GO TO NEXT PAGE)
============================================================ */
document.getElementById("btn-best").onclick = () => {
    window.location.href = "gameplay.html";
};

document.querySelectorAll(".challenge-box").forEach(box => {
    box.addEventListener("click", () => {
        const id = parseInt(box.getAttribute("data-map"));
        localStorage.setItem("selectedMap", id);
        
        const requiredBlocks = CHALLENGE_TEXT[currentLanguage][id].blocks;
        localStorage.setItem("requiredBlocks", JSON.stringify(requiredBlocks));

        window.location.href = "gameplay.html";
    });
});