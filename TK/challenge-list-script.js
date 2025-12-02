
const CHALLENGE_TEXT = {
    id: [
        { title: "Lebah Pertamamu!", tags: "[mudah] [movement]" },
        { title: "Langkah Pertama", tags: "[mudah] [movement]" },
        { title: "Panah Arah", tags: "[mudah] [navigation]" },
        { title: "Belok Kanan", tags: "[sedang] [movement]" },
        { title: "Belok Kiri", tags: "[sedang] [movement]" },
        { title: "Jalan Lurus Jauh", tags: "[sedang] [route]" },
        { title: "Rute Zig-Zag", tags: "[sulit] [path]" },
        { title: "Hindari Dua Kupu-kupu", tags: "[sulit] [enemy]" },
        { title: "Rute Panjang & Musuh", tags: "[sulit] [enemy] [path]" },
        { title: "Labirin Mini Lebah", tags: "[sulit] [logic]" }
    ],

    en: [
        { title: "Your First Bee!", tags: "[easy] [movement]" },
        { title: "First Steps", tags: "[easy] [movement]" },
        { title: "Direction Arrows", tags: "[easy] [navigation]" },
        { title: "Turn Right", tags: "[medium] [movement]" },
        { title: "Turn Left", tags: "[medium] [movement]" },
        { title: "Long Straight Path", tags: "[medium] [route]" },
        { title: "Zig-Zag Route", tags: "[hard] [path]" },
        { title: "Avoid Two Butterflies", tags: "[hard] [enemy]" },
        { title: "Long Route & Enemy", tags: "[hard] [enemy] [path]" },
        { title: "Mini Bee Maze", tags: "[hard] [logic]" }
    ]
};

/* ============================================================
   CLOCK (DIGITAL CLOCK WITH ANIMATION)
============================================================ */

function updateClock() {
  const now = new Date();

  const hour = now.getHours().toString().padStart(2, "0");
  const minute = now.getMinutes().toString().padStart(2, "0");

  const hourEl = document.getElementById("clock-hour");
  const minEl = document.getElementById("clock-minute");

  // Jika berubah → animasi slide + fade
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
   — sinkron dengan login page (localStorage)
============================================================ */

let currentLanguage = localStorage.getItem("lang") || "id";
const langBtn = document.getElementById("lang-toggle-btn");

// initial load
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
   APPLY LANGUAGE STRINGS
============================================================ */

function applyLanguage(lang) {

    const L = {
        en: {
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
        },

        id: {
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
        }
    };

    const T = L[lang];

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
    
    document.querySelectorAll(".challenge-box").forEach(box => {
        const cid = parseInt(box.dataset.id);
        const titleEl = box.querySelector(".cl-title");
        const tagEl = box.querySelector(".cl-tags");

        if (CHALLENGE_TEXT[lang][cid]) {
            titleEl.textContent = CHALLENGE_TEXT[lang][cid].title;
            tagEl.textContent = CHALLENGE_TEXT[lang][cid].tags;
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
  window.location.href = "challenges/gameplay.html";
};

document.querySelectorAll(".challenge-box").forEach(box => {
    box.addEventListener("click", () => {
        const id = parseInt(box.getAttribute("data-map"));
        localStorage.setItem("selectedMap", id);

        window.location.href = "challenges/gameplay.html";
    });
});