let currentLang = "en";

const languagePack = {
    en: {
        title: "GO TO THE FLOWER!",
        back: "⮌ Back",
        run: "▶ RUN",
        resetManual: "Restart?",
        blocksTitle: "Blocks",
        workspaceTitle: "Workspace",
        winTitle: "🎉 YOU WIN! 🎉",
        winBack: "⮌ Back",
        reset: "↺ Clear"
    },
    id: {
        title: "PERGI KE BUNGA!",
        back: "⮌ Kembali",
        run: "▶ Jalan",
        resetManual: "Ulangi?",
        blocksTitle: "Blok",
        workspaceTitle: "Area Kerja",
        winTitle: "🎉 KAMU MENANG! 🎉",
        winBack: "⮌ Kembali",
        reset: "↺ Hapus"
    }
};

function applyLanguage(lang) {
    currentLang = lang;

    const L = languagePack[lang];

    document.querySelector(".title").innerText = L.title;
    document.getElementById("btn-back").innerText = L.back;
    document.getElementById("btn-run").innerText = L.run;
    document.getElementById("btn-reset-manual").innerText = L.resetManual;
    document.getElementById("title-blocks").innerText = L.blocksTitle;
    document.getElementById("title-workspace").innerText = L.workspaceTitle;

    document.querySelector(".win-title").innerText = L.winTitle;
    document.getElementById("btn-kembali-win").innerText = L.winBack;

    document.getElementById("btn-reset-workspace").innerText = L.reset;
}

function getLocalizedBlockText(type, dir = null) {
    if (type === "tembak") return "🔫";
    if (type === "jalan") {
        const arrow = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
        return arrow;
    }
}
