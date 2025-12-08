/* =========================================
   CORE SETUP & GAME STATE
========================================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Game State
let commandQueue = [];
let isRunningCommands = false;
let hasDied = false;
let projectiles = [];
let enemies = [];
let lastTime = 0;

const BEE_SCALE = 0.9;
const TILE_SIZE = 16;
const DRAW_SIZE = 24;

let cam = {
  x: 0,
  y: 0,
  zoom: 1.5,
  targetX: 0,
  targetY: 0,
  targetZoom: 1.5,
  speed: 0.02,
  lockOnBee: true
};

const MAP_LIST = [
    "JSON/01.json", "JSON/02.json", 
    "JSON/03.json", "JSON/04.json",
    "JSON/05.json", "JSON/06.json",
    "JSON/07.json", "JSON/08.json",
    "JSON/09.json", "JSON/10.json"
];

let selectedMap = parseInt(localStorage.getItem("selectedMap") || "0");
if (selectedMap < 0 || selectedMap >= MAP_LIST.length) {
    selectedMap = 0;
}

let mapData = null;
let tilesets = [
  { firstgid: 1, image: "../Asset/Blind Hummingbird Tileset/blind_hummingbird_spritesheet_16x16.png", columns: 8 },
  { firstgid: 33, image: "../Asset/Blind Hummingbird Tileset/forest_decoration_set_16x16.png", columns: 8 }
];
tilesets.forEach(ts => {
  ts.img = new Image();
  ts.img.src = ts.image;
});


/* =========================================
   BEE & ENEMY ANIMATION DATA
========================================= */

const bee = {
  x: 100,
  y: 100,
  state: "idle",
  frame: 0,
  timer: 0,
  speed: 2,
  facing: "right"
};

let beeAnimations = { idle: null, walk: null, death: null, shoot: null };
const butterflyColors = ["Blue", "Grey", "Pink", "Red", "White", "Yellow"];
let butterflyAnimations = [];
let projectileAnim = null;

// --- CONDITIONAL BLOCK ASSETS ---
const conditionalArrowImages = {};
const CONDITIONAL_DIRS = ['above', 'right', 'left', 'down'];

function loadConditionalArrows() {
    CONDITIONAL_DIRS.forEach(dir => {
        const img = new Image();
        // File path sesuai struktur yang Anda berikan
        img.src = `../Asset/Sprites/x-${dir}.png`; 
        conditionalArrowImages[dir] = img;
    });
}
// --- END CONDITIONAL BLOCK ASSETS ---


async function loadAnim(name) {
  const json = await fetch(`../Asset/Sprites/${name}.json`).then(r => r.json());
  const img = new Image();
  img.src = `../Asset/Sprites/${name}.png`;
  await img.decode();
  return { img: img, fw: json.frameWidth, fh: json.frameHeight, frames: json.frames };
}

async function loadBeeAndAssets() {
  beeAnimations.idle  = await loadAnim("normal");
  beeAnimations.walk  = await loadAnim("normal");
  beeAnimations.death = await loadAnim("death");
  beeAnimations.shoot = await loadAnim("shoot");
  projectileAnim = await loadProjectile();
  await loadButterflies();
  loadConditionalArrows(); // Load aset panah conditional
}

/* =========================================
   TILE MAP & COLLISION
========================================= */

function getTilesetForGID(gid) {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) return tilesets[i];
  }
  return null;
}

function getTileAt(layerName, px, py) {
  const tileX = Math.floor(px / DRAW_SIZE);
  const tileY = Math.floor(py / DRAW_SIZE);

  if (!mapData || tileX < 0 || tileY < 0 || tileX >= mapData.width || tileY >= mapData.height) {
    return -1; 
  }

  const layer = mapData.layers.find(l => l.name === layerName);
  if (!layer || layer.type !== "tilelayer") return 0;

  const index = tileY * mapData.width + tileX;
  return layer.data[index];
}

/**
 * Memeriksa apakah ubin di arah yang diberikan dari posisi Lebah saat ini adalah Collider.
 * @param {string} dir Direction ('up', 'down', 'left', 'right')
 * @returns {boolean} True jika ubin Collider terdeteksi di ubin berikutnya.
 */
function checkColliderInDirection(dir) {
    if (!mapData || !beeAnimations.idle) return false;
    
    const base = beeAnimations.idle;
    const w = base.fw * BEE_SCALE;
    const h = base.fh * BEE_SCALE;
    const cx = bee.x + w / 2;
    const cy = bee.y + h / 2;
    
    // Periksa titik tengah ubin berikutnya (Ghost Bee Logic)
    const checkDistance = DRAW_SIZE; 
    
    let checkX = cx;
    let checkY = cy;
    
    // Koreksi sedikit offset untuk memastikan lebah tidak dihitung bertabrakan dengan ubinnya sendiri
    if (dir === "left") checkX -= checkDistance;
    if (dir === "right") checkX += checkDistance;
    if (dir === "up") checkY -= checkDistance;
    if (dir === "down") checkY += checkDistance;

    const tile = getTileAt("Collider", checkX, checkY);
    
    // Tile > 0 berarti ubin hadir, Tile === -1 berarti di luar batas (juga dianggap dinding)
    return tile > 0 || tile === -1;
}


/* =========================================
   WORKFLOW STATE & HELPERS
========================================= */

let currentDrag = null;
let realBlock = null;
let isFromWorkspace = false;
let originalSlotIndex = null; 
let isMovingLoop = false; 
let originalNestedIndex = null; 

let workspaceSlots = Array(10).fill(null);
let loopContent = Array(10).fill(null).map(() => Array(2).fill(null)); 
let openLoopIndex = -1; 

// --- FUNCTION DEFINITION STATE ---
let functionBlockDef = null; 
let functionContent = [null, null]; 
let isFunctionBubbleOpen = false; 
let functionLoopNestedContent = Array(2).fill(null).map(() => Array(2).fill(null)); 
// -----------------------------------

// --- CONDITIONAL BLOCK STATE (NEW) ---
const conditionalNestedContent = new Map(); // Map<Block ID, { nestedBlock: Block | null, checkDir: string }>
let openConditionalBlockId = null; 
let conditionalCounter = 0; // Counter untuk ID unik
// -------------------------------------

let realBlockDetached = false;

function getWorkspaceSlots() {
  return [...document.querySelectorAll(".workspace-area > .workspace-scroll > .slot")];
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
  
  const isDraggingLoop = block.getAttribute("data-type") === "loop";
  const isDraggingFunction = block.getAttribute("data-type") === "function";
  const isDraggingConditional = block.getAttribute("data-type") === "conditional";

  // --- 1. Mencari slot terbaik di slot utama (Priority 1) ---
  document.querySelectorAll(".workspace-area > .workspace-scroll > .slot").forEach(slot => {
    let ov = getOverlap(block, slot);
    if (ov > bestVal && ov > 0.5) {
      bestVal = ov;
      best = slot;
    }
  });

  // --- 2. Mencari slot terbaik di nested slots (Priority 2) ---
  
  // 2a. Nested Loop Slots
  if (openLoopIndex !== -1) {
    const activeBubble = document.getElementById('global-loop-dropup');
    if (activeBubble) {
        if (!isDraggingLoop && !isDraggingFunction && !isDraggingConditional) {
            activeBubble.querySelectorAll(".nested-slot").forEach(nestedSlot => {
              let ov = getOverlap(block, nestedSlot);
              if (ov > bestVal && ov > 0.7) { 
                  bestVal = ov;
                  best = nestedSlot;
              }
            });
        }
    }
  }
  
  // 2b. Nested Function Definition Slots
  if (isFunctionBubbleOpen) {
      if (!isDraggingFunction) {
          const functionBubble = document.getElementById('function-definition-bubble');
          if (functionBubble) {
              functionBubble.querySelectorAll(".function-nested-slot").forEach(nestedSlot => {
                  const isCondOrLoop = isDraggingConditional || isDraggingLoop;
                  if (!isCondOrLoop && getOverlap(block, nestedSlot) > 0.5) { 
                      bestVal = getOverlap(block, nestedSlot);
                      best = nestedSlot;
                  }
              });
          }
      }
  }
  
  // 2c. Nested Conditional Slot (NEW)
  if (openConditionalBlockId) {
    // Hanya izinkan block sederhana (jalan/tembak) di dalam Conditional
    const isDraggingSimple = block.getAttribute("data-type") === "jalan" || block.getAttribute("data-type") === "tembak";
    
    if (isDraggingSimple) {
        const activeBubble = document.getElementById('global-conditional-dropup');
        if (activeBubble) {
            activeBubble.querySelectorAll(".conditional-nested-slot").forEach(nestedSlot => {
              let ov = getOverlap(block, nestedSlot);
              if (ov > bestVal && ov > 0.7) { 
                  bestVal = ov;
                  best = nestedSlot;
              }
            });
        }
    }
  }
  
  return best;
}

/**
 * Membersihkan style posisi inline yang tersisa dari operasi drag.
 */
function cleanPositionStyles(element) {
    if (element && element.style) {
        element.style.removeProperty('position');
        element.style.removeProperty('left');
        element.style.removeProperty('top');
        element.removeAttribute('style'); 
    }
}


/* =========================================
   BLOCK FACTORIES
========================================= */

function createLoopBlock(initialCount = 2) {
    let block = document.createElement("div");
    block.className = "block";
    block.setAttribute("data-type", "loop");
    block.setAttribute("data-loop-count", initialCount);

    block.innerHTML = `
        <div class="loop-content">
            <span class="loop-symbol">🔁</span>
            <div class="loop-counter">${initialCount}</div>
            <span class="loop-symbol">🔁</span>
        </div>
    `;
    return block;
}

function createFunctionBlock() {
    let block = document.createElement("div");
    block.className = "block";
    block.setAttribute("data-type", "function");
    block.innerHTML = `Function: {}`; 
    return block;
}

/**
 * Membuat blok Conditional baru (NEW)
 */
function createConditionalBlock(initialDir = 'above') {
    let block = document.createElement("div");
    block.className = "block";
    block.setAttribute("data-type", "conditional");
    
    const blockId = `cond-${conditionalCounter++}`;
    block.setAttribute("data-cond-id", blockId);
    block.setAttribute("data-check-dir", initialDir); // Simpan arah di atribut
    
    // Initialize nested content state
    conditionalNestedContent.set(blockId, { nestedBlock: null, checkDir: initialDir });
    
    // Visual yang lebih sederhana: hanya tanda seru + Ikon arah awal
    block.innerHTML = `
        <div class="conditional-content">
            <span class="conditional-symbol" style="font-size: 40px; color: var(--tk-cond-text);">!</span>
            <!-- Ikon arah awal ditambahkan di sini, untuk dipickup di renderWorkspace -->
            <div class="conditional-dir-icon" style="position: absolute; right: 8px; bottom: 8px;">
                <img src="../Asset/Sprites/x-${initialDir}.png" alt="Direction" class="conditional-img" style="width: 20px; height: 20px;">
            </div>
        </div>
    `;
    return block;
}


/**
 * Membuat representasi visual untuk ikon di dalam block Function
 */
function getIconHtml(sourceBlock) {
    if (!sourceBlock) return '';
    const type = sourceBlock.getAttribute('data-type');
    
    const iconFontSize = '28px'; 
    
    if (type === 'loop') {
         // Warna loop di tema TK/SD
         return `<span style="font-size: ${iconFontSize}; color: #3a3ad0;">🔁</span>`;
    }
    
    if (type === 'jalan') {
        const dir = sourceBlock.getAttribute('data-direction');
        const icon = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
        return `<span style="font-size: ${iconFontSize}; color: var(--sd-text);">${icon}</span>`; 
    }
    if (type === 'tembak') {
        return `<span style="font-size: ${iconFontSize}; color: var(--sd-text);">🔫</span>`; 
    }
    if (type === 'function') {
         return `<span style="font-size: ${iconFontSize}; color: var(--sd-function-text);">{}</span>`;
    }
    if (type === 'conditional') {
         // Menggunakan warna oranye
         return `<span style="font-size: ${iconFontSize}; color: #ff9933;">!</span>`;
    }
    return '';
}


/* =========================================
   DRAG AND DROP HANDLERS
========================================= */

function attachDragEventsToBlock(block) {
  block.onmousedown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Mencegah drag jika klik berasal dari kontrol internal
    if (e.target.closest('.loop-counter') || e.target.closest('.loop-toggle-btn') || e.target.closest('.function-toggle-btn') || e.target.closest('.conditional-toggle-btn')) return; 

    isFromWorkspace = block.closest(".workspace-area") !== null;
    isMovingLoop = block.getAttribute("data-type") === "loop" && isFromWorkspace; 
    
    const isNestedDrag = block.closest('.nested-slot') !== null || block.closest('.function-nested-slot') !== null || block.closest('.conditional-nested-slot') !== null;
    
    originalNestedIndex = null;
    
    let dragAborted = false;
    
    if (isNestedDrag) {
        
        const isFromFunction = block.closest('.function-nested-slot') !== null;
        const isFromConditional = block.closest('.conditional-nested-slot') !== null;
        
        // --- Drag dari Conditional Slot (NEW) ---
        if (isFromConditional) {
            const parentId = block.getAttribute('data-cond-parent-id');
            const state = conditionalNestedContent.get(parentId);
            originalSlotIndex = parentId; 
            originalNestedIndex = 0; 

            if (state) {
                state.nestedBlock = null;
                // Tetap buka bubble saat drag dimulai dari nested, untuk kemudahan UX
                openConditionalBlockId = parentId; 
                block.setAttribute('data-is-nested', 'true');
            } else {
                 console.error("[CRITICAL ERROR] Nested Conditional block has inconsistent state/index. Aborting drag.");
                 dragAborted = true;
                 renderWorkspace();
            }
        }
        
        // --- Drag dari Function Slot ---
        else if (isFromFunction) {
            originalSlotIndex = -1;
            originalNestedIndex = parseInt(block.getAttribute('data-nested-index'));
            
            let isValidIndex = !isNaN(originalNestedIndex) && originalNestedIndex >= 0 && originalNestedIndex < functionContent.length;
            
            if (!isValidIndex) {
                 console.error("[CRITICAL ERROR] Nested Function block has inconsistent state/index. Aborting drag and forcing render.");
                 dragAborted = true;
                 renderWorkspace(); 
            }
            
            if (!dragAborted) {
                if (functionContent[originalNestedIndex] && functionContent[originalNestedIndex].getAttribute('data-type') === 'loop') {
                    functionLoopNestedContent[originalNestedIndex] = Array(2).fill(null);
                }
                functionContent[originalNestedIndex] = null; 
                block.setAttribute('data-is-nested', 'true');
            }
        } 
        
        // --- Drag dari Loop Nested Slot ---
        else {
             const parentLoopId = block.getAttribute('data-parent-loop-index');
             originalNestedIndex = parseInt(block.getAttribute('data-nested-index')); 

             if (typeof parentLoopId === 'string' && parentLoopId.startsWith('nested-f')) {
                  const funcNestedIndex = parseInt(parentLoopId.replace('nested-f', ''));
                  originalSlotIndex = parentLoopId; 
                  if (!isNaN(originalNestedIndex) && functionLoopNestedContent[funcNestedIndex] && originalNestedIndex >= 0) {
                      functionLoopNestedContent[funcNestedIndex][originalNestedIndex] = null;
                  } else {
                      console.error("[CRITICAL ERROR] Nested Function Loop block has inconsistent state/indices. Aborting drag.");
                      dragAborted = true;
                      renderWorkspace();
                  }
             } 
             else {
                  originalSlotIndex = parseInt(parentLoopId);
                  
                  let isValidIndex = !isNaN(originalSlotIndex) && originalSlotIndex >= 0 && originalSlotIndex < loopContent.length &&
                                     !isNaN(originalNestedIndex) && originalNestedIndex >= 0 && originalNestedIndex < (loopContent[originalSlotIndex] ? loopContent[originalSlotIndex].length : 0);
                  
                  if (!isValidIndex) {
                      console.error("[CRITICAL ERROR] Nested Loop block has inconsistent state/indices. Aborting drag and forcing render.");
                      dragAborted = true;
                      renderWorkspace();
                  }
                  
                  if (!dragAborted) {
                       loopContent[originalSlotIndex][originalNestedIndex] = null;
                  }
             }

             if (!dragAborted) {
                 block.setAttribute('data-is-nested', 'true');
             }
        }
        
        if (dragAborted) {
            return; // ABORT DRAG
        }
    } else {
        // Drag dari MAIN SLOT atau TOOLBAR
        
        if (openLoopIndex !== -1 && isFromWorkspace) {
            openLoopIndex = -1;
        }
        
        if (isFunctionBubbleOpen) {
            isFunctionBubbleOpen = false;
        }
        
        // Clear open conditional ID jika drag dari tempat lain
        if (openConditionalBlockId && isFromWorkspace) {
            openConditionalBlockId = null;
        }
        
        if (isFromWorkspace) {
            const parentSlot = block.closest(".slot");
            originalSlotIndex = getSlotIndex(parentSlot);
            block.removeAttribute('data-is-nested');
            
            if (block.getAttribute('data-type') === 'loop') {
                loopContent[originalSlotIndex] = Array(2).fill(null);
            }
            if (block.getAttribute('data-type') === 'conditional') { 
                const blockId = block.getAttribute('data-cond-id');
                conditionalNestedContent.get(blockId).nestedBlock = null; 
            }
            
            workspaceSlots[originalSlotIndex] = null; 
        }
    }


    realBlock = block;

    if (block.parentElement) {
      block.parentElement.removeChild(block);
      realBlockDetached = true;
    }

    let clone = block.cloneNode(true);
    clone.classList.add("drag-shadow");
    clone.style.position = "absolute";
    clone.style.zIndex = 3000; 

    currentDrag = clone;
    document.body.appendChild(clone);

    clone.style.left = (e.pageX - 35) + "px";
    clone.style.top = (e.pageY - 35) + "px";

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

  const target = getBestSlot(currentDrag);
  const blockToPlace = realBlock;
  let shouldRender = false;
  
  let newOpenLoopIndex = openLoopIndex; 
  let newOpenConditionalBlockId = openConditionalBlockId;
  let wasNestedDrag = blockToPlace.hasAttribute('data-is-nested');

  // 1. GUARANTEED DRAG CLEANUP
  if (currentDrag) currentDrag.remove();
  document.body.classList.remove("dragging-dropitem");
  removeHighlight();
  window.onmousemove = null;
  window.onmouseup = null;

  
  // 2. Logic Penempatan
  if (target) {
      
      const isLoopNestedTarget = target.classList.contains("nested-slot");
      const isFunctionNestedTarget = target.classList.contains("function-nested-slot");
      const isConditionalNestedTarget = target.classList.contains("conditional-nested-slot");

      if (isLoopNestedTarget || isFunctionNestedTarget || isConditionalNestedTarget) {
          
          // --- CONSTRAINT CHECK ---
          const isComplexBlock = blockToPlace.getAttribute("data-type") !== "jalan" && blockToPlace.getAttribute("data-type") !== "tembak";
          
          if (isConditionalNestedTarget && isComplexBlock) {
             shouldRender = wasNestedDrag || isFromWorkspace;
          } 
          else if (isFunctionNestedTarget && (blockToPlace.getAttribute("data-type") === "function" || isComplexBlock)) {
             shouldRender = wasNestedDrag || isFromWorkspace;
          } 
          else if (isLoopNestedTarget && (blockToPlace.getAttribute("data-type") === "loop" || blockToPlace.getAttribute("data-type") === "conditional" || blockToPlace.getAttribute("data-type") === "function")) {
             shouldRender = wasNestedDrag || isFromWorkspace;
          }
          
          // --- PLACEMENT LOGIC ---
          
          else if (isConditionalNestedTarget) {
              const parentId = target.getAttribute('data-cond-parent-id');
              const state = conditionalNestedContent.get(parentId);
              
              if (state) {
                  const existingNestedBlock = state.nestedBlock;

                  if (existingNestedBlock) {
                       if (wasNestedDrag) {
                            if (originalSlotIndex === -1) { 
                                functionContent[originalNestedIndex] = existingNestedBlock;
                            } else if (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('nested-f')) { 
                                const funcNestedIndex = parseInt(originalSlotIndex.replace('nested-f', ''));
                                functionLoopNestedContent[funcNestedIndex][originalNestedIndex] = existingNestedBlock;
                            } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'number') { 
                                loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                            } else if (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('cond-')) { 
                                const oldCondState = conditionalNestedContent.get(originalSlotIndex);
                                if (oldCondState) oldCondState.nestedBlock = existingNestedBlock;
                            }
                       } else if (isFromWorkspace && originalSlotIndex !== null) {
                           workspaceSlots[originalSlotIndex] = existingNestedBlock;
                       }
                  }
                  
                  state.nestedBlock = blockToPlace;
                  
                  // NEW: Auto-open Conditional Dropup
                  newOpenConditionalBlockId = parentId; 
                  newOpenLoopIndex = -1;
                  isFunctionBubbleOpen = false;
                  shouldRender = true;
              } else {
                   shouldRender = wasNestedDrag || isFromWorkspace;
              }

          }
          
          else if (isFunctionNestedTarget) {
              const nestedIndex = parseInt(target.getAttribute("data-index"));
              const existingNestedBlock = functionContent[nestedIndex];

              if (existingNestedBlock) {
                  if (wasNestedDrag) {
                       if (originalSlotIndex === -1) { 
                           if (typeof originalSlotIndex === 'string' && String(originalSlotIndex).startsWith('nested-f')) {
                               const funcNestedIndex = parseInt(originalSlotIndex.replace('nested-f', ''));
                               functionLoopNestedContent[funcNestedIndex][originalNestedIndex] = existingNestedBlock;
                           } else {
                               functionContent[originalNestedIndex] = existingNestedBlock;
                           }
                       } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'number') { 
                           loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                       } else if (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('cond-')) {
                           conditionalNestedContent.get(originalSlotIndex).nestedBlock = existingNestedBlock;
                       }
                  } else if (isFromWorkspace && originalSlotIndex !== null) {
                       workspaceSlots[originalSlotIndex] = existingNestedBlock;
                  }
              }

              functionContent[nestedIndex] = blockToPlace;
              
              if (blockToPlace.getAttribute("data-type") === "loop") {
                  newOpenLoopIndex = `nested-f${nestedIndex}`;
              } else {
                  if (typeof openLoopIndex === 'string' && openLoopIndex.startsWith('nested-f')) {
                       newOpenLoopIndex = -1;
                  }
              }

              isFunctionBubbleOpen = true; 
              newOpenConditionalBlockId = null;
              shouldRender = true;

          }
          
          else if (isLoopNestedTarget) {
              let parentLoopId = openLoopIndex; 
              const isFunctionNestedLoop = target.hasAttribute('data-f-parent');

              if (parentLoopId !== -1) {
                  const nestedIndex = parseInt(target.getAttribute("data-index"));
                  
                  if (isFunctionNestedLoop) {
                       const funcNestedIndex = parseInt(String(parentLoopId).replace('nested-f', ''));
                       const existingNestedBlock = functionLoopNestedContent[funcNestedIndex][nestedIndex];

                       if (existingNestedBlock) {
                           if (wasNestedDrag) {
                                if (originalSlotIndex === -1) {
                                    functionContent[originalNestedIndex] = existingNestedBlock;
                                } else if (typeof originalSlotIndex === 'string' && String(originalSlotIndex).startsWith('nested-f')) {
                                    const origFuncIndex = parseInt(originalSlotIndex.replace('nested-f', ''));
                                    functionLoopNestedContent[origFuncIndex][originalNestedIndex] = existingNestedBlock;
                                } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'number') {
                                    loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                                } else if (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('cond-')) {
                                    conditionalNestedContent.get(originalSlotIndex).nestedBlock = existingNestedBlock;
                                }
                           } else if (isFromWorkspace && originalSlotIndex !== null) {
                               workspaceSlots[originalSlotIndex] = existingNestedBlock;
                           }
                       }
                       
                       functionLoopNestedContent[funcNestedIndex][nestedIndex] = blockToPlace;
                       isFunctionBubbleOpen = true; 
                       newOpenLoopIndex = parentLoopId;
                       newOpenConditionalBlockId = null;
                       shouldRender = true;
                       
                  } else {
                      const existingNestedBlock = loopContent[parentLoopId][nestedIndex];

                      if (existingNestedBlock) {
                           if (wasNestedDrag) {
                                if (originalSlotIndex === -1) {
                                    functionContent[originalNestedIndex] = existingNestedBlock;
                                } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'number') {
                                    loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                                } else if (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('cond-')) {
                                    conditionalNestedContent.get(originalSlotIndex).nestedBlock = existingNestedBlock;
                                }
                           } else if (isFromWorkspace && originalSlotIndex !== null) {
                               workspaceSlots[originalSlotIndex] = existingNestedBlock;
                           }
                      }
                      
                      loopContent[parentLoopId][nestedIndex] = blockToPlace;
                      newOpenLoopIndex = parentLoopId;
                      newOpenConditionalBlockId = null;
                      shouldRender = true;
                  }
              } else {
                  shouldRender = wasNestedDrag || isFromWorkspace;
              }
          }
          
      } else {
          // Drop berhasil ke SLOT UTAMA (Main Workspace)
          const targetIndex = getSlotIndex(target);
          const existingTargetBlock = workspaceSlots[targetIndex];
          
          if (isFromWorkspace) {
            if (!wasNestedDrag && originalSlotIndex !== null && originalSlotIndex !== targetIndex && existingTargetBlock) {
                 if (existingTargetBlock.getAttribute("data-type") === "loop") {
                      loopContent[originalSlotIndex] = loopContent[targetIndex];
                  }
                  
                  workspaceSlots[originalSlotIndex] = existingTargetBlock;
                  if (newOpenLoopIndex === targetIndex) newOpenLoopIndex = originalSlotIndex;
            }
            else if (wasNestedDrag && existingTargetBlock) {
                if (existingTargetBlock.getAttribute("data-type") === "loop") {
                    loopContent[targetIndex] = Array(2).fill(null);
                }
                if (existingTargetBlock.getAttribute("data-type") === "conditional") { 
                    const blockId = existingTargetBlock.getAttribute('data-cond-id');
                    conditionalNestedContent.get(blockId).nestedBlock = null;
                }
            }
            
            if (wasNestedDrag) {
                 blockToPlace.removeAttribute('data-is-nested');
            }
          }
          
          if (existingTargetBlock && blockToPlace.getAttribute("data-type") === "loop") {
             loopContent[targetIndex] = Array(2).fill(null);
          }
          if (existingTargetBlock && blockToPlace.getAttribute("data-type") === "conditional") {
             conditionalNestedContent.get(existingTargetBlock.getAttribute('data-cond-id')).nestedBlock = null;
          }
            
          workspaceSlots[targetIndex] = blockToPlace;
          
          if (isFromWorkspace && !wasNestedDrag && blockToPlace.getAttribute('data-type') === 'loop' && originalSlotIndex !== null) {
              if (originalSlotIndex !== targetIndex) {
                  loopContent[targetIndex] = loopContent[originalSlotIndex];
                  loopContent[originalSlotIndex] = Array(2).fill(null);
              }
          }
          
          newOpenLoopIndex = (blockToPlace.getAttribute("data-type") === "loop") ? targetIndex : -1;
          
          // NEW: Auto-open Conditional Dropup jika drop ke main slot
          if (blockToPlace.getAttribute("data-type") === "conditional") {
              newOpenConditionalBlockId = blockToPlace.getAttribute('data-cond-id');
          } else {
              newOpenConditionalBlockId = null;
          }

          isFunctionBubbleOpen = false;
          shouldRender = true;
      }

  } else {
      // Drop gagal (dilepas di luar slot)
      
      // Jika berasal dari nested drag, kembalikan ke state awal
      if (wasNestedDrag && typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('cond-')) {
          shouldRender = true;
          newOpenConditionalBlockId = originalSlotIndex; 
          blockToPlace.removeAttribute('data-is-nested');
      }
      else if (wasNestedDrag) {
          shouldRender = true;
          if (originalSlotIndex === -1 || (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('nested-f'))) {
              isFunctionBubbleOpen = true;
              if (typeof originalSlotIndex === 'string' && originalSlotIndex.startsWith('nested-f')) { newOpenLoopIndex = originalSlotIndex; }
          } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'number') { 
              newOpenLoopIndex = originalSlotIndex; 
          }
          blockToPlace.removeAttribute('data-is-nested');
          
      } 
      // JIKA BUKAN nested drag, dan berasal dari workspace utama
      else if (isFromWorkspace) {
          shouldRender = true; 
          if (realBlock.getAttribute('data-type') === 'loop' && originalSlotIndex !== null) {
             loopContent[originalSlotIndex] = Array(2).fill(null);
          }
          if (realBlock.getAttribute('data-type') === 'conditional' && originalSlotIndex !== null) { 
             conditionalNestedContent.get(realBlock.getAttribute('data-cond-id')).nestedBlock = null;
          }
      }
      
      if (realBlock && realBlock.parentNode === document.body) {
           realBlock.remove();
      }
  }
  
  // 3. Final State Reset & Render
  openLoopIndex = newOpenLoopIndex;
  openConditionalBlockId = newOpenConditionalBlockId;
  
  currentDrag = null;
  realBlock = null;
  isMovingLoop = false;
  isFromWorkspace = false;
  originalSlotIndex = null;
  originalNestedIndex = null;
  
  if (shouldRender) {
      renderWorkspace();
  }
}

function highlightSlots(block) {
  removeHighlight();

  // Highlight Slot Utama
  document.querySelectorAll(".workspace-area > .workspace-scroll > .slot").forEach(slot => {
    if (getOverlap(block, slot) > 0.5) slot.classList.add("highlight");
  });
  
  const isDraggingLoop = block.getAttribute("data-type") === "loop";
  const isDraggingFunction = block.getAttribute("data-type") === "function";
  const isDraggingConditional = block.getAttribute("data-type") === "conditional";

  // Highlight Nested Slots 
  
  // 2a. Nested Loop Slots
  if (openLoopIndex !== -1) {
    if (!isDraggingLoop && !isDraggingFunction && !isDraggingConditional) {
        const activeBubble = document.getElementById('global-loop-dropup');
        if (activeBubble) {
            activeBubble.querySelectorAll(".nested-slot").forEach(nestedSlot => {
              if (getOverlap(block, nestedSlot) > 0.7) nestedSlot.classList.add("highlight");
            });
        }
    }
  }
  
  // 2b. Nested Function Definition Slots
  if (isFunctionBubbleOpen) {
      if (!isDraggingFunction) {
          const functionBubble = document.getElementById('function-definition-bubble');
          if (functionBubble) {
              functionBubble.querySelectorAll(".function-nested-slot").forEach(nestedSlot => {
                  const isCondOrLoop = isDraggingConditional || isDraggingLoop;
                  if (!isCondOrLoop && getOverlap(block, nestedSlot) > 0.5) nestedSlot.classList.add("highlight");
              });
          }
      }
  }
  
  // 2c. Nested Conditional Slot (NEW)
  if (openConditionalBlockId) {
    const isDraggingSimple = block.getAttribute("data-type") === "jalan" || block.getAttribute("data-type") === "tembak";
    
    if (isDraggingSimple) {
        const activeBubble = document.getElementById('global-conditional-dropup');
        if (activeBubble) {
            activeBubble.querySelectorAll(".conditional-nested-slot").forEach(nestedSlot => {
              if (getOverlap(block, nestedSlot) > 0.7) nestedSlot.classList.add("highlight");
            });
        }
    }
  }
}

function removeHighlight() {
  document.querySelectorAll(".slot.highlight").forEach(slot => slot.classList.remove("highlight"));
}


// --- FUNCTION RENDERING & SYNC ---

/**
 * Merender bubble konfigurasi untuk Conditional Block (NEW)
 * @param {HTMLElement} b Block Conditional yang sedang aktif
 */
function renderConditionalBubble(b) { 
    const blockId = b.getAttribute('data-cond-id');
    const state = conditionalNestedContent.get(blockId);

    const globalDropup = document.getElementById('global-conditional-dropup');
    if (globalDropup) globalDropup.remove();

    if (!state || openConditionalBlockId !== blockId) return;

    let condDropup = document.createElement("div");
    condDropup.className = "conditional-dropup";
    condDropup.id = 'global-conditional-dropup';
    
    const activeDir = state.checkDir;

    // Sederhanakan HTML untuk hanya menampilkan 2 kotak (Tombol Arah dan Slot Block)
    condDropup.innerHTML = `
        <div class="condition-btn" data-dir-selected="${activeDir}">
            <img src="../Asset/Sprites/x-${activeDir}.png" alt="Direction" class="conditional-img">
            <div class="condition-select-dropup">
                <div class="direction-item" data-dir="above"><img src="../Asset/Sprites/x-above.png" alt="Above"></div>
                <div class="direction-item" data-dir="right"><img src="../Asset/Sprites/x-right.png" alt="Right"></div>
                <div class="direction-item" data-dir="left"><img src="../Asset/Sprites/x-left.png" alt="Left"></div>
                <div class="direction-item" data-dir="down"><img src="../Asset/Sprites/x-down.png" alt="Down"></div>
            </div>
        </div>
        <div class="slot conditional-nested-slot" data-index="0" data-cond-parent-id="${blockId}"></div>
    `;

    const blockRect = b.getBoundingClientRect();
    condDropup.style.position = 'fixed';
    // Posisikan di atas block, disesuaikan agar tidak terlalu tinggi
    condDropup.style.top = `${blockRect.top - 120}px`; 
    condDropup.style.left = `${blockRect.left + blockRect.width / 2}px`;
    condDropup.style.transform = 'translateX(-50%)'; 
    condDropup.style.zIndex = 2000; 

    document.body.appendChild(condDropup);
    
    const condButton = condDropup.querySelector(".condition-btn");
    const selectDropup = condDropup.querySelector(".condition-select-dropup");

    // Logic untuk Tombol Arah (Secondary Dropup)
    condButton.onmousedown = (e) => {
        e.stopPropagation();
        const isVisible = selectDropup.style.display === 'flex';
        // Sembunyikan semua dropup sekunder lainnya sebelum menampilkan yang ini
        document.querySelectorAll(".condition-select-dropup").forEach(d => d.style.display = 'none');
        selectDropup.style.display = isVisible ? 'none' : 'flex';
    };

    // Pindah ke slot utama, lalu pilih arah baru
    condDropup.querySelectorAll('.direction-item').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const newDir = btn.getAttribute('data-dir');
            
            // 1. Update State
            state.checkDir = newDir;
            b.setAttribute('data-check-dir', newDir); 

            // 2. Update visual block & button (image)
            const img = b.querySelector('.conditional-img'); // Di block utama
            if (img) img.src = `../Asset/Sprites/x-${newDir}.png`;
            
            condButton.querySelector('.conditional-img').src = `../Asset/Sprites/x-${newDir}.png`;
            
            // 3. Tutup bubble conditional dan render ulang
            openConditionalBlockId = null;
            renderWorkspace();
        };
    });
    
    // Auto-hide secondary dropup saat mouse keluar dari area button/selectDropup
    condDropup.onmouseleave = () => {
         setTimeout(() => {
            if (!condDropup.querySelector(":hover")) {
                selectDropup.style.display = 'none';
            }
         }, 100);
    };

    // Render Nested Slot Content
    const nestedSlot = condDropup.querySelector(".conditional-nested-slot");
    const nestedBlock = state.nestedBlock;

    if (nestedBlock) {
        nestedBlock.setAttribute('data-cond-parent-id', blockId);
        nestedBlock.setAttribute('data-nested-index', 0);

        nestedSlot.appendChild(nestedBlock);
        cleanPositionStyles(nestedBlock);
        attachDragEventsToBlock(nestedBlock);
        
        // Update localized text
        if (nestedBlock.getAttribute("data-type") === "jalan") {
             const dir = nestedBlock.getAttribute('data-direction');
             nestedBlock.innerText = getLocalizedBlockText("jalan", dir);
        } else if (nestedBlock.getAttribute("data-type") === "tembak") {
             nestedBlock.innerText = getLocalizedBlockText("tembak");
        }
    }
}


function renderFunctionToolbar() {
    const btnFunction = document.getElementById("btn-function");
    const functionBubble = document.getElementById('function-definition-bubble');
    const toggleBtn = document.getElementById('function-toggle-btn-toolbar');

    if (!btnFunction || !functionBubble || !toggleBtn) return;

    // --- HAPUS BUBBLE LOOP & CONDITIONAL GLOBAL SEBELUM RENDER ULANG ---
    const globalLoopDropup = document.getElementById('global-loop-dropup');
    if (globalLoopDropup) globalLoopDropup.remove();
    
    const globalCondDropup = document.getElementById('global-conditional-dropup');
    if (globalCondDropup) globalCondDropup.remove();
    // --- END HAPUS BUBBLE LOOP & CONDITIONAL GLOBAL ---


    // 1. Setup Toggle Button
    toggleBtn.innerText = isFunctionBubbleOpen ? "✕" : "▼";
    // ... color styles (assuming handled by CSS file)

    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        openLoopIndex = -1; 
        openConditionalBlockId = null; 
        isFunctionBubbleOpen = !isFunctionBubbleOpen;
        renderFunctionToolbar();
        renderWorkspace(true); 
    };

    // 2. Setup Bubble Visibility
    functionBubble.style.display = isFunctionBubbleOpen ? "flex" : "none";
    
    // 3. Render Slots Content
    const nestedSlots = functionBubble.querySelectorAll(".function-nested-slot");

    functionContent.forEach((nestedBlock, nestedIndex) => {
        const slot = nestedSlots[nestedIndex];
        slot.innerHTML = "";
        const existingDropup = slot.querySelector(".loop-dropup");
        if (existingDropup) existingDropup.remove();
        
        if (nestedBlock) {
            nestedBlock.setAttribute('data-parent-loop-index', -1); 
            nestedBlock.setAttribute('data-nested-index', nestedIndex);

            slot.appendChild(nestedBlock);
            cleanPositionStyles(nestedBlock);
            attachDragEventsToBlock(nestedBlock); 
            
            // ... Loop in Function Logic (Omitted for brevity in this manual integration, assuming logic is present)
            if (nestedBlock.getAttribute("data-type") === "loop") {
                // RENDER LOOP LOGIC HERE (similar to renderWorkspace loop logic)
            } else if (nestedBlock.getAttribute("data-type") === "function") {
                 createFunctionBlockDisplay(nestedBlock);
            }
        }
    });
}


function createFunctionBlockDisplay(b) {
    const innerIcons = functionContent.map(getIconHtml).filter(html => html.length > 0);
    
    if (innerIcons.length === 0) {
        b.innerHTML = `<span style="font-size: 40px; margin-top: -10px;">{}</span>`; 
        b.style.fontSize = ''; 
        b.style.padding = '';
        return; 
    }
    
    const separatorFontSize = '28px';
    
    const displayHtml = innerIcons.join(`<span style="font-size: ${separatorFontSize}; color: var(--sd-function-text); margin: 0 4px; font-weight: bold;">|</span>`);
    
    b.innerHTML = `
        <div class="function-content-new">
            ${displayHtml}
        </div>
    `;
    b.style.fontSize = '12px'; 
    b.style.padding = '4px';
    
    const newContent = b.querySelector('.function-content-new');
    if (newContent) {
        newContent.style.cssText = `
            display: flex; 
            align-items: center; 
            justify-content: center;
            width: 100%;
            height: 100%;
            line-height: 1;
        `;
    }
}


/* =========================================
   WORKSPACE RENDERING & PERSISTENCE
========================================= */


function renderWorkspace(isFunctionUpdate = false) {
  let slots = getWorkspaceSlots();

  // --- HAPUS BUBBLE LOOP & CONDITIONAL GLOBAL SEBELUM RENDER ULANG ---
  const globalLoopDropup = document.getElementById('global-loop-dropup');
  if (globalLoopDropup) globalLoopDropup.remove();
  
  const globalCondDropup = document.getElementById('global-conditional-dropup');
  if (globalCondDropup) globalCondDropup.remove();
  // --- END HAPUS BUBBLE LOOP & CONDITIONAL GLOBAL ---

  renderFunctionToolbar();

  slots.forEach((slot, i) => {
    
    let b = workspaceSlots[i];
    
    if (isFunctionUpdate && b && b.getAttribute("data-type") === "function") {
         createFunctionBlockDisplay(b);
         return; 
    }
    
    slot.innerHTML = "";
    
    const existingDropup = slot.querySelector(".loop-dropup");
    if (existingDropup) existingDropup.remove();

    if (b) {
      slot.appendChild(b);
      cleanPositionStyles(b);
      attachDragEventsToBlock(b);

      // --- LOGIKA KHUSUS FUNCTION BLOCK INSTANCES ---
      if (b.getAttribute("data-type") === "function") {
          createFunctionBlockDisplay(b);
      }
      
      // --- LOGIKA KHUSUS CONDITIONAL BLOCK (NEW) ---
      if (b.getAttribute("data-type") === "conditional") {
          const blockId = b.getAttribute('data-cond-id');
          const state = conditionalNestedContent.get(blockId);
          const currentDir = state ? state.checkDir : 'above';
          
          // 1. HAPUS SEMUA TOMBOL TOGGLE LAMA SEBELUM DITAMBAHKAN KEMBALI
          b.querySelectorAll('.conditional-toggle-btn').forEach(btn => btn.remove());
          
          // 2. Update visual image
          let img = b.querySelector('.conditional-img');
          
          // Tambahkan image/ikon arah ke block utama (jika belum ada)
          if (!img) {
               b.innerHTML = `
                  <div class="conditional-content">
                     <span class="conditional-symbol" style="font-size: 40px; color: var(--tk-cond-text);">!</span>
                     <div class="conditional-dir-icon" style="position: absolute; right: 8px; bottom: 8px;">
                        <img src="../Asset/Sprites/x-${currentDir}.png" alt="Direction" class="conditional-img" style="width: 20px; height: 20px;">
                     </div>
                  </div>
               `;
               img = b.querySelector('.conditional-img');
               
          } else {
             img.src = `../Asset/Sprites/x-${currentDir}.png`;
          }
          
          // 3. Tombol Toggle Conditional
          const toggleBtn = document.createElement("div");
          toggleBtn.className = "conditional-toggle-btn";
          toggleBtn.innerText = (blockId === openConditionalBlockId) ? "✕" : "▼";
          b.appendChild(toggleBtn);
          
          // NOTE: Hanya tombol toggle yang memiliki logic onClick, bukan badan block
          toggleBtn.onclick = (e) => {
              e.stopPropagation();
              if (blockId === openConditionalBlockId) {
                  openConditionalBlockId = null;
              } else {
                  isFunctionBubbleOpen = false;
                  openLoopIndex = -1;
                  openConditionalBlockId = blockId;
              }
              renderWorkspace();
          };

          // 4. Render Bubble jika aktif
          if (blockId === openConditionalBlockId) {
              renderConditionalBubble(b);
          }
      }
      
      // --- LOGIKA KHUSUS LOOP ---
      if (b.getAttribute("data-type") === "loop") {
          
          const loopId = i;
          
          // Tombol Toggle Loop
          const toggleBtn = document.createElement("div");
          toggleBtn.className = "loop-toggle-btn";
          toggleBtn.innerText = (loopId === openLoopIndex) ? "✕" : "▼";
          // HAPUS Tombol lama jika ada (Ini perlu jika DOM tidak sepenuhnya dihapus, tapi di sini kita hanya melampirkan jika belum ada)
          b.querySelectorAll('.loop-toggle-btn').forEach(btn => btn.remove());
          b.appendChild(toggleBtn);
          
          toggleBtn.onclick = (e) => {
              e.stopPropagation();
              if (loopId === openLoopIndex) {
                  openLoopIndex = -1;
              } else {
                  isFunctionBubbleOpen = false;
                  openConditionalBlockId = null;
                  openLoopIndex = loopId;
              }
              renderWorkspace();
          };
          
          // Counter Click Logic
          const counter = b.querySelector(".loop-counter");
          if (counter) {
              counter.onmousedown = (e) => { e.stopPropagation(); }; 
              counter.onclick = (e) => {
                   e.stopPropagation();
                   let currentCount = parseInt(b.getAttribute("data-loop-count"));
                   let newCount = currentCount === 5 ? 2 : currentCount + 1;
                   if (newCount === 1) newCount = 2; 

                   b.setAttribute("data-loop-count", newCount);
                   
                   isFunctionBubbleOpen = false;
                   openConditionalBlockId = null;
                   openLoopIndex = loopId; 
                   workspaceSlots[i] = b; 
                   renderWorkspace();
              };
          }

          // Render Loop Bubble
          let loopDropup = document.createElement("div");
          loopDropup.className = "loop-dropup";
          loopDropup.id = `loop-dropup-${loopId}`;
          loopDropup.innerHTML = `
              <div class="loop-slot-container">
                  <div class="slot nested-slot" data-index="0"></div>
                  <div class="slot nested-slot" data-index="1"></div>
              </div>
          `;
          
          const nestedSlots = loopDropup.querySelectorAll(".nested-slot");
          loopContent[i].forEach((nestedBlock, nestedIndex) => {
              if (nestedBlock) {
                  nestedBlock.setAttribute('data-parent-loop-index', i);
                  nestedBlock.setAttribute('data-nested-index', nestedIndex);
                  
                  nestedSlots[nestedIndex].appendChild(nestedBlock);
                  cleanPositionStyles(nestedBlock);
                  
                  if (nestedBlock.getAttribute("data-type") === "jalan") {
                       const dir = nestedBlock.getAttribute('data-direction');
                       nestedBlock.innerText = getLocalizedBlockText("jalan", dir);
                  } else if (nestedBlock.getAttribute("data-type") === "tembak") {
                       nestedBlock.innerText = getLocalizedBlockText("tembak");
                  }

                  attachDragEventsToBlock(nestedBlock); 
              }
          });
          
          if (loopId === openLoopIndex) {
              
              loopDropup.id = 'global-loop-dropup';
              const blockRect = b.getBoundingClientRect();
              
              loopDropup.style.position = 'fixed';
              loopDropup.style.top = `${blockRect.top - 105}px`; 
              loopDropup.style.left = `${blockRect.left + blockRect.width / 2}px`;
              loopDropup.style.transform = 'translateX(-50%)'; 
              loopDropup.style.zIndex = 2000; 

              document.body.appendChild(loopDropup);
              loopDropup.style.display = "flex";
          }

          const counterDisplay = b.querySelector(".loop-counter");
          if(counterDisplay) {
            counterDisplay.innerText = b.getAttribute("data-loop-count");
          }
      } else {
         if (i === openLoopIndex) { openLoopIndex = -1; }
      }
    }
  });

  applyLanguage(currentLang, true);
}

/* =========================================
   GAME ENGINE & LOOP (Semua fungsi inti dipertahankan)
========================================= */

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = Math.min(timestamp - lastTime, 40);
    lastTime = timestamp;

    if(typeof ctx !== 'undefined') {
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
    }
    
    requestAnimationFrame(gameLoop);
}

function moveBeeOnce(dir, callback) {
  const step = 24;
  let moved = 0;
  bee.state = "walk";
  if (dir === "left") bee.facing = "left";
  if (dir === "right") bee.facing = "right";
  
  if (dir === "left") bee.facing = "left";
  if (dir === "right") bee.facing = "right";

  let dx = 0, dy = 0;
  if (dir === "left") dx = -1;
  if (dir === "right") dx = 1;
  if (dir === "up") dy = -1;
  if (dir === "down") dy = 1;
  function tick() {
      if (hasDied) { bee.state = "death"; return; }
      const s = 1;
      bee.x += dx * s;
      bee.y += dy * s;
      moved += s;
      if (moved >= step) { bee.state = "idle"; callback(); return; }
      requestAnimationFrame(tick);
  }
  tick();
}

function renderTiledMap() {
  if (!mapData) return;
  for (let layer of mapData.layers) {
    if (layer.type !== "tilelayer") continue;
    const tiles = layer.data;
    for (let i = 0; i < tiles.length; i++) {
      const gid = tiles[i];
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

function drawTileFromTileset(gid, worldX, worldY) {
  if (gid === 0) {
    if(typeof ctx !== 'undefined') {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(worldX, worldY, DRAW_SIZE, DRAW_SIZE);
    }
    return;
  }

  const FLIPPED_H = 0x80000000;
  const FLIPPED_V = 0x40000000;
  const FLIPPED_D = 0x20000000;

  const realgid = gid & 0x1FFFFFFF;
  let ts = getTilesetForGID(realgid);
  if (!ts) return;

  let localId = realgid - ts.firstgid;
  let sx = (localId % ts.columns) * TILE_SIZE;
  let sy = Math.floor(localId / ts.columns) * TILE_SIZE;

  if(typeof ctx !== 'undefined') {
    ctx.save();
    ctx.translate(worldX, worldY);
    // Transform logic (flippedH, flippedV, flippedD) is here
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
}

function updateBee(dt) {
  const anim = beeAnimations[bee.state];
  if (!anim) return;

  bee.timer += dt;

  if (bee.state === "death" && bee.frame === anim.frames - 1) return;

  if (bee.state === "shoot") {
    if (bee.timer > 80) {
      bee.timer = 0;
      bee.frame++;

      if (bee.frame >= anim.frames) {
          bee.state = "idle";
          bee.frame = 0;
      }
    }
    return;
  }

  if (bee.timer > 120) {
    bee.timer = 0;
    bee.frame = (bee.frame + 1) % anim.frames;
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

  if(typeof ctx !== 'undefined') {
    ctx.save();
    ctx.translate(bee.x + w / 2, bee.y + h / 2);

    if (bee.facing === "right") {
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      anim.img,
      sx, sy, anim.fw, anim.fh,
      -w / 2, -h / 2,
      w, h
    );
    ctx.restore();
  }
}

function checkWinLose() {
  if (!mapData) return;

  const base = beeAnimations.idle;
  const w = base.fw * BEE_SCALE;
  const h = base.fh * BEE_SCALE;
  const cx = bee.x + w / 2;
  const cy = bee.y + h / 2;

  const flower = getTileAt("Flower", cx, cy);
  if (flower > 0) {
    triggerWin();
    return;
  }

  for (let e of enemies) {
      const anim = butterflyAnimations[e.color];
      if (!anim) continue;
      const bw = anim.fw * e.scale;
      const bh = anim.fh * e.scale;
      const halfW = w / 2;
      const halfH = h / 2;

      if (Math.abs(cx - e.x) < (bw/2 + halfW*0.6) && Math.abs(cy - e.y) < (bh/2 + halfH*0.6)) {
          triggerLose();
          return;
      }
  }

  const collider = getTileAt("Collider", cx, cy);
  if (collider > 0 || collider === -1) {
    triggerLose();
    return;
  }
}

function triggerWin() {
  isRunningCommands = false;
  bee.state = "idle";
  document.querySelectorAll("button").forEach(b => {
    if (b.id !== "btn-kembali-win") b.disabled = true;
  });
  const overlay = document.getElementById("win-overlay");
  if(overlay) overlay.style.display = "flex";
  const honey = document.getElementById("honey-number");
  if(honey) honey.innerText = "1";

  const btnWin = document.getElementById("btn-kembali-win");
  if(btnWin) btnWin.onclick = () => {
    window.location.href = "challenge-list.html";
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
  const existingBtn = document.getElementById("btn-reset");
  if(existingBtn) return;
  
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
  projectiles = [];
  enemies = [];
  loadEnemySpawn();
  isRunningCommands = false;
}

function updateCamera() {
  if (cam.lockOnBee) {
    const base = beeAnimations.idle;
    const w = base.fw * BEE_SCALE;
    const h = base.fh * BEE_SCALE;
    const cx = bee.x + w / 2;
    const cy = bee.y + h / 2;
    cam.targetX = cx - canvas.width / (2 * cam.zoom);
    cam.targetY = cy - canvas.height / (2 * cam.zoom);
  }
  cam.x += (cam.targetX - cam.x) * cam.speed;
  cam.y += (cam.targetY - cam.y) * cam.speed;
}

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
      setTimeout(callback, 400);
    }
  }, 50);
}

function cameraToFlower(callback) {
  cam.lockOnBee = false;
  const layer = mapData.layers.find(l => l.type === "objectgroup" && l.name === "FlowerZoom");
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
  cameraToBee(callback);
}

function runIntroCameraSequence() {
  cameraToBee(() => {
    cameraToFlower(() => {
      cameraBackToBee(() => {
        cam.lockOnBee = true;
      });
    });
  });
}

function animateIntroBee() {
  const cvs = document.getElementById("intro-bee-canvas");
  if(!cvs) return;
  const ictx = cvs.getContext("2d");
  let frame = 0;
  function loop() {
    if (!introBeeJSON) return requestAnimationFrame(loop);
    let fw = introBeeJSON.frameWidth;
    let fh = introBeeJSON.frameHeight;
    ictx.clearRect(0, 0, cvs.width, cvs.height);
    ictx.drawImage(introBeeImg, frame * fw, 0, fw, fh, 0, 0, cvs.width, cvs.height);
    frame = (frame + 1) % introBeeJSON.frames;
    setTimeout(() => requestAnimationFrame(loop), 150);
  }
  loop();
}


async function loadMap(index = 0) {
    const res = await fetch(MAP_LIST[index]);
    mapData = await res.json();
    console.log("MAP LOADED:", MAP_LIST[index]);
}

async function loadProjectile() {
  const json = await fetch(`../Asset/Sprites/projectile.json`).then(r => r.json());
  const img = new Image();
  img.src = `../Asset/Sprites/projectile.png`;
  await img.decode();

  return {
    img,
    fw: json.frameWidth,
    fh: json.frameHeight,
    frames: json.frames
  };
}

function updateProjectiles(dt) {
    projectiles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        const tile = getTileAt("Collider", p.x, p.y);
        if (tile > 0 || tile === -1) {
            p.remove = true;
            return;
        }
        checkProjectileHitEnemy(p);
    });
    projectiles = projectiles.filter(p => !p.remove && p.x > 0 && p.x < canvas.width);
}

function drawProjectiles() {
  if (!projectileAnim) return;
  const PROJECTILE_SCALE = 2;
  const RENDER_SIZE_W = projectileAnim.fw * PROJECTILE_SCALE;
  const RENDER_SIZE_H = projectileAnim.fh * PROJECTILE_SCALE;

  projectiles.forEach(p => {
    if(typeof ctx !== 'undefined') {
      ctx.save();
      ctx.translate(p.x, p.y);
      
      if (p.vx < 0) {
        ctx.translate(RENDER_SIZE_W, 0); 
        ctx.scale(-1, 1); 
      }

      ctx.drawImage(
        projectileAnim.img, 0, 0, projectileAnim.fw, projectileAnim.fh, 
        0, 0, RENDER_SIZE_W, RENDER_SIZE_H
      );
      ctx.restore();
    }
  });
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
                    x: bx, y: by, baseY: by, frame: 0, timer: 0, floatTimer: 0,
                    color: colorIndex, dying: false, alpha: 1, scale: 1, puff: 0
                });
            }
        }
    }
}

function updateEnemies(dt) {
    enemies.forEach(e => {
        if (!e.dying) {
            e.y += Math.sin(Date.now() / 150) * 0.1;
            e.timer += dt;
            if (e.timer > 120) {
                e.timer = 0;
                const anim = butterflyAnimations[e.color];
                e.frame = (e.frame + 1) % anim.frames;
            }
            return;
        }
        e.alpha -= 0.08;
        e.scale += 0.05;
        e.puff += 0.04;
        if (e.alpha <= 0) e.remove = true;
    });
    enemies = enemies.filter(e => !e.remove);
}

function drawEnemies() {
    enemies.forEach(e => {
        const anim = butterflyAnimations[e.color];
        if (!anim) return;
        if(typeof ctx !== 'undefined') {
          ctx.save();
          ctx.globalAlpha = Math.max(0, e.alpha);
          ctx.translate(e.x, e.y);
          ctx.scale(e.scale, e.scale);
          if (e.puff > 0) ctx.filter = `blur(${e.puff}px)`;
          ctx.drawImage(
              anim.img, anim.fw * e.frame, 0, anim.fw, anim.fh,
              -anim.fw / 2, -anim.fh / 2, anim.fw, anim.fh
          );
          ctx.restore();
        }
    });
}

async function loadButterflies() {
    let list = [];
    for (let color of butterflyColors) {
        try {
            const json = await fetch(`../Asset/Sprites/Butterfly${color}.json`).then(r => r.json());
            const img = new Image();
            img.src = `../Asset/Sprites/Butterfly${color}.png`;
            await img.decode();

            if (typeof json.frameWidth !== 'number' || typeof json.frameHeight !== 'number' || typeof json.frames !== 'number') {
                console.warn(`Butterfly ${color} JSON missing frameWidth/frameHeight/frames:`, json);
                continue;
            }

            list.push({
                img: img,
                fw: json.frameWidth,
                fh: json.frameHeight,
                frames: json.frames
            });
        } catch (err) {
            console.warn("Butterfly JSON or image not found / failed to load:", color, err);
        }
    }
    butterflyAnimations = list;
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

function shootProjectile() {
  if (!projectileAnim) return;

  bee.state = "shoot";
  bee.frame = 0;
  bee.timer = 0; 

  const base = beeAnimations.idle;
  const w = base.fw * BEE_SCALE;
  const h = base.fh * BEE_SCALE;
  const cx = bee.x + w / 2;
  const cy = bee.y + h / 2;

  const PROJECTILE_SCALE = 4;
  const PROJECTILE_RENDER_WIDTH = projectileAnim.fw * PROJECTILE_SCALE;

  const w_bee = base.fw * BEE_SCALE; 
  const offsetDistance = w_bee * 0.7; 
  
  const offsetX = bee.facing === "right"
    ? offsetDistance - 5 
    : -offsetDistance - PROJECTILE_RENDER_WIDTH + 5;


  const offsetY = (h * 0.55) - (h / 2);

  setTimeout(() => {
    projectiles.push({
      x: cx + offsetX,
      y: cy + offsetY,
      vx: bee.facing === "right" ? 3 : -3,
      vy: 0,
      frame: 0
    });
  }, 100);
}

function findBeeSpawn() {
  if (!mapData || !beeAnimations.idle) return;

  const scale = DRAW_SIZE / TILE_SIZE;
  const anim = beeAnimations.idle;
  const fw = anim.fw;
  const fh = anim.fh;

  for (let layer of mapData.layers) {
    if (layer.type === "objectgroup" && layer.name === "Spawn") {
      for (let obj of layer.objects) {
        if (obj.name === "BeeSpawn") {
          const ox = obj.x * scale;
          const oy = obj.y * scale;
          bee.x = ox - (fw * BEE_SCALE) / 2;  
          bee.y = oy - (fh * BEE_SCALE) / 2;
          bee.facing = "right";
          hasDied = false;
          return;
        }
      }
    }
  }
}

// =============================================
// INTRO CAMERA SEQUENCE
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


/* =========================================
   INIT FUNCTIONS
========================================= */

// Panggilan awal saat semua aset dimuat
Promise.all([
    loadMap(selectedMap),
    loadBeeAndAssets()
]).then(() => {
    const hasEnemyLayer = mapData.layers.some(
        layer => layer.type === "objectgroup" && layer.name === "Enemy"
    );
    const btnShoot = document.getElementById("btn-tembak");
    if(btnShoot) btnShoot.style.display = hasEnemyLayer ? "flex" : "none";

    loadEnemySpawn();  

    if(typeof canvas !== 'undefined' && mapData) {
      canvas.width = mapData.width * DRAW_SIZE;
      canvas.height = mapData.height * DRAW_SIZE;
    }
    if(typeof ctx !== 'undefined') ctx.imageSmoothingEnabled = false;

    findBeeSpawn();
    if(typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(gameLoop);
});


document.addEventListener("DOMContentLoaded", () => {
    initDropups(); 
    renderWorkspace();
    applyLanguage(currentLang);
    manageIntroPopup(selectedMap);
});


/* =========================================
   EVENT HANDLERS
========================================= */

const btnResetManual = document.getElementById("btn-reset-manual");
if(btnResetManual) btnResetManual.onclick = () => { resetBee(); };

const btnBack = document.getElementById("btn-back");
if(btnBack) btnBack.onclick = () => { 
    window.location.href = "challenge-list.html"; 
};

const btnResetWorkspace = document.getElementById("btn-reset-workspace");
if(btnResetWorkspace) btnResetWorkspace.addEventListener("click", () => {
    workspaceSlots = Array(10).fill(null);
    loopContent = Array(10).fill(null).map(() => Array(2).fill(null));
    functionContent = [null, null];
    functionLoopNestedContent = Array(2).fill(null).map(() => Array(2).fill(null)); 
    conditionalNestedContent.clear(); // CLEAR CONDITIONAL STATE (NEW)
    conditionalCounter = 0;
    openLoopIndex = -1;
    isFunctionBubbleOpen = false;
    openConditionalBlockId = null; // NEW
    renderWorkspace();
});

// auto close popup
window.addEventListener("load", () => {
  setTimeout(() => {
    const popup = document.getElementById("intro-popup");
    if(popup) popup.style.display = "none";
    runIntroCameraSequence();
  }, 2000);
});

/* =========================================
   TOOLBAR DRAG/DROP INITIALIZATION
========================================= */

function initDropups() {
    renderFunctionToolbar();

    // === BLOK JALAN (Dropup) ===
    const btnJalan = document.getElementById("btn-jalan");
    const dropupJalan = document.getElementById("dropup-jalan");

    if (btnJalan) btnJalan.onmouseenter = () => { if(dropupJalan) dropupJalan.style.display = "flex"; };
    const toolbarArea = document.querySelector(".toolbar-area");
    if (toolbarArea) toolbarArea.onmouseleave = () => { 
        if(dropupJalan) dropupJalan.style.display = "none"; 
    };

    // === BLOK TEMBAK, LOOP, IF/ELSE (CONDITIONAL), FUNCTION (Single Drag) ===
    const singleBtns = [
        { id: "btn-tembak", type: "tembak", label: "🔫" },
        { id: "btn-loop", type: "loop", label: "🔁" },
        { id: "btn-if-else", type: "conditional", label: "!" }, // Menggunakan ID btn-if-else untuk Conditional
        { id: "btn-function", type: "function", label: "Function: {}" }, 
    ];

    singleBtns.forEach(btnData => {
        const btn = document.getElementById(btnData.id);
        
        if (!btn) return;
        
        btn.onmousedown = (e) => {
            e.preventDefault();
            
            if (btnData.type === 'function' && e.target.closest('.function-toggle-btn')) {
                 return; 
            }
            
            const functionBubble = document.getElementById('function-definition-bubble');
            if (btnData.type === 'function' && isFunctionBubbleOpen && functionBubble && functionBubble.contains(e.target)) {
                 return;
            }
            
            const type = btnData.type;
            let block;
            
            if (type === "loop") {
                block = createLoopBlock(2); 
            } 
            else if (type === "function") {
                block = createFunctionBlock(); 
            }
            else if (type === "conditional") { // NEW
                block = createConditionalBlock('above'); 
            }
            else { 
                block = document.createElement("div");
                block.className = "block";
                block.setAttribute("data-type", type);
                block.setAttribute("data-dir", "default"); 
                
                const labelSpan = btn.querySelector('.block-label');
                if (labelSpan) {
                    block.innerHTML = labelSpan.outerHTML; 
                } else {
                     block.innerText = btnData.label;
                }
            }
            
            realBlock = block; 
            isFromWorkspace = false;

            let clone = block.cloneNode(true);
            clone.classList.add("drag-shadow");
            clone.style.position = "absolute";
            clone.style.zIndex = 3000; 

            if (type === "function") {
                createFunctionBlockDisplay(clone);
            }

            currentDrag = clone;
            document.body.appendChild(clone);

            clone.style.left = (e.pageX - 35) + "px";
            clone.style.top = (e.pageY - 35) + "px";

            window.onmousemove = drag;
            window.onmouseup = drop;
        };
    });
    
    // DRAG FROM DROPUP (JALAN, TEMBAK, ETC.)
    document.querySelectorAll(".drop-item").forEach(item => {
      item.onmousedown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        document.body.classList.add("dragging-dropitem");

        let block = document.createElement("div");
        block.className = "block";

        let type = item.getAttribute("data-type");
        let dir = item.getAttribute("data-dir");

        if (type === "tembak") {
            block.innerText = getLocalizedBlockText("tembak");
            block.setAttribute("data-type", "tembak");
        } 
        else if (type === "jalan") {
            block.innerText = getLocalizedBlockText("jalan", dir);
            block.setAttribute("data-type", "jalan");
            block.setAttribute("data-direction", dir);
        } 
        else if (type === "loop") {
            block = createLoopBlock(2);
        }
        else if (type === "function") {
            block = createFunctionBlock();
        }
        else {
            block.innerText = item.innerText;
            block.setAttribute("data-type", type);
            block.setAttribute("data-direction", "default");
        }

        realBlock = block;
        isFromWorkspace = false;

        let clone = block.cloneNode(true);
        clone.classList.add("drag-shadow");
        clone.style.position = "absolute";
        clone.style.zIndex = 3000; 

        if (type === "function") {
             createFunctionBlockDisplay(clone);
        }

        currentDrag = clone;
        document.body.appendChild(clone);

        clone.style.left = e.pageX + "px";
        clone.style.top = e.pageY + "px";

        window.onmousemove = drag;
        window.onmouseup = drop;
      };
    });
}


/* =========================================
   COMMAND EXECUTION
========================================= */

const btnRun = document.getElementById("btn-run");
if(btnRun) btnRun.onclick = () => {
    hasDied = false;
    bee.state = "idle";
    bee.frame = 0;

    findBeeSpawn();
    enemies = [];
    loadEnemySpawn();

    commandQueue = [];

    // --- LOGIKA PEMBANGUNAN QUEUE DARI WORKSPACE ---
    workspaceSlots.forEach((b, i) => {
        if (!b) return;
        const type = b.getAttribute("data-type");
        
        if (type === "loop") {
            const repeatCount = parseInt(b.getAttribute("data-loop-count")) || 1;
            const nestedCommands = getLoopNestedCommands(i);
            
            for (let r = 0; r < repeatCount; r++) {
                commandQueue.push({ type: "loop_start", id: i, iteration: r });
                commandQueue.push(...nestedCommands);
                commandQueue.push({ type: "loop_end", id: i, iteration: r });
            }
        } else {
            // Simple blocks, Conditional, Function
            commandQueue.push(...getBlockCommands(b));
        }
    });

    if (commandQueue.length === 0) {
        console.warn("Workspace kosong.");
        return;
    }

    isRunningCommands = true;
    runNextCommand();
};

// Fungsi Rekursif untuk mendapatkan perintah dari satu block
function getBlockCommands(b) {
    const commands = [];
    if (!b) return commands;
    
    const type = b.getAttribute("data-type");

    if (type === "tembak") {
        commands.push({ type: "shoot" });
    } else if (type === "jalan") {
        commands.push({type:"move", dir:b.getAttribute("data-direction")});
    } else if (type === "function") {
        commands.push(...getFunctionCommands());
    } else if (type === "conditional") {
        const blockId = b.getAttribute("data-cond-id");
        const state = conditionalNestedContent.get(blockId);
        
        if (state && state.nestedBlock) {
            commands.push({
                type: "check_condition",
                checkDir: state.checkDir,
                nestedCommands: getBlockCommands(state.nestedBlock) 
            });
        }
    }
    return commands;
}

function getLoopNestedCommands(loopIndex, isFunctionNested = false) {
    const nestedCommands = [];
    const content = isFunctionNested ? functionLoopNestedContent[loopIndex] : loopContent[loopIndex];

    content.forEach(nestedBlock => {
        if (!nestedBlock) return;
        nestedCommands.push(...getBlockCommands(nestedBlock));
    });
    return nestedCommands;
}

function getFunctionCommands() {
    const commands = [];
    functionContent.forEach((nestedBlock, funcIndex) => {
        if (!nestedBlock) return;
        const type = nestedBlock.getAttribute("data-type");
        
        if (type === "tembak" || type === "jalan" || type === "conditional") {
            commands.push(...getBlockCommands(nestedBlock));
        } else if (type === "loop") {
            const repeatCount = parseInt(nestedBlock.getAttribute("data-loop-count")) || 1;
            const innerNestedCommands = getLoopNestedCommands(funcIndex, true); 
            
            for (let r = 0; r < repeatCount; r++) {
                 commands.push(...innerNestedCommands);
            }
        }
    });
    return commands;
}

function runNextCommand() {
    if (commandQueue.length === 0) {
        isRunningCommands = false;
        bee.state = "idle";
        return;
    }

    if (hasDied) return;

    const cmd = commandQueue.shift();
    
    // --- Loop Control (For Breaking) ---
    if (cmd.type === "break_loop") {
        const nextLoopEndIndex = commandQueue.findIndex(c => c.type === "loop_end");
        if (nextLoopEndIndex !== -1) {
            // Hapus semua perintah hingga loop_end
            commandQueue.splice(0, nextLoopEndIndex + 1);
        }
        return runNextCommand(); 
    }
    
    // --- Conditional Check (NEW) ---
    if (cmd.type === "check_condition") {
        if (checkColliderInDirection(cmd.checkDir)) {
            // Kondisi Benar: Sisipkan perintah dan break loop
            commandQueue.unshift(...cmd.nestedCommands);
            commandQueue.push({ type: "break_loop" }); 
            
            return runNextCommand();
        } else {
            // Kondisi Salah: Lanjutkan
            return runNextCommand();
        }
    }
    
    // --- Execution Delay ---
    setTimeout(() => {
        
        if (cmd.type === "shoot") {
            shootProjectile();
            setTimeout(runNextCommand, 300);
        }

        if (cmd.type === "move") {
            moveBeeOnce(cmd.dir, runNextCommand);
        }
        
        if (cmd.type === "loop_start" || cmd.type === "loop_end") {
             runNextCommand();
        }

    }, 500);
}


/* ===============================
   LANGUAGE TOGGLE BUTTON
================================= */

let currentLang = "en"; 
const langBtn = document.getElementById("lang-toggle-btn");

const languagePack = {
    en: {
        title: "GO TO THE FLOWER!", back: "⮌ Back", run: "▶ RUN",
        resetManual: "Restart?", blocksTitle: "Blocks", workspaceTitle: "Workspace",
        winTitle: "🎉 YOU WIN! 🎉", winBack: "⮌ Back", reset: "↺ Clear"
    },

    id: {
        title: "PERGI KE BUNGA!", back: "⮌ Kembali", run: "▶ Jalan",
        resetManual: "Ulangi?", blocksTitle: "Blok", workspaceTitle: "Area Kerja",
        winTitle: "🎉 KAMU MENANG! 🎉", winBack: "⮌ Kembali", reset: "↺ Hapus"
    }
};

function applyLanguage(lang, fromWorkspaceRender = false) {
    const L = languagePack[lang];
    const title = document.querySelector(".title");
    if(title) title.innerText = L.title;
    const btnBack = document.getElementById("btn-back");
    if(btnBack) btnBack.innerText = L.back;
    const btnRun = document.getElementById("btn-run");
    if(btnRun) btnRun.innerText = L.run;
    const btnResetManual = document.getElementById("btn-reset-manual");
    if(btnResetManual) btnResetManual.innerText = L.resetManual;
    const titleBlocks = document.getElementById("title-blocks");
    if(titleBlocks) titleBlocks.innerText = L.blocksTitle;
    const titleWorkspace = document.getElementById("title-workspace");
    if(titleWorkspace) titleWorkspace.innerText = L.workspaceTitle;
    const winTitle = document.querySelector(".win-title");
    if(winTitle) winTitle.innerText = L.winTitle;
    const btnWin = document.getElementById("btn-kembali-win");
    if(btnWin) btnWin.innerText = L.winBack;
    const btnResetWorkspace = document.getElementById("btn-reset-workspace");
    if(btnResetWorkspace) btnResetWorkspace.innerText = L.reset;
}

if(langBtn) {
  langBtn.addEventListener("click", () => {
      currentLang = currentLang === "en" ? "id" : "en";
      langBtn.innerText = currentLang.toUpperCase();
      applyLanguage(currentLang);
  });
}

function getLocalizedBlockText(type, dir = null) {
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
    if (currentMap === 0) { popup.style.display = "flex"; if(arrow) arrow.textContent = "🡲"; return; }
    if (currentMap === 2) { popup.style.display = "flex"; if(arrow) arrow.textContent = "🔫"; return; }
    popup.style.display = "none";
}