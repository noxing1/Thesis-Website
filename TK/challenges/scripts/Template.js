/* =========================================
   CANVAS & TILEMAP ENGINE
========================================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let commandQueue = [];
let isRunningCommands = false;
let hasDied = false;

let projectiles = [];

const BEE_SCALE = 0.9;

let lastTime = 0;

let cam = {
  x: 0,
  y: 0,
  zoom: 1.5,   // <<--- ini angka yang nanti bisa tuan ubah
  targetX: 0,
  targetY: 0,
  targetZoom: 1.5,
  speed: 0.02, // linear movement speed
  lockOnBee: true
};

const MAP_LIST = [
    "../Asset/Sprites/Maps/01.json",
    "../Asset/Sprites/Maps/02.json",
    "../Asset/Sprites/Maps/03.json",
    "../Asset/Sprites/Maps/04.json",
    "../Asset/Sprites/Maps/05.json",
    "../Asset/Sprites/Maps/06.json",
    "../Asset/Sprites/Maps/07.json",
    "../Asset/Sprites/Maps/08.json",
    "../Asset/Sprites/Maps/09.json",
    "../Asset/Sprites/Maps/10.json"
];

// ===========================================
//  LOAD SELECTED MAP INDEX FROM LOCALSTORAGE
// ===========================================
let selectedMap = parseInt(localStorage.getItem("selectedMap") || "0");

// Safety clamp: pastikan tidak out-of-range
if (selectedMap < 0 || selectedMap >= MAP_LIST.length) {
    selectedMap = 0;
}

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

/* =========================================
   BEE ANIMATION SYSTEM
========================================= */

const bee = {
  x: 100,
  y: 100,
  state: "idle",
  frame: 0,
  timer: 0,
  speed: 2,
  facing: "right"   // default: hadap kanan
};

let beeAnimations = {
  idle: null,
  walk: null,
  death: null,
  shoot: null
};

/* Load 1 anim */
async function loadProjectile() {
  const json = await fetch(`../Asset/Sprites/projectile.json`).then(r => r.json());

  const img = new Image();
  img.src = `../Asset/Sprites/projectile.png`;

  return {
    img: img,
    fw: json.frameWidth,
    fh: json.frameHeight,
    frames: json.frames
  };
}

let projectileAnim = null;

loadProjectile().then(anim => projectileAnim = anim);

function findBeeSpawn() {
  if (!mapData || !beeAnimations.idle) return;

  const scale = DRAW_SIZE / TILE_SIZE; // 24/16 = 1.5

  for (let layer of mapData.layers) {
    if (layer.type === "objectgroup" && layer.name === "Spawn") {
      for (let obj of layer.objects) {
        if (obj.name === "BeeSpawn") {

          const anim = beeAnimations.idle;
          const fw = anim.fw;
          const fh = anim.fh;

          // Convert Tiled coords → canvas coords
          const ox = obj.x * scale;
          const oy = obj.y * scale;

          // Tiled object = TOP-LEFT
          bee.x = ox - (fw * BEE_SCALE) / 2;  
          bee.y = oy - (fh * BEE_SCALE) / 2;


          bee.facing = "right";
          hasDied = false;

          console.log("Spawn FIXED:", bee.x, bee.y);
          return;
        }
      }
    }
  }
}

const butterflyColors = ["Blue", "Grey", "Pink", "Red", "White", "Yellow"];
let butterflyAnimations = [];
let enemies = [];

// Load semua warna kupu-kupu
async function loadButterflies() {
    let list = [];

    for (let color of butterflyColors) {
        try {
            const json = await fetch(`../Asset/Sprites/Butterfly${color}.json`).then(r => r.json());

            const img = new Image();
            img.src = `../Asset/Sprites/Butterfly${color}.png`;
            await img.decode();

            list.push({
                img: img,
                fw: json.frameWidth,
                fh: json.frameHeight,
                frames: json.frames
            });
        } catch (err) {
            console.warn("Butterfly JSON not found:", color);
        }
    }

    butterflyAnimations = list;
}

async function loadAnim(name) {
  const json = await fetch(`../Asset/Sprites/${name}.json`).then(r => r.json());

  const img = new Image();
  img.src = `../Asset/Sprites/${name}.png`;
  await img.decode();

  return {
    img: img,
    fw: json.frameWidth,
    fh: json.frameHeight,
    frames: json.frames
  };
}

/* Load all anims */
async function loadBee() {
  beeAnimations.idle  = await loadAnim("normal");
  beeAnimations.walk  = await loadAnim("normal");  // pakai anim sama
  beeAnimations.death = await loadAnim("death");
  beeAnimations.shoot = await loadAnim("shoot");
}

loadBee();

function moveBeeOnce(dir, callback) {
  const step = 24;
  let moved = 0;

  bee.state = "walk";

  if (dir === "left") bee.facing = "left";
  if (dir === "right") bee.facing = "right";

  let dx = 0, dy = 0;

  if (dir === "left") dx = -1;
  if (dir === "right") dx = 1;
  if (dir === "up") dy = -1;
  if (dir === "down") dy = 1;

  function tick() {
      if (hasDied) {
          bee.state = "death";
          return; // hentikan gerakan total
      }

      const s = 1;
      bee.x += dx * s;
      bee.y += dy * s;
      moved += s;

      if (moved >= step) {
        bee.state = "idle";
        callback();
        return;
      }

      requestAnimationFrame(tick);
  }


  tick();
}

// ------------------------
// CAMERA
// ------------------------
let cameraX = 0;
let cameraY = 0;


// ------------------------
// DRAW TILE FUNCTION
// ------------------------
function drawTileFromTileset(gid, worldX, worldY) {
  if (gid === 0) {
    // tetap gambar grid untuk tile kosong
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(worldX, worldY, DRAW_SIZE, DRAW_SIZE);
    return;
  }

  const FLIPPED_H = 0x80000000;   // horizontal
  const FLIPPED_V = 0x40000000;   // vertical
  const FLIPPED_D = 0x20000000;   // diagonal

  const flippedH = (gid & FLIPPED_H) !== 0;
  const flippedV = (gid & FLIPPED_V) !== 0;
  const flippedD = (gid & FLIPPED_D) !== 0;

  const realgid = gid & 0x1FFFFFFF;

  let ts = getTilesetForGID(realgid);
  if (!ts) return;

  let localId = realgid - ts.firstgid;

  let sx = (localId % ts.columns) * TILE_SIZE;
  let sy = Math.floor(localId / ts.columns) * TILE_SIZE;

  ctx.save();
  ctx.translate(worldX, worldY);

  // apply flips
  if (flippedH) {
    ctx.translate(DRAW_SIZE, 0);
    ctx.scale(-1, 1);
  }

  if (flippedV) {
    ctx.translate(0, DRAW_SIZE);
    ctx.scale(1, -1);
  }

  if (flippedD) {
    ctx.translate(DRAW_SIZE, 0);
    ctx.rotate(Math.PI / 2);
  }

  ctx.drawImage(
    ts.img,
    sx, sy, TILE_SIZE, TILE_SIZE,
    0, 0, DRAW_SIZE, DRAW_SIZE
  );

  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(worldX, worldY, DRAW_SIZE, DRAW_SIZE);
}

// ------------------------
// MAIN GAME LOOP
// ------------------------
let mapData = null;

async function loadMap(index = 0) {
    const res = await fetch(MAP_LIST[index]);
    mapData = await res.json();
    console.log("MAP LOADED:", MAP_LIST[index]);
}

function loadEnemySpawn() {
    if (!mapData || butterflyAnimations.length === 0) return;

    const scale = DRAW_SIZE / TILE_SIZE;

    for (let layer of mapData.layers) {
        if (layer.type === "objectgroup" && layer.name === "Enemy") {

            for (let obj of layer.objects) {

                const bx = obj.x * scale;
                const by = obj.y * scale;

                const colorIndex = Math.floor(Math.random() * butterflyAnimations.length);

                enemies.push({
                    x: bx,
                    y: by,
                    baseY: by,
                    frame: 0,
                    timer: 0,
                    floatTimer: 0,
                    color: colorIndex,
                    dying: false,
                    alpha: 1,
                    scale: 1,
                    puff: 0
                });
            }
        }
    }
}


function updateEnemies(dt) {

    enemies.forEach(e => {

        if (!e.dying) {
            // idle flapping (sedikit naik turun)
            e.y += Math.sin(Date.now() / 150) * 0.1;

            // animasi frame
            e.timer += dt;
            if (e.timer > 120) {
                e.timer = 0;
                const anim = butterflyAnimations[e.color];
                e.frame = (e.frame + 1) % anim.frames;
            }

            return;
        }

        // ====================
        // PIXEL-PUFF EFFECT
        // ====================
        e.alpha -= 0.08;
        e.scale += 0.05;
        e.puff += 0.04;

        if (e.alpha <= 0) {
            e.remove = true;
        }
    });

    enemies = enemies.filter(e => !e.remove);
}

function drawEnemies() {
    enemies.forEach(e => {
        const anim = butterflyAnimations[e.color];
        if (!anim) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, e.alpha);

        ctx.translate(e.x, e.y);
        ctx.scale(e.scale, e.scale);

        // puff = blur kecil
        if (e.puff > 0) {
            ctx.filter = `blur(${e.puff}px)`;
        }

        ctx.drawImage(
            anim.img,
            anim.fw * e.frame, 0,
            anim.fw, anim.fh,
            -anim.fw / 2, -anim.fh / 2,
            anim.fw, anim.fh
        );

        ctx.restore();
    });
}

function checkProjectileHitEnemy(p) {

    for (let e of enemies) {
        const anim = butterflyAnimations[e.color];
        const bw = anim.fw * e.scale;
        const bh = anim.fh * e.scale;

        const dx = p.x - e.x;
        const dy = p.y - e.y;

        if (Math.abs(dx) < bw/2 && Math.abs(dy) < bh/2) {
            e.dying = true;
            p.remove = true;
            return;
        }
    }
}

Promise.all([
    loadMap(selectedMap),
    loadBee(),
    loadButterflies()
]).then(() => {

    // 🔍 Cek apakah map memiliki musuh
    const hasEnemyLayer = mapData.layers.some(
        layer => layer.type === "objectgroup" && layer.name === "Enemy"
    );

    // 🔫 Hide/Show tombol tembak
    const btnShoot = document.getElementById("btn-tembak");
    if (hasEnemyLayer) {
        btnShoot.style.display = "flex";
    } else {
        btnShoot.style.display = "none";
    }


    // pastikan semua anim lengkap dulu sebelum spawn musuh
    loadEnemySpawn();  

    canvas.width = mapData.width * DRAW_SIZE;
    canvas.height = mapData.height * DRAW_SIZE;

    ctx.imageSmoothingEnabled = false;

    findBeeSpawn();
    requestAnimationFrame(gameLoop); // <--- lebih aman
});

function renderTiledMap() {
  if (!mapData) return;

  for (let layer of mapData.layers) {
    if (layer.type !== "tilelayer") continue;

    const tiles = layer.data;

    for (let i = 0; i < tiles.length; i++) {

      const gid = tiles[i];

      // Hitung koordinat dulu
      const x = (i % mapData.width) * DRAW_SIZE;
      const y = Math.floor(i / mapData.width) * DRAW_SIZE;

      if (gid === 0) {
          drawTileFromTileset(0, x, y);
          continue;
      }


      drawTileFromTileset(gid, x, y);
    }
  }
}

function updateBee(dt) {
  const anim = beeAnimations[bee.state];
  if (!anim) return;

  bee.timer += dt;

  // Stop death animation completely at last frame
  if (bee.state === "death" && bee.frame === anim.frames - 1) {
    return;
  }

  if (bee.timer > 120) {
    bee.timer = 0;
    bee.frame = (bee.frame + 1) % anim.frames;

    if (bee.state === "death" && bee.frame === anim.frames - 1) {
      // Lock final frame and stop anim forever
      return;
    }
  }
}

function drawBee() {
  const anim = beeAnimations[bee.state];
  if (!anim) return;

  const sx = bee.frame * anim.fw;
  const sy = 0;

  const scale = BEE_SCALE;

  const w = anim.fw * scale;
  const h = anim.fh * scale;

  ctx.save();

  // Geser ke tengah lebah
  ctx.translate(bee.x + w / 2, bee.y + h / 2);

  // Jika menghadap kiri → flip horizontal
  if (bee.facing === "right") {
    ctx.scale(-1, 1); // flip karena sprite asli menghadap kiri
  }


  // Gambar dari center
  ctx.drawImage(
    anim.img,
    sx, sy, anim.fw, anim.fh,
    -w / 2, -h / 2,
    w, h
  );

  ctx.restore();
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;

    let dt = timestamp - lastTime;
    lastTime = timestamp;

    // NORMALISASI dt
    dt = Math.min(dt, 40);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateCamera();

    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    renderTiledMap();
    updateBee(dt);
    drawBee();
    updateProjectiles(dt);
    drawProjectiles();
    updateEnemies(dt);
    drawEnemies();

    ctx.restore();

    checkWinLose();
    requestAnimationFrame(gameLoop);
}

function checkWinLose() {
  if (!mapData) return;

  // ukuran lebah
  const base = beeAnimations.idle;
  const w = base.fw * BEE_SCALE;
  const h = base.fh * BEE_SCALE;

  const cx = bee.x + w / 2;
  const cy = bee.y + h / 2;

  // WIN
  const flower = getTileAt("Flower", cx, cy);
  if (flower > 0) {
    triggerWin();
    return;
  }

  // LOSE BY BUTTERFLY TOUCH
  for (let e of enemies) {
      const anim = butterflyAnimations[e.color];
      if (!anim) continue;

      const bw = anim.fw * e.scale;
      const bh = anim.fh * e.scale;

      // hitbox lebah
      const halfW = w / 2;
      const halfH = h / 2;

      // jika jarak < kombinasi setengah ukuran → collision
      if (Math.abs(cx - e.x) < (bw/2 + halfW*0.6) &&
          Math.abs(cy - e.y) < (bh/2 + halfH*0.6)) {

          triggerLose();
          return;
      }
  }


  // LOSE
  const collider = getTileAt("Collider", cx, cy);
  if (collider > 0 || collider === -1) {
    triggerLose();
    return;
  }
}

function animateHoneyReward() {
    const num = document.getElementById("honey-number");

    if (!num) return;

    // Reset
    num.style.opacity = 0;
    num.innerText = "0";

    // Delay sedikit lalu fade-in angka baru
    setTimeout(() => {
        num.style.opacity = 0;

        setTimeout(() => {
            num.innerText = "1"; // Reward XP
            num.style.opacity = 1;
        }, 200);

    }, 300);
}

function triggerWin() {
  isRunningCommands = false;
  bee.state = "idle";

  // Matikan tombol agar anak tidak spam
  document.querySelectorAll("button").forEach(b => {
    if (b.id !== "btn-kembali-win")
      b.disabled = true;
  });

  // Tampilkan overlay
  const overlay = document.getElementById("win-overlay");
  overlay.style.display = "flex";

  // SET ANKA XP → 1
  const num = document.getElementById("honey-number");
  num.innerText = "1"; // langsung tampil apa adanya

  // Tombol kembali
  document.getElementById("btn-kembali-win").onclick = () => {
    window.location.href = "../challenge-list.html";
  };
}

function triggerLose() {
  if (hasDied) return;
  hasDied = true;

  isRunningCommands = false;
  bee.state = "death";
  bee.frame = 0;

  showResetButton();
}

function showResetButton() {
  const btn = document.createElement("button");
  btn.id = "btn-reset";
  btn.innerText = "Reset";

  btn.style.position = "absolute";
  btn.style.bottom = "20px";
  btn.style.right = "20px";

  document.body.appendChild(btn);

  btn.onclick = () => {
    document.body.removeChild(btn);
    resetBee();
  };
}

function resetBee() {
  hasDied = false;
  findBeeSpawn();
  bee.state = "idle";
  bee.frame = 0;

  // RESET MUSUH JUGA
  enemies = [];
  loadEnemySpawn();

  isRunningCommands = false;
}


document.getElementById("btn-reset-manual").onclick = () => {
  resetBee();
};

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

    isFromWorkspace = block.closest(".workspace-area") !== null;


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
  if (!target) {
      // jika block berasal dari workspace → hapus
      if (isFromWorkspace) {
          workspaceSlots[originalSlotIndex] = null;
          renderWorkspace();
      }
      return;
  }

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

  // setelah render, update teks sesuai bahasa saat ini
  applyLanguage(currentLang, true);
}


/* =========================================
   DROPUP BUTTONS
========================================= */

document.getElementById("btn-jalan").onclick = () => {
  let d = document.getElementById("dropup-jalan");
  d.style.display = d.style.display === "flex" ? "none" : "flex";
};

// =========================================
// DRAG LANGSUNG DARI TOMBOL TEMBAK
// =========================================
document.getElementById("btn-tembak").onmousedown = (e) => {
    e.preventDefault();

    let block = document.createElement("div");
    block.className = "block";
    block.innerText = getLocalizedBlockText("tembak");
    block.setAttribute("data-type", "tembak");

    realBlock = block;
    isFromWorkspace = false;

    // clone visual
    let clone = block.cloneNode(true);
    clone.classList.add("drag-shadow");
    clone.style.position = "absolute";
    clone.style.zIndex = 9999;
    document.body.appendChild(clone);

    currentDrag = clone;
    clone.style.left = e.pageX + "px";
    clone.style.top = e.pageY + "px";

    window.onmousemove = drag;
    window.onmouseup = drop;
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

    if (type === "tembak") {
      block.innerText = getLocalizedBlockText("tembak");
      block.setAttribute("data-type", "tembak");
    }


    if (type === "jalan") {
      let dir = item.getAttribute("data-dir");
      let arrow = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
      block.innerText = getLocalizedBlockText("jalan", dir);
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
    // Reset kondisi
    hasDied = false;
    bee.state = "idle";
    bee.frame = 0;

    // Kembalikan lebah ke lokasi spawn SETIAP RUN ditekan
    findBeeSpawn();
    
    // RESET MUSUH SETIAP RUN
    enemies = [];
    loadEnemySpawn();


    // Bangun ulang command queue
    commandQueue = [];

    workspaceSlots.forEach(b => {
        if (!b) return;

        let t = b.getAttribute("data-type");

        if (t === "tembak") {
          commandQueue.push({ type: "shoot" });
        }


        if (t === "jalan") {
            commandQueue.push({type:"move", dir:b.getAttribute("data-direction")});
        }
    });

    if (commandQueue.length === 0) {
        alert("Workspace kosong.");
        return;
    }

    isRunningCommands = true;
    runNextCommand();
};

function runNextCommand() {
    if (commandQueue.length === 0) {
        isRunningCommands = false;
        bee.state = "idle";
        return;
    }

    // Delay GLOBAL per block = 500ms
    setTimeout(() => {

        const cmd = commandQueue.shift();

        if (cmd.type === "shoot") {
            shootProjectile();
            // tambahan delay kecil untuk efek animasi tembak
            setTimeout(runNextCommand, 300);
        }

        if (cmd.type === "move") {
            moveBeeOnce(cmd.dir, runNextCommand);
        }

    }, 500);
}

function getTileAt(layerName, px, py) {
  const tileX = Math.floor(px / DRAW_SIZE);
  const tileY = Math.floor(py / DRAW_SIZE);

  if (!mapData) return 0;

  if (
    tileX < 0 || tileY < 0 ||
    tileX >= mapData.width ||
    tileY >= mapData.height
  ) {
    // Keluar map = treat as collider, bukan flower
    return -1;
  }

  const layer = mapData.layers.find(l => l.name === layerName);
  if (!layer || layer.type !== "tilelayer") return 0;

  const index = tileY * mapData.width + tileX;
  return layer.data[index];
}

document.getElementById("btn-back").onclick = () => {
    window.location.href = "../challenge-list.html";
};

const PROJECTILE_SCALE = 1;

function shootProjectile() {
  if (!projectileAnim) return;

  // ➜ AKTIFKAN ANIMASI TEMBAK
  bee.state = "shoot";
  bee.frame = 0;

  // Gunakan ukuran lebah dari anim idle
  const base = beeAnimations.idle;
  const w = base.fw * BEE_SCALE;
  const h = base.fh * BEE_SCALE;

  const cx = bee.x + w / 2;
  const cy = bee.y + h / 2;

  const offsetX = bee.facing === "right"
    ? w * 0.45
    : -w * 0.45 - (projectileAnim.fw * PROJECTILE_SCALE);

  const offsetY = (h * 0.55) - (h / 2);

  // Projectile delay 80ms
  setTimeout(() => {
    projectiles.push({
      x: cx + offsetX,
      y: cy + offsetY,
      vx: bee.facing === "right" ? 3 : -3,
      vy: 0,
      frame: 0
    });
  }, 100);

  // Kembalikan state ke idle setelah animasi tembak selesai
  setTimeout(() => {
    if (bee.state === "shoot") {
      bee.state = "idle";
      bee.frame = 0;
    }
  }, 1000);
}

function updateProjectiles(dt) {
    projectiles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // 1. Cek kena tembok
        const tile = getTileAt("Collider", p.x, p.y);
        if (tile > 0 || tile === -1) {
            p.remove = true;
            return;
        }

        // 2. Cek kena musuh
        checkProjectileHitEnemy(p);
    });

    projectiles = projectiles.filter(p => !p.remove && p.x > 0 && p.x < canvas.width);
}

function drawProjectiles() {
  if (!projectileAnim) return;

  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);

    // flip jika ke kiri
    if (p.vx < 0) {
      ctx.scale(-1, 1);
      ctx.translate(-projectileAnim.fw * PROJECTILE_SCALE, 0);
    }

    ctx.drawImage(
      projectileAnim.img,
      0, 0,
      projectileAnim.fw,
      projectileAnim.fh,
      0, 0,
      projectileAnim.fw * PROJECTILE_SCALE,
      projectileAnim.fh * PROJECTILE_SCALE
    );

    ctx.restore();
  });
}

function updateCamera() {

  if (cam.lockOnBee) {
    // kamera mengikuti lebah
    const base = beeAnimations.idle;
    const w = base.fw * BEE_SCALE;
    const h = base.fh * BEE_SCALE;

    const cx = bee.x + w / 2;
    const cy = bee.y + h / 2;

    cam.targetX = cx - canvas.width / (2 * cam.zoom);
    cam.targetY = cy - canvas.height / (2 * cam.zoom);
  }

  // gerakan kamera linear
  cam.x += (cam.targetX - cam.x) * cam.speed;
  cam.y += (cam.targetY - cam.y) * cam.speed;

  // zoom = tetap (tuan ubah langsung cam.zoom)
}

// =============================================
// INTRO CAMERA SEQUENCE
// =============================================
function cameraToBee(callback) {
  cam.lockOnBee = false;

  const base = beeAnimations.idle;
  const w = base.fw * BEE_SCALE;
  const h = base.fh * BEE_SCALE;

  const cx = bee.x + w / 2;
  const cy = bee.y + h / 2;

  cam.targetX = cx - canvas.width / (2 * cam.zoom);
  cam.targetY = cy - canvas.height / (2 * cam.zoom);

  const check = setInterval(() => {
    if (Math.abs(cam.x - cam.targetX) < 10 && Math.abs(cam.y - cam.targetY) < 10) {
      clearInterval(check);
      setTimeout(callback, 400); // jeda sebelum lanjut
    }
  }, 50);
}

function cameraToFlower(callback) {
  cam.lockOnBee = false;

  const layer = mapData.layers.find(
    l => l.type === "objectgroup" && l.name === "FlowerZoom"
  );
  if (!layer || layer.objects.length === 0) return callback();

  const obj = layer.objects[0];
  const scale = DRAW_SIZE / TILE_SIZE;

  const centerX = (obj.x + obj.width / 2) * scale;
  const centerY = (obj.y + obj.height / 2) * scale;

  cam.targetX = centerX - canvas.width / (2 * cam.zoom);
  cam.targetY = centerY - canvas.height / (2 * cam.zoom);

  const check = setInterval(() => {
    if (Math.abs(cam.x - cam.targetX) < 10 && Math.abs(cam.y - cam.targetY) < 10) {
      clearInterval(check);
      setTimeout(callback, 500);
    }
  }, 50);
}

function cameraBackToBee(callback) {
  cameraToBee(callback); // gunakan fungsi yang sama
}


// =============================================
// RUN INTRO CAMERA AFTER POPUP CLOSE
// =============================================
function runIntroCameraSequence() {
  cameraToBee(() => {
    cameraToFlower(() => {
      cameraBackToBee(() => {
        cam.lockOnBee = true; // kembali ke mode follow lebah
      });
    });
  });
}


// =============================================
// INTRO POPUP BEE ANIMATION
// =============================================
let introBeeImg = new Image();
introBeeImg.src = "../Asset/Sprites/normal.png";

let introBeeJSON = null;

fetch("../Asset/Sprites/normal.json")
  .then(r => r.json())
  .then(json => {
    introBeeJSON = json;
    animateIntroBee();
  });

function animateIntroBee() {
  const cvs = document.getElementById("intro-bee-canvas");
  const ictx = cvs.getContext("2d");

  let frame = 0;

  function loop() {
    if (!introBeeJSON) return requestAnimationFrame(loop);

    let fw = introBeeJSON.frameWidth;
    let fh = introBeeJSON.frameHeight;

    ictx.clearRect(0, 0, cvs.width, cvs.height);

    ictx.drawImage(
      introBeeImg,
      frame * fw, 0, fw, fh,
      0, 0, cvs.width, cvs.height
    );

    frame = (frame + 1) % introBeeJSON.frames;

    setTimeout(() => requestAnimationFrame(loop), 150);
  }

  loop();
}

// auto close popup
window.addEventListener("load", () => {
  setTimeout(() => {
    const popup = document.getElementById("intro-popup");
    popup.style.display = "none";

    // MULAI SEQUENCE KAMERA SETELAH POPUP HILANG
    runIntroCameraSequence();

  }, 2000);
});

document.getElementById("btn-reset-workspace").addEventListener("click", () => {

    // Hapus block dari DOM (tampilan)
    const slots = document.querySelectorAll(".slot");
    slots.forEach(slot => {
        const block = slot.querySelector(".block");
        if (block) block.remove();
    });

    // HAPUS DATA SEBENARNYA
    workspaceSlots = Array(10).fill(null);

    // Re-render untuk memastikan slot benar-benar kosong
    renderWorkspace();
});

/* ===============================
   SIMPLE LANGUAGE PACK (NEW)
=============================== */

let currentLang = "en"; // default
const langBtn = document.getElementById("lang-toggle-btn");

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

/* ===============================
   APPLY LANGUAGE (NEW)
=============================== */
function applyLanguage(lang, fromWorkspaceRender = false) {
    const L = languagePack[lang];

    // Header
    document.querySelector(".title").innerText = L.title;
    document.getElementById("btn-back").innerText = L.back;
    document.getElementById("btn-run").innerText = L.run;

    // Manual reset
    document.getElementById("btn-reset-manual").innerText = L.resetManual;

    // Panel titles
    document.getElementById("title-blocks").innerText = L.blocksTitle;
    document.getElementById("title-workspace").innerText = L.workspaceTitle;

    // Win popup
    document.querySelector(".win-title").innerText = L.winTitle;
    document.getElementById("btn-kembali-win").innerText = L.winBack;

    document.getElementById("btn-reset-workspace").innerText = L.reset;
}

/* ===============================
   LANGUAGE TOGGLE BUTTON
=============================== */
langBtn.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "id" : "en";
    langBtn.innerText = currentLang.toUpperCase();
    applyLanguage(currentLang);
});

/* ===============================
   BLOCK LABEL (EMOJI ONLY)
=============================== */
function getLocalizedBlockText(type, dir = null) {
    // Tidak ada teks → emoji murni
    if (type === "tembak") return "🔫";
    if (type === "jalan") {
        const arrow = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
        return arrow;
    }
}

function manageIntroPopup(currentMap) {
    const popup = document.getElementById("intro-popup");
    const arrow = document.querySelector(".intro-arrow");

    if (!popup) return;

    // Map 01 → muncul 🡲
    if (currentMap === 0) {
        popup.style.display = "flex";
        arrow.textContent = "🡲";
        return;
    }

    // Map 03 → muncul 🔫
    if (currentMap === 2) {
        popup.style.display = "flex";
        arrow.textContent = "🔫";
        return;
    }

    // Map lainnya → hide
    popup.style.display = "none";
}
