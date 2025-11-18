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

function updateLangButton() {
  langBtn.textContent = (currentLanguage === "id") ? "IND" : "ENG";
}

/* ============================================================
   APPLY LANGUAGE STRINGS
============================================================ */

function applyLanguage(lang) {

  if (lang === "id") {
    document.getElementById("challenge-subtitle").textContent = "Pilih tantangan coding yang sesuai tingkat kemampuanmu.";
    document.getElementById("progress-title").textContent = "Progresmu!";
    document.getElementById("user-label").textContent = "Pengguna:";
    document.getElementById("xp-label").textContent = "XP:";
    document.getElementById("btn-best-text").textContent = "Mulai Tantangan Terbaik";
    document.getElementById("challenge-title").textContent = "Tantangan";

    document.getElementById("filter-text").textContent = "Filter Kesulitan";
    document.getElementById("filter-all").textContent = "Semua";
    document.getElementById("filter-easy").textContent = "Mudah";
    document.getElementById("filter-medium").textContent = "Sedang";
    document.getElementById("filter-hard").textContent = "Sulit";

    // Nama Tantangan
    document.querySelector(".cl-1-title").textContent = "Mulailah Berbicara!";
    document.querySelector(".cl-2-title").textContent = "Gerakkan Karakter";
    document.querySelector(".cl-3-title").textContent = "Loop Warna-warni";
    document.querySelector(".cl-4-title").textContent = "Menebak Angka";

    // Tags
    document.querySelector(".cl-1-tags").textContent = "[mudah] [printing]";
    document.querySelector(".cl-2-tags").textContent = "[mudah] [movement]";
    document.querySelector(".cl-3-tags").textContent = "[sedang] [loop]";
    document.querySelector(".cl-4-tags").textContent = "[sulit] [if/else]";

  } else {
    document.getElementById("challenge-subtitle").textContent ="Choose a coding challenge that matches your skill level.";

    // Challenge Names
    document.querySelector(".cl-1-title").textContent = "Start Speaking!";
    document.querySelector(".cl-2-title").textContent = "Move the Character";
    document.querySelector(".cl-3-title").textContent = "Colorful Loop";
    document.querySelector(".cl-4-title").textContent = "Number Guessing";

    // Tags
    document.querySelector(".cl-1-tags").textContent = "[easy] [printing]";
    document.querySelector(".cl-2-tags").textContent = "[easy] [movement]";
    document.querySelector(".cl-3-tags").textContent = "[medium] [loop]";
    document.querySelector(".cl-4-tags").textContent = "[hard] [if/else]";

    document.getElementById("progress-title").textContent = "Your Progress!";
    document.getElementById("user-label").textContent = "User:";
    document.getElementById("xp-label").textContent = "XP:";
    document.getElementById("btn-best-text").textContent = "Start Best Challenge";
    document.getElementById("challenge-title").textContent = "Challenges";

    document.getElementById("filter-text").textContent = "Difficulty Filter";
    document.getElementById("filter-all").textContent = "All";
    document.getElementById("filter-easy").textContent = "Easy";
    document.getElementById("filter-medium").textContent = "Medium";
    document.getElementById("filter-hard").textContent = "Hard";
  }
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
   BEST CHALLENGE BUTTON
============================================================ */

document.getElementById("btn-best").onclick = () => {
  window.location.href = "challenge-placeholder/challenge-placeholder.html";
};

/* ============================================================
   BUTTON ACTIONS (GO TO NEXT PAGE)
============================================================ */

document.getElementById("btn-best").onclick = () => {
  window.location.href = "challenges/easy-text.html";
};

document.querySelector(".cl-1-title").parentElement.onclick = () => {
  window.location.href = "challenges/easy-text.html";
};
