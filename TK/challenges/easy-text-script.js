/* =========================================
   CANVAS & TILEMAP ENGINE
========================================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ------------------------
// LOAD IMAGES
// ------------------------
// list tileset yang digunakan oleh map
let tilesets = [
  {
    firstgid: 1,
    image: "../Asset/Blind Hummingbird Tileset/blind_hummingbird_spritesheet_16x16.png",
    columns: 8
  },
  {
    firstgid: 33,
    image: "../Asset/Blind Hummingbird Tileset/forest_decoration_set_16x16.png",
    columns: 8
  }
];

// load semua images
tilesets.forEach(ts => {
  ts.img = new Image();
  ts.img.src = ts.image;
});

function getTilesetForGID(gid) {
  let selected = null;

  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) {
      return tilesets[i];
    }
  }
  return null;
}

function getRealGID(rawGid) {
  const FLIP_MASK = 0x1fffffff;
  return rawGid & FLIP_MASK;
}



// ------------------------
// TILE CONSTANTS
// ------------------------
const TILE_SIZE = 16;     // ukuran asli dalam sheet
const DRAW_SIZE = 24;     // ukuran di layar
const TILES_PER_ROW = 10; // sesuaikan tilesheet Anda

// ------------------------
// BEE STATE
// ------------------------
const bee = {
  x: 100,
  y: 100,
  frame: 0
};


// ------------------------
// CAMERA
// ------------------------
let cameraX = 0;
let cameraY = 0;


// ------------------------
// DRAW TILE FUNCTION
// ------------------------
function drawTileFromTileset(gid, worldX, worldY) {
  let realgid = getRealGID(gid);
  if (realgid === 0) return;

  let ts = getTilesetForGID(realgid);
  if (!ts) return;

  let localId = realgid - ts.firstgid;

  let sx = (localId % ts.columns) * TILE_SIZE;
  let sy = Math.floor(localId / ts.columns) * TILE_SIZE;

  ctx.drawImage(
    ts.img,
    sx, sy, TILE_SIZE, TILE_SIZE,
    worldX, worldY, DRAW_SIZE, DRAW_SIZE
  );
}

// ------------------------
// MAIN GAME LOOP
// ------------------------
let mapData = null;

async function loadMap() {
  const res = await fetch("../Asset/JSON/Background-easy-walk.json");
  mapData = await res.json();
  console.log("MAP LOADED", mapData);
}

loadMap().then(() => {
  canvas.width = mapData.width * DRAW_SIZE;
  canvas.height = mapData.height * DRAW_SIZE;

  ctx.imageSmoothingEnabled = false;
});


loadMap();

function renderTiledMap() {
  if (!mapData) return;

  for (let layer of mapData.layers) {
    if (layer.type !== "tilelayer") continue;

    const tiles = layer.data;

    for (let i = 0; i < tiles.length; i++) {
      let gid = tiles[i];
      if (gid === 0) continue;

      const x = (i % mapData.width) * DRAW_SIZE;
      const y = Math.floor(i / mapData.width) * DRAW_SIZE;

      drawTileFromTileset(gid, x, y);
    }
  }
}

function gameLoop() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update camera to follow bee
  //cameraX = bee.x - canvas.width / 2 + DRAW_SIZE / 2;
  //cameraY = bee.y - canvas.height / 2 + DRAW_SIZE / 2;

  renderTiledMap();  // ← map digambar di sini

  requestAnimationFrame(gameLoop);
}

gameLoop();

function previewTiles() {
  ctx.clearRect(0,0,800,600);
  let count = 0;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 10; x++) {
      const id = count;
      drawTile(id, x*34, y*34);
      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.fillText(id, x*34+2, y*34+12);
      count++;
    }
  }
}

/* =========================================
   STATE
========================================= */

let currentDrag = null;       // clone visual
let realBlock = null;         // block asli
let isFromWorkspace = false;
let originalSlotIndex = null;

let workspaceSlots = Array(10).fill(null);

let realBlockDetached = false;

/* =========================================
   SLOT HELPERS
========================================= */

function getWorkspaceSlots() {
  return [...document.querySelectorAll(".workspace-area .slot")];
}

function getSlotIndex(slot) {
  return getWorkspaceSlots().indexOf(slot);
}

function getOverlap(a, b) {
  const r1 = a.getBoundingClientRect();
  const r2 = b.getBoundingClientRect();

  const x_overlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
  const y_overlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
  const overlapArea = x_overlap * y_overlap;

  return overlapArea / (r1.width * r1.height);
}

function getBestSlot(block) {
  let best = null;
  let bestVal = 0;

  getWorkspaceSlots().forEach(slot => {
    let ov = getOverlap(block, slot);
    if (ov > bestVal && ov > 0.5) {
      bestVal = ov;
      best = slot;
    }
  });

  return best;
}

/* =========================================
   DRAG
========================================= */

function attachDragEventsToBlock(block) {
  block.onmousedown = (e) => {
    e.preventDefault();

    isFromWorkspace = block.closest(".workspace") !== null;

    if (isFromWorkspace) {
      originalSlotIndex = getSlotIndex(block.closest(".slot"));
    }

    realBlock = block;

    // CABUT BLOCK ASLI DARI DOM — FIX UTAMA
    if (block.parentElement) {
      block.parentElement.removeChild(block);
      realBlockDetached = true;
    }

    // buat clone visual
    let clone = block.cloneNode(true);
    clone.classList.add("drag-shadow");
    clone.style.position = "absolute";
    clone.style.zIndex = 9999;

    currentDrag = clone;
    document.body.appendChild(clone);

    clone.style.left = e.pageX + "px";
    clone.style.top = e.pageY + "px";

    window.onmousemove = drag;
    window.onmouseup = drop;
  };
}


function drag(e) {
  if (!currentDrag) return;

  currentDrag.style.left = (e.pageX - 35) + "px";
  currentDrag.style.top = (e.pageY - 35) + "px";

  highlightSlots(currentDrag);
}

function drop() {
  if (!currentDrag) return;

  let target = getBestSlot(currentDrag);

  document.body.classList.remove("dragging-dropitem");


  currentDrag.remove();
  currentDrag = null;

  if (target) {
    // Drop sukses
    let index = getSlotIndex(target);
    placeBlockIntoWorkspace(index, realBlock);
  } else {
    // Drop gagal — jangan masukkan block kembali!
    if (isFromWorkspace) {
      workspaceSlots[originalSlotIndex] = null;
      renderWorkspace();
    }
  }

  realBlockDetached = false;

  removeHighlight();
  window.onmousemove = null;
  window.onmouseup = null;
}


/* =========================================
   HIGHLIGHT
========================================= */

function highlightSlots(block) {
  removeHighlight();

  getWorkspaceSlots().forEach(slot => {
    if (getOverlap(block, slot) > 0.5) slot.classList.add("highlight");
  });
}

function removeHighlight() {
  getWorkspaceSlots().forEach(slot => slot.classList.remove("highlight"));
}


/* =========================================
   WORKSPACE
========================================= */

function placeBlockIntoWorkspace(index, block) {
  if (isFromWorkspace) {
    workspaceSlots[originalSlotIndex] = null;
  }

  workspaceSlots[index] = block;
  renderWorkspace();
}


function renderWorkspace() {
  let slots = getWorkspaceSlots();

  slots.forEach((slot, i) => {
    slot.innerHTML = "";

    let b = workspaceSlots[i];
    if (b) {
      slot.appendChild(b);
      attachDragEventsToBlock(b);
    }
  });
}

/* =========================================
   DROPUP BUTTONS
========================================= */

document.getElementById("btn-bicara").onclick = () => {
  let d = document.getElementById("dropup-bicara");
  d.style.display = d.style.display === "flex" ? "none" : "flex";
  document.getElementById("dropup-jalan").style.display = "none";
};

document.getElementById("btn-jalan").onclick = () => {
  let d = document.getElementById("dropup-jalan");
  d.style.display = d.style.display === "flex" ? "none" : "flex";
  document.getElementById("dropup-bicara").style.display = "none";
};


/* =========================================
   DRAG FROM DROPUP
========================================= */

document.querySelectorAll(".drop-item").forEach(item => {
  item.onmousedown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    document.body.classList.add("dragging-dropitem");

    // 1. BUAT BLOCK ASLI (TAPI JANGAN DITAMPILKAN!)
    let block = document.createElement("div");
    block.className = "block";

    let type = item.getAttribute("data-type");

    if (type === "bicara") {
      let t = item.getAttribute("data-text");
      block.innerText = "🗣️ " + t;
      block.setAttribute("data-type", "bicara");
      block.setAttribute("data-text", t);
    }

    if (type === "jalan") {
      let dir = item.getAttribute("data-dir");
      let arrow = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
      block.innerText = `${arrow} Jalan`;
      block.setAttribute("data-type", "jalan");
      block.setAttribute("data-direction", dir);
    }

    // Simpan block asli untuk nanti di-drop
    realBlock = block;
    isFromWorkspace = false;

    // 2. BUAT CLONE DRAG VISUAL
    let clone = block.cloneNode(true);
    clone.classList.add("drag-shadow");
    clone.style.position = "absolute";
    clone.style.zIndex = 9999;

    currentDrag = clone;
    document.body.appendChild(clone);

    clone.style.left = e.pageX + "px";
    clone.style.top = e.pageY + "px";

    // 3. MULAI DRAG
    window.onmousemove = drag;
    window.onmouseup = drop;
  };
});

/* =========================================
   RUN
========================================= */

document.getElementById("btn-run").onclick = () => {
  let seq = [];

  workspaceSlots.forEach(b => {
    if (!b) return;

    let t = b.getAttribute("data-type");

    if (t === "bicara") seq.push("Bicara: " + b.getAttribute("data-text"));
    if (t === "jalan") seq.push("Jalan (" + b.getAttribute("data-direction") + ")");
  });

  if (seq.length === 0) {
    alert("Workspace kosong.");
    return;
  }

  alert(seq.join(" -> "));
};


