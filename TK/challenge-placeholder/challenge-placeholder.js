  /* ============================================================
    VARIABLE UTAMA
  ============================================================ */

  let currentDrag = null;
  let isFromWorkspace = false;
  let originalSlotIndex = null;

  let workspaceSlots = Array(10).fill(null);


  /* ============================================================
    PASANG EVENT LISTENER KE SEMUA BLOCK (DINAMIS)
  ============================================================ */

  function attachDragEventsToBlock(block) {

    block.onmousedown = (e) => {
      startDrag(e, block);
    };
  }

  // Pasang ke semua block awal di toolbar
  document.querySelectorAll('.block').forEach(attachDragEventsToBlock);
  addRepeatButtonToToolbar();


  /* ============================================================
    START DRAG
  ============================================================ */

  function startDrag(e, block) {

    isFromWorkspace = block.closest(".workspace .slot") !== null;

    if (isFromWorkspace) {
      originalSlotIndex = getSlotIndex(block.closest(".slot"));
    }

    let clone = block.cloneNode(true);
    // Hapus tombol editor dari clone (tidak muncul saat drag)
    let btn = clone.querySelector(".repeat-edit-btn");
    if (btn) btn.remove();

    attachDragEventsToBlock(clone);

    clone.classList.add("dragging");
    clone.style.position = "absolute";
    clone.style.left = e.pageX + "px";
    clone.style.top = e.pageY + "px";

    document.body.appendChild(clone);
    currentDrag = clone;

    window.onmousemove = drag;
    window.onmouseup = drop;
  }


  /* ============================================================
    DRAGGING
  ============================================================ */

  function drag(e) {
    
    if (!currentDrag) return;

    currentDrag.style.left = (e.pageX - 50) + "px";
    currentDrag.style.top = (e.pageY - 20) + "px";

    highlightSlots(currentDrag);
    previewSlotShift(currentDrag);
  }


  /* ============================================================
    DROP LOGIC
  ============================================================ */

  function drop() {
    if (!currentDrag) return;

    let targetSlot = getBestSlot(currentDrag);

    if (targetSlot) {
      if (targetSlot.classList.contains("repeat-inner-slot")) {
          // drop ke repeat popup
          targetSlot.innerHTML = "";
          currentDrag.classList.remove("dragging");
          currentDrag.style.position = "relative";
          currentDrag.style.left = "0";
          currentDrag.style.top = "0";
          targetSlot.appendChild(currentDrag);
      }
      else {
          // drop ke workspace
          let index = getSlotIndex(targetSlot);
          placeBlockIntoWorkspace(index, currentDrag);
      }
    }
    else {
      if (isFromWorkspace) removeBlockAt(originalSlotIndex);
      currentDrag.remove();
    }

    clearAllPreview();
    removeHighlight();
    currentDrag = null;

    window.onmousemove = null;
    window.onmouseup = null;
  }


  /* ============================================================
    MASUKKAN BLOCK KE WORKSPACE
  ============================================================ */

  function placeBlockIntoWorkspace(index, block) {

    // Ambil semua index slot workspace yang terisi
    let filled = workspaceSlots.filter(b => b !== null).length;

    // RULE 1 — Jika workspace kosong, taruh di index 0
    if (filled === 0) {
      workspaceSlots[0] = block;
      renderWorkspace();
      return;
    }

    // Jika block berasal dari workspace, hapus dulu
    if (isFromWorkspace) {
      workspaceSlots.splice(originalSlotIndex, 1);
      workspaceSlots.push(null);

      // Koreksi index drop jika block diambil dari atas
    }

    // RULE 2 — jika target slot lebih besar dari jumlah block terisi
    // contoh: A,B, kosong, kosong ... lalu drop di slot 8
    // Maka index drop = jumlah block terisi
    if (index > filled) {
      index = filled;
    }

    // Sisipkan block
    workspaceSlots.splice(index, 0, block);

    // Jaga panjang array tetap 10
    workspaceSlots = workspaceSlots.slice(0, 10);

    // Isi slot sisanya dengan null
    while (workspaceSlots.length < 10) workspaceSlots.push(null);

    renderWorkspace();
  }




  /* ============================================================
    REMOVE BLOCK
  ============================================================ */

  function removeBlockAt(index) {
    workspaceSlots.splice(index, 1);
    workspaceSlots.push(null);
    renderWorkspace();
  }

  /* ============================================================
    RENDER WORKSPACE
  ============================================================ */

  function renderWorkspace() {
    const slots = getWorkspaceSlots();

    slots.forEach((slot, i) => {
      slot.innerHTML = "";
      let block = workspaceSlots[i];

      if (block) {
        block.classList.remove("dragging");
        block.style.position = "relative";
        block.style.left = "0";
        block.style.top = "0";
        slot.appendChild(block);

        attachDragEventsToBlock(block); 

      // Jika block adalah jalan → tambahkan tombol setting
        if (block.getAttribute("data-type") === "jalan") {
          addDirectionButton(block);
        }
        if (block.getAttribute("data-type") === "repeat") {
          addRepeatButton(block);
        }

      }
    });
  }



  /* ============================================================
    SLOT HELPERS
  ============================================================ */

  function getAllSlots() {
    return [
      ...document.querySelectorAll(".workspace .slot"),
      ...document.querySelectorAll(".repeat-inner-slot.slot")
    ];
  }


  function getWorkspaceSlots() {
    return [...document.querySelectorAll(".workspace .slot")];
  }

  function getSlotIndex(slot) {
    const all = getWorkspaceSlots();
    return all.indexOf(slot);
  }


  /* ============================================================
    SLOT HIGHLIGHT
  ============================================================ */

  function highlightSlots(block) {
    removeHighlight();

    getAllSlots().forEach(slot => {
      if (getOverlap(block, slot) > 0.5) {
        slot.classList.add("highlight");
      }
    });
  }

  function removeHighlight() {
    getAllSlots().forEach(s => s.classList.remove('highlight'));
  }


  /* ============================================================
    PREVIEW SHIFT
  ============================================================ */

  function previewSlotShift(block) {
    clearAllPreview();

    let bestSlot = getBestSlot(block);
    if (!bestSlot) return;

    let index = getSlotIndex(bestSlot);
    let slots = getWorkspaceSlots();

    for (let i = index; i < slots.length; i++) {
      slots[i].classList.add("preview");
    }
  }

  function clearAllPreview() {
    getWorkspaceSlots().forEach(s => s.classList.remove("preview"));
  }


  /* ============================================================
    HITUNG OVERLAP
  ============================================================ */

  function getOverlap(a, b) {
    const r1 = a.getBoundingClientRect();
    const r2 = b.getBoundingClientRect();

    const x_overlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const y_overlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    const overlapArea = x_overlap * y_overlap;

    const blockArea = r1.width * r1.height;
    return overlapArea / blockArea;
  }


  /* ============================================================
    SLOT TERBAIK (OVERLAP > 50%)
  ============================================================ */

  function getBestSlot(block) {
    let best = null;
    let bestVal = 0;

    getAllSlots().forEach(slot => {       // ← pakai SEMUA slot
      let ov = getOverlap(block, slot);

      if (ov > 0.5 && ov > bestVal) {
        bestVal = ov;
        best = slot;
      }
    });

    return best;
  }


  /* ============================================================
    DROPDOWN JALAN
  ============================================================ */

  function toggleDropdown(id) {
    let menu = document.getElementById(id);
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  }

  /* ============================================================
    RUN BUTTON — BACA WORKSPACE DARI ATAS KE BAWAH
  ============================================================ */

document.getElementById("btn-run").onclick = () => {

  let sequence = [];

  workspaceSlots.forEach(block => {
    if (!block) return;

    let type = block.getAttribute("data-type");

    if (type === "jalan") {
      let direction = block.getAttribute("data-direction") || "up";
      sequence.push(`Jalan (${direction})`);
    }
    else if (type === "if") {
      sequence.push("If / Else");
    }
    else if (type === "repeat") {
      sequence.push("Repeat");
    }
    else if (type === "function") {
      sequence.push("Function");
    }
  });

  if (sequence.length === 0) {
    alert("Tidak ada kode di workspace.");
    return;
  }

  alert(sequence.join(" → "));
};


function addDirectionButton(block) {
  // Cegah duplikasi tombol
  if (block.querySelector(".dir-btn")) return;

  let btn = document.createElement("button");
  btn.className = "dir-btn";
  btn.innerText = "⚙️";

  let dropdown = document.createElement("div");
  dropdown.className = "dir-dropdown";

  dropdown.innerHTML = `
    <div class="dir-item" data-dir="up">🡱 Atas</div>
    <div class="dir-item" data-dir="right">🡲 Kanan</div>
    <div class="dir-item" data-dir="left">🡸 Kiri</div>
    <div class="dir-item" data-dir="down">🡳 Bawah</div>
  `;

  /* ============================================
     STOP EVENT DRAG SAAT KLIK TOMBOL / DROPDOWN
     ============================================ */
  function stop(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  btn.addEventListener("mousedown", stop);
  btn.addEventListener("click", stop);
  btn.addEventListener("mouseup", stop);
  btn.addEventListener("mousemove", stop);

  dropdown.addEventListener("mousedown", stop);
  dropdown.addEventListener("click", stop);
  dropdown.addEventListener("mouseup", stop);
  dropdown.addEventListener("mousemove", stop);

  /* ============================================
     KLIK TOMBOL → BUKA / TUTUP DROPDOWN
     ============================================ */
  btn.onclick = () => {
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  };

  /* ============================================
     PILIH SALAH SATU ARAH
     ============================================ */
  dropdown.querySelectorAll(".dir-item").forEach(item => {
    item.onclick = (e) => {
      stop(e);

      let dir = item.getAttribute("data-dir");
      let arrow = {
        up: "🡱",
        right: "🡲",
        left: "🡸",
        down: "🡳"
      }[dir];

      block.setAttribute("data-direction", dir);
      block.innerHTML = `${arrow} Jalan`;

      // Pasang ulang tombol & dropdown
      block.appendChild(btn);
      block.appendChild(dropdown);

      dropdown.style.display = "none";
    };
  });

  /* ============================================
     PASANG KE BLOCK
     ============================================ */
  block.style.position = "relative";
  block.appendChild(btn);
  block.appendChild(dropdown);
}

function addRepeatButton(block) {
  if (block.querySelector(".repeat-edit-btn")) return;

  let btn = document.createElement("div");
  btn.className = "repeat-edit-btn";
  btn.innerHTML = "⚙️";

  btn.style.position = "absolute";
  btn.style.top = "-8px";
  btn.style.right = "-8px";
  btn.style.width = "20px";
  btn.style.height = "20px";
  btn.style.background = "#ffcc00";
  btn.style.borderRadius = "50%";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.fontSize = "12px";
  btn.style.cursor = "pointer";
  btn.style.zIndex = "1000";

  btn.onclick = () => openRepeatEditor(block);

  block.appendChild(btn);
}

let currentRepeatBlock = null;
let repeatData = new WeakMap(); // Simpan data repeat

function openRepeatEditor(block) {
  currentRepeatBlock = block;

  if (!repeatData.has(block)) {
    repeatData.set(block, {
      slots: [null, null],
      count: 1
    });
  }

  let data = repeatData.get(block);

  // Reset editor UI
  document.getElementById("repeat-count").value = data.count;

  document.querySelectorAll(".repeat-inner-slot").forEach((slot, i) => {
    slot.innerHTML = "";
    if (data.slots[i]) {
      slot.appendChild(data.slots[i]);
    }
  });

  document.getElementById("repeat-editor").classList.remove("hidden");
}

document.getElementById("repeat-close").onclick = () => {
  document.getElementById("repeat-editor").classList.add("hidden");
};

document.getElementById("save-repeat").onclick = () => {
  let data = repeatData.get(currentRepeatBlock);

  data.count = parseInt(document.getElementById("repeat-count").value);

  // Ambil isi popup slots
  document.querySelectorAll(".repeat-inner-slot").forEach((slot, i) => {
    data.slots[i] = slot.children[0] || null;
  });

  document.getElementById("repeat-editor").classList.add("hidden");
};

function addRepeatButtonToToolbar() {
  document.querySelectorAll('.block-repeat').forEach(block => {
    if (block.querySelector('.repeat-edit-btn')) return;

    let btn = document.createElement("div");
    btn.className = "repeat-edit-btn";
    btn.innerHTML = "⚙️";

    btn.style.position = "absolute";
    btn.style.top = "-10px";
    btn.style.right = "-10px";
    btn.style.width = "22px";
    btn.style.height = "22px";
    btn.style.background = "#ffcc00";
    btn.style.borderRadius = "50%";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.zIndex = "100";

    btn.onclick = (e) => {
      e.stopPropagation();
      openRepeatEditor(block);
    };

    block.appendChild(btn);
  });
}
