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

/* =========================================
   WORKFLOW STATE & HELPERS
========================================= */

let currentDrag = null;
let realBlock = null;
let isFromWorkspace = false;
let originalSlotIndex = null; // Index slot utama (Loop parent jika nested)
let isMovingLoop = false; 
let originalNestedIndex = null; // Index slot nested (jika ditarik dari nested)

let workspaceSlots = Array(10).fill(null);
let loopContent = Array(10).fill(null).map(() => Array(2).fill(null)); 
let openLoopIndex = -1; // Index slot Loop yang sedang terbuka

// --- FUNCTION DEFINITION STATE ---
// Function definition block di toolbar
let functionBlockDef = null; 
// Isi (content) dari function, global state yang digunakan semua instance.
let functionContent = [null, null]; 
let isFunctionBubbleOpen = false; 
// Menyimpan isi Loop yang ada di dalam Function Definition (Visual Persistence)
let functionLoopNestedContent = Array(2).fill(null).map(() => Array(2).fill(null)); 
// -----------------------------------

let realBlockDetached = false;

function getWorkspaceSlots() {
  // Hanya mencari di slot utama workspace
  return [...document.querySelectorAll(".workspace-area > .workspace-scroll > .slot")];
}

function getSlotIndex(slot) {
  // Hanya mencari di slot utama workspace
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

  // --- 1. Mencari slot terbaik di slot utama (Priority 1) ---
  document.querySelectorAll(".workspace-area > .workspace-scroll > .slot").forEach(slot => {
    let ov = getOverlap(block, slot);
    if (ov > bestVal && ov > 0.5) {
      bestVal = ov;
      best = slot;
    }
  });

  // --- 2. Mencari slot terbaik di nested slots (Priority 2) ---
  // Kita biarkan semua block memiliki peluang overlap di sini, pembatasan di drop()
  
  // 2a. Nested Loop Slots
  if (openLoopIndex !== -1) {
    const activeBubble = document.getElementById('global-loop-dropup');
    if (activeBubble) {
        // FIX BUG 2b: Memperoleh drag masuk loop meskipun block yang ada di slot adalah block lain.
        activeBubble.querySelectorAll(".nested-slot").forEach(nestedSlot => {
          let ov = getOverlap(block, nestedSlot);
          // Menggunakan overlap 0.7 untuk prioritas tinggi
          if (ov > bestVal && ov > 0.7) { 
              bestVal = ov;
              best = nestedSlot;
          }
        });
    }
  }
  
  // 2b. Nested Function Definition Slots (Hanya di Toolbar)
  const functionBubble = document.getElementById('function-definition-bubble');
  if (isFunctionBubbleOpen && functionBubble) {
      functionBubble.querySelectorAll(".function-nested-slot").forEach(nestedSlot => {
        let ov = getOverlap(block, nestedSlot);
        if (ov > bestVal && ov > 0.5) { 
            bestVal = ov;
            best = nestedSlot;
        }
      });
  }
  
  return best;
}

/**
 * Membersihkan style posisi inline yang tersisa dari operasi drag.
 * Memastikan block kembali menjadi elemen flow biasa agar dapat di-center oleh Flexbox.
 * @param {HTMLElement} element 
 */
function cleanPositionStyles(element) {
    if (element && element.style) {
        // Hapus properti posisi inline yang tersisa dari operasi drag.
        element.style.removeProperty('position');
        element.style.removeProperty('left');
        element.style.removeProperty('top');
        
        // Pembersihan gaya total yang paling agresif
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
    // Inner HTML akan di-update oleh renderWorkspace
    block.innerHTML = `Function: {}`; 
    return block;
}

/**
 * Membuat representasi visual untuk blok di dalam function block
 * @param {HTMLElement} sourceBlock 
 * @returns {string} HTML string untuk icon
 */
function getIconHtml(sourceBlock) {
    if (!sourceBlock) return '';
    const type = sourceBlock.getAttribute('data-type');
    
    // Check if the block is a complex type that needs different rendering logic
    // Menggunakan font size 28px (Sesuai penyesuaian terbaru)
    const iconFontSize = '28px'; 
    
    if (type === 'loop') {
         // Loop blocks are now allowed inside function content
         return `<span style="font-size: ${iconFontSize}; color: #3a3ad0;">🔁</span>`;
    }
    
    if (type === 'jalan') {
        const dir = sourceBlock.getAttribute('data-direction');
        const icon = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
        return `<span style="font-size: ${iconFontSize}; color: var(--tk-brown);">${icon}</span>`; 
    }
    if (type === 'tembak') {
        return `<span style="font-size: ${iconFontSize}; color: var(--tk-brown);">🔫</span>`; 
    }
    // Function Call inside Loop/Function (re-nesting is allowed for calls)
    if (type === 'function') {
         return `<span style="font-size: ${iconFontSize}; color: var(--tk-function-text);">{}</span>`;
    }
    return '';
}


/* =========================================
   DRAG AND DROP HANDLERS
========================================= */

function attachDragEventsToBlock(block) {
  block.onmousedown = (e) => {
    e.preventDefault();
    e.stopPropagation(); // FIX UTAMA: Mencegah event bubbling ke elemen induk (Function Button) yang salah.

    // Check if the click originated from control buttons
    // FIX BUG 2: Mencegah drag jika klik berasal dari counter loop atau tombol toggle
    if (e.target.closest('.loop-counter') || e.target.closest('.loop-toggle-btn') || e.target.closest('.function-toggle-btn')) return; 

    isFromWorkspace = block.closest(".workspace-area") !== null;
    isMovingLoop = block.getAttribute("data-type") === "loop" && isFromWorkspace; 
    
    const isNestedDrag = block.closest('.nested-slot') !== null || block.closest('.function-nested-slot') !== null;
    
    // Reset index nested
    originalNestedIndex = null;
    
    // --- State preparation based on drag origin ---
    let dragAborted = false;
    
    if (isNestedDrag) {
        // Drag dari NESTED SLOT (Loop atau Function)
        
        const isFromFunction = block.closest('.function-nested-slot') !== null;
        
        if (isFromFunction) {
            // Drag dari Function Definition Slot
            originalSlotIndex = -1; // Flag: Function Global
            originalNestedIndex = parseInt(block.getAttribute('data-nested-index'));
            
            // --- Validasi dan Fallback untuk Function Block ---
            // Cek cepat dari atribut DOM
            let isValidIndex = !isNaN(originalNestedIndex) && originalNestedIndex >= 0 && originalNestedIndex < functionContent.length;
            
            if (!isValidIndex) {
                 // Fallback: Cari di state array (Mengatasi referensi yang hilang - PRIORITAS UNTUK BUG 1)
                 let found = false;
                 for (let i = 0; i < functionContent.length; i++) {
                     if (functionContent[i] === block) { // Find by object reference
                         originalNestedIndex = i;
                         isValidIndex = true;
                         found = true;
                         break;
                     }
                 }
                 if (!found) {
                     console.error("[CRITICAL ERROR] Nested Function block has inconsistent state/index. Aborting drag and forcing render.");
                     dragAborted = true;
                     // Defensive flush: Rerender immediately to fix state mismatch
                     renderWorkspace(); 
                 }
            }
            
            if (!dragAborted) {
                // Clear the function content state (Hapus dari state saat mousedown)
                // Cek apakah blok yang ditarik adalah Loop yang memiliki anak (dari functionLoopNestedContent)
                if (functionContent[originalNestedIndex] && functionContent[originalNestedIndex].getAttribute('data-type') === 'loop') {
                    // Jika Loop ditarik keluar, anak-anaknya juga dihapus
                    functionLoopNestedContent[originalNestedIndex] = Array(2).fill(null);
                }

                functionContent[originalNestedIndex] = null; 
                console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari functionContent[${originalNestedIndex}].`);
                block.setAttribute('data-is-nested', 'true');
            }
            
        } else {
            // Drag dari Loop Nested Slot (Function Loop atau Workspace Loop)

            const parentLoopId = block.getAttribute('data-parent-loop-index');
            originalNestedIndex = parseInt(block.getAttribute('data-nested-index')); 

            // Kasus 1: Drag dari Loop dalam Function
            if (typeof parentLoopId === 'string' && parentLoopId.startsWith('nested-f')) {
                 const funcNestedIndex = parseInt(parentLoopId.replace('nested-f', ''));
                 originalSlotIndex = parentLoopId; // Simpan ID string sebagai index parent

                 if (!isNaN(originalNestedIndex) && functionLoopNestedContent[funcNestedIndex] && originalNestedIndex >= 0) {
                     functionLoopNestedContent[funcNestedIndex][originalNestedIndex] = null;
                     console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari functionLoopNestedContent[${funcNestedIndex}][${originalNestedIndex}].`);
                 } else {
                     console.error("[CRITICAL ERROR] Nested Function Loop block has inconsistent state/indices. Aborting drag.");
                     dragAborted = true;
                     renderWorkspace();
                 }

            } 
            // Kasus 2: Drag dari Loop dalam Workspace (Integer Index)
            else {
                 originalSlotIndex = parseInt(parentLoopId);
                 
                 // --- Validasi dan Fallback untuk Loop Nested Block ---
                 let isValidIndex = !isNaN(originalSlotIndex) && originalSlotIndex >= 0 && originalSlotIndex < loopContent.length &&
                                    !isNaN(originalNestedIndex) && originalNestedIndex >= 0 && originalNestedIndex < (loopContent[originalSlotIndex] ? loopContent[originalSlotIndex].length : 0);
                 
                 if (!isValidIndex) {
                     // Fallback/Error handling (seperti sebelumnya)
                     let found = false;
                     for (let i = 0; i < loopContent.length; i++) {
                         const nested = loopContent[i];
                         if (nested) {
                             const idx = nested.indexOf(block); 
                             if (idx !== -1) {
                                 originalSlotIndex = i;
                                 originalNestedIndex = idx;
                                 found = true;
                                 break;
                             }
                         }
                     }
                     if (!found) {
                         console.error("[CRITICAL ERROR] Nested Loop block has inconsistent state/indices. Aborting drag and forcing render.");
                         dragAborted = true;
                         renderWorkspace();
                     }
                 }
                 
                 if (!dragAborted) {
                      loopContent[originalSlotIndex][originalNestedIndex] = null;
                      console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari loopContent[${originalSlotIndex}][${originalNestedIndex}].`);
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
        
        // Tutup bubble jika terbuka (Hanya jika drag BUKAN dari dalam bubble)
        if (openLoopIndex !== -1 && isFromWorkspace) {
            openLoopIndex = -1;
        }
        
        // Function bubble ditutup jika drag BUKAN dari dalam function bubble
        if (isFunctionBubbleOpen) {
            isFunctionBubbleOpen = false;
        }
        
        if (isFromWorkspace) {
            // Block ditarik dari SLOT UTAMA
            const parentSlot = block.closest(".slot");
            originalSlotIndex = getSlotIndex(parentSlot);
            block.removeAttribute('data-is-nested');
            
            // Hapus isi loop juga jika Loop ditarik keluar
            if (block.getAttribute('data-type') === 'loop') {
                loopContent[originalSlotIndex] = Array(2).fill(null);
            }

            // Clear the main workspace slot array immediately.
            workspaceSlots[originalSlotIndex] = null; 
            console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari workspaceSlots[${originalSlotIndex}].`);
        }
    }


    realBlock = block;

    // Lakukan penghapusan dari DOM HANYA setelah drag tidak di-abort
    if (block.parentElement) {
      // Hapus elemen dari DOM
      block.parentElement.removeChild(block);
      realBlockDetached = true;
    }

    let clone = block.cloneNode(true);
    clone.classList.add("drag-shadow");
    clone.style.position = "absolute";
    clone.style.zIndex = 3000; 

    currentDrag = clone;
    document.body.appendChild(clone);

    // Geser clone agar pusatnya berada di sekitar kursor
    clone.style.left = (e.pageX - 35) + "px";
    clone.style.top = (e.pageY - 35) + "px";

    window.onmousemove = drag;
    window.onmouseup = drop;
  };
}

function drag(e) {
  if (!currentDrag) return;
  // Geser clone agar pusatnya berada di sekitar kursor
  currentDrag.style.left = (e.pageX - 35) + "px";
  currentDrag.style.top = (e.pageY - 35) + "px";
  highlightSlots(currentDrag);
}

function drop() {
  if (!currentDrag) return;

  const target = getBestSlot(currentDrag);
  const blockToPlace = realBlock;
  let shouldRender = false;
  
  // Ambil state openLoopIndex saat ini, yang mungkin dipertahankan
  let newOpenLoopIndex = openLoopIndex; 
  let wasNestedDrag = blockToPlace.hasAttribute('data-is-nested');
  let placedInFunction = false; // Flag untuk menentukan apakah diletakkan di slot Function

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

      if (isLoopNestedTarget || isFunctionNestedTarget) {
          
          // --- CONSTRAINT CHECK ---
          
          // REJECT: Function cannot be nested inside its own definition (Recursion)
          if (isFunctionNestedTarget && blockToPlace.getAttribute("data-type") === "function") {
             shouldRender = wasNestedDrag || isFromWorkspace;
          } 
          
          // REJECT: Loop cannot be nested inside Loop (structural complexity)
          else if (isLoopNestedTarget && blockToPlace.getAttribute("data-type") === "loop") {
             shouldRender = wasNestedDrag || isFromWorkspace;
          }
          
          // --- PLACEMENT LOGIC ---
          else if (isFunctionNestedTarget) {
              // Drop berhasil ke NESTED SLOT FUNCTION DEFINITION (TOOLBAR)
              const nestedIndex = parseInt(target.getAttribute("data-index"));
              const existingNestedBlock = functionContent[nestedIndex];

              // Jika blok yang ditimpa adalah Loop, hapus juga isi Loop-nya
              if (existingNestedBlock && existingNestedBlock.getAttribute('data-type') === 'loop') {
                  functionLoopNestedContent[nestedIndex] = Array(2).fill(null);
              }
              
              // Swap Logic: Jika slot function sudah terisi, kembalikan block lama ke slot asalnya
              if (existingNestedBlock) {
                  if (wasNestedDrag) {
                       if (originalSlotIndex === -1) { // Asal dari Function (Slot Function Definition)
                           // Jika asal dari Loop Function, kita perlu tahu Loop mana yang jadi induk
                           if (typeof originalSlotIndex === 'string' && String(originalSlotIndex).startsWith('nested-f')) {
                               const funcNestedIndex = parseInt(originalSlotIndex.replace('nested-f', ''));
                               functionLoopNestedContent[funcNestedIndex][originalNestedIndex] = existingNestedBlock;
                           } else {
                               functionContent[originalNestedIndex] = existingNestedBlock;
                           }
                       } else if (originalSlotIndex !== null && originalSlotIndex !== -1) { // Asal dari Loop Workspace
                           loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                       }
                  } else if (isFromWorkspace && originalSlotIndex !== null) {
                       workspaceSlots[originalSlotIndex] = existingNestedBlock;
                  }
              }

              // Simpan Block ke Function Definition Slot
              functionContent[nestedIndex] = blockToPlace;
              
              // Jika block yang diletakkan adalah Loop, buka bubble-nya (Function Loop ID)
              if (blockToPlace.getAttribute("data-type") === "loop") {
                  newOpenLoopIndex = `nested-f${nestedIndex}`;
              } else {
                  // Pastikan loop bubble ditutup jika block non-loop diletakkan
                  if (typeof openLoopIndex === 'string' && openLoopIndex.startsWith('nested-f')) {
                       newOpenLoopIndex = -1;
                  }
              }

              isFunctionBubbleOpen = true; // Pertahankan bubble terbuka
              placedInFunction = true;
              shouldRender = true;

          }
          
          else if (isLoopNestedTarget) {
              // Drop berhasil ke NESTED SLOT LOOP (Workspace Loop atau Function-Nested Loop)
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
                                } else if (typeof originalSlotIndex === 'string' && String(originalSlotIndex).startsWith('nested-f')) { // Asal dari Loop Function
                                    const origFuncIndex = parseInt(originalSlotIndex.replace('nested-f', ''));
                                    functionLoopNestedContent[origFuncIndex][originalNestedIndex] = existingNestedBlock;
                                } else if (originalSlotIndex !== null) {
                                    loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                                }
                           } else if (isFromWorkspace && originalSlotIndex !== null) {
                               workspaceSlots[originalSlotIndex] = existingNestedBlock;
                           }
                       }
                       
                       functionLoopNestedContent[funcNestedIndex][nestedIndex] = blockToPlace;
                       
                       console.log(`[DEBUG] Block ${blockToPlace.getAttribute('data-type')} disimpan ke functionLoopNestedContent[${funcNestedIndex}][${nestedIndex}].`);

                       isFunctionBubbleOpen = true; 
                       
                       newOpenLoopIndex = parentLoopId;
                       shouldRender = true;
                       
                  } else {
                      const existingNestedBlock = loopContent[parentLoopId][nestedIndex];

                      // Swap Logic: Jika slot nested sudah terisi, kembalikan ke slot asal
                      if (existingNestedBlock) {
                           if (wasNestedDrag) {
                                if (originalSlotIndex === -1) { // Asal dari Function
                                    functionContent[originalNestedIndex] = existingNestedBlock;
                                } else if (originalSlotIndex !== null && originalSlotIndex !== -1) { // Asal dari Loop Workspace
                                    loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                                }
                           } else if (isFromWorkspace && originalSlotIndex !== null) {
                               workspaceSlots[originalSlotIndex] = existingNestedBlock;
                           }
                      }
                      
                      // Simpan Block ke Loop Nested Slot Baru
                      // NOTE: parentLoopId di sini adalah integer 
                      loopContent[parentLoopId][nestedIndex] = blockToPlace;
                      newOpenLoopIndex = parentLoopId; // Pertahankan loop bubble terbuka
                      shouldRender = true;
                  }
              } else {
                  // Fallback jika parentLoopId tidak valid (seharusnya tidak terjadi jika target adalah nested-slot)
                  shouldRender = wasNestedDrag || isFromWorkspace;
              }
          }
          
      } else {
          // Drop berhasil ke SLOT UTAMA (Main Workspace)
          const targetIndex = getSlotIndex(target);
          const existingTargetBlock = workspaceSlots[targetIndex];
          
          if (isFromWorkspace) {
            // Skenario 1: Main Slot ke Main Slot (Swap normal)
            if (!wasNestedDrag && originalSlotIndex !== null && originalSlotIndex !== targetIndex && existingTargetBlock) {
                 if (existingTargetBlock.getAttribute("data-type") === "loop") {
                      loopContent[originalSlotIndex] = loopContent[targetIndex];
                  }
                  
                  workspaceSlots[originalSlotIndex] = existingTargetBlock;
                  if (newOpenLoopIndex === targetIndex) newOpenLoopIndex = originalSlotIndex;
            }
            // Skenario 2: Nested Slot (Loop/Function) ke Main Slot (Hapus block lama jika ada)
            // (Blok yang datang dari nested drag akan menimpa block di workspace, dan block lama dibuang)
            else if (wasNestedDrag && existingTargetBlock) {
                if (existingTargetBlock.getAttribute("data-type") === "loop") {
                    loopContent[targetIndex] = Array(2).fill(null);
                }
            }
            
            // Hapus penanda nested jika berhasil di drop ke main slot
            if (wasNestedDrag) {
                 blockToPlace.removeAttribute('data-is-nested');
            }
          }
          
          // Skenario 3: Drag dari Toolbar atau menimpa Block/Loop yang sudah ada
          if (existingTargetBlock && blockToPlace.getAttribute("data-type") === "loop") {
             loopContent[targetIndex] = Array(2).fill(null);
          }
            
          // Lakukan penempatan blok baru ke slot target
          workspaceSlots[targetIndex] = blockToPlace;
          
          // Memindahkan konten Loop
          if (isFromWorkspace && !wasNestedDrag && blockToPlace.getAttribute('data-type') === 'loop' && originalSlotIndex !== null) {
              if (originalSlotIndex !== targetIndex) {
                  loopContent[targetIndex] = loopContent[originalSlotIndex];
                  loopContent[originalSlotIndex] = Array(2).fill(null);
              }
          }
          
          // Jika block yang diletakkan adalah Loop, buka bubble-nya
          newOpenLoopIndex = (blockToPlace.getAttribute("data-type") === "loop") ? targetIndex : -1;
          shouldRender = true;
      }

  } else {
      // Drop gagal (dilepas di luar slot - Penghapusan atau Snap Back)
      
      // FIX BUG 1/2a/3: Jika berasal dari drag BERSARANG (NESTED DRAG) dan tidak ada target, block dihapus (TRASH)
      if (wasNestedDrag) {
          shouldRender = true; // Perlu render untuk mengupdate bubble yang kosong.
          
          // Pertahankan bubble terbuka
          if (originalSlotIndex === -1) { // Asal Function
              isFunctionBubbleOpen = true;
          } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'number') { // Asal Loop Workspace
              newOpenLoopIndex = originalSlotIndex; 
          } else if (originalSlotIndex !== null && typeof originalSlotIndex === 'string') { // Asal Loop Function
             isFunctionBubbleOpen = true;
             newOpenLoopIndex = originalSlotIndex;
          }
          
          blockToPlace.removeAttribute('data-is-nested');
          
      } 
      // JIKA BUKAN nested drag, dan berasal dari workspace utama
      else if (isFromWorkspace) {
          // Block dari workspace utama DIBUANG.
          shouldRender = true; 
          // Jika block Loop dibuang, pastikan konten loop-nya juga terhapus.
          if (realBlock.getAttribute('data-type') === 'loop' && originalSlotIndex !== null) {
             loopContent[originalSlotIndex] = Array(2).fill(null);
          }
      }
      
      // Hapus visual block yang melayang (clone) dari DOM
      if (realBlock && realBlock.parentNode === document.body) {
           realBlock.remove();
      }
  }
  
  // 3. Final State Reset & Render
  openLoopIndex = newOpenLoopIndex; // Terapkan status loop bubble baru
  
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

  // Highlight Nested Slots (Loop dan Function)
  
  // Highlight Nested Loop Slots
  if (openLoopIndex !== -1) {
    // Hanya izinkan block selain Loop (untuk Loop Nested)
    if (!isDraggingLoop) {
        const activeBubble = document.getElementById('global-loop-dropup');
        if (activeBubble) {
            activeBubble.querySelectorAll(".nested-slot").forEach(nestedSlot => {
              if (getOverlap(block, nestedSlot) > 0.7) nestedSlot.classList.add("highlight");
            });
        }
    }
  }
  
  // Highlight Nested Function Slots
  if (isFunctionBubbleOpen) {
      // Hanya izinkan block selain Function (untuk Function Nested)
      if (!isDraggingFunction) {
          const functionBubble = document.getElementById('function-definition-bubble');
          if (functionBubble) {
              functionBubble.querySelectorAll(".function-nested-slot").forEach(nestedSlot => {
                  if (getOverlap(block, nestedSlot) > 0.5) nestedSlot.classList.add("highlight");
              });
          }
      }
  }
}

function removeHighlight() {
  document.querySelectorAll(".slot.highlight").forEach(slot => slot.classList.remove("highlight"));
}


// --- FUNCTION RENDERING & SYNC ---

function renderFunctionToolbar() {
    const btnFunction = document.getElementById("btn-function");
    const functionBubble = document.getElementById('function-definition-bubble');
    const toggleBtn = document.getElementById('function-toggle-btn-toolbar');

    if (!btnFunction || !functionBubble || !toggleBtn) return;

    // --- HAPUS BUBBLE LOOP GLOBAL SEBELUM RENDER ULANG ---
    const globalDropup = document.getElementById('global-loop-dropup');
    if (globalDropup) globalDropup.remove();
    // --- END HAPUS BUBBLE LOOP GLOBAL ---


    // 1. Setup Toggle Button
    toggleBtn.innerText = isFunctionBubbleOpen ? "✕" : "▼";
    toggleBtn.style.backgroundColor = isFunctionBubbleOpen ? '#ccfbf1' : 'var(--tk-function-main)';
    toggleBtn.style.color = isFunctionBubbleOpen ? 'var(--tk-function-border)' : 'var(--tk-function-text)';

    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        // Tutup loop bubble jika terbuka
        openLoopIndex = -1; 
        isFunctionBubbleOpen = !isFunctionBubbleOpen;
        renderFunctionToolbar();
        // Memaksa render workspace untuk memastikan function block instances terupdate
        renderWorkspace(true); 
    };

    // 2. Setup Bubble Visibility
    functionBubble.style.display = isFunctionBubbleOpen ? "flex" : "none";
    
    // 3. Render Slots Content
    const nestedSlots = functionBubble.querySelectorAll(".function-nested-slot");

    functionContent.forEach((nestedBlock, nestedIndex) => {
        const slot = nestedSlots[nestedIndex];
        slot.innerHTML = ""; // Clear
        
        // Hapus dropup loop lama yang mungkin masih ada (fallback)
        const existingDropup = slot.querySelector(".loop-dropup");
        if (existingDropup) existingDropup.remove();
        
        if (nestedBlock) {
            // KRITIS: Tambahkan index untuk lookup yang lebih mudah saat drag.
            // Function Definition blocks memiliki parent index -1
            nestedBlock.setAttribute('data-parent-loop-index', -1); 
            nestedBlock.setAttribute('data-nested-index', nestedIndex);

            slot.appendChild(nestedBlock);
            cleanPositionStyles(nestedBlock);
            attachDragEventsToBlock(nestedBlock); 
            
            // --- LOGIKA KHUSUS LOOP DI DALAM FUNCTION (BUG 2 FIX) ---
            if (nestedBlock.getAttribute("data-type") === "loop") {
                 const b = nestedBlock; // Alias
                 
                 // 1. Tambahkan tombol toggle manual
                 const toggleBtn = document.createElement("div");
                 toggleBtn.className = "loop-toggle-btn";
                 // Karena Loop ini berada di Function definition, kita perlu ID unik yang tidak berbenturan
                 // dengan loop di workspace. Kita gunakan ID `nested-f${nestedIndex}`
                 const loopId = `nested-f${nestedIndex}`; 
                 
                 toggleBtn.innerText = (loopId === openLoopIndex) ? "✕" : "▼"; 
                 b.appendChild(toggleBtn);
                 
                 // 1.1 Handle click pada tombol toggle
                 toggleBtn.onclick = (e) => {
                     e.stopPropagation(); 
                     if (loopId === openLoopIndex) {
                         openLoopIndex = -1; // Tutup
                     } else {
                         isFunctionBubbleOpen = true; // Pastikan bubble function tetap terbuka
                         openLoopIndex = loopId; // Buka loop ini
                     }
                     renderFunctionToolbar(); // Render ulang toolbar untuk menampilkan bubble loop
                     renderWorkspace(true); // Render ulang workspace untuk update function instances
                 };
                 
                 // 1.2 Handle click pada counter (untuk ubah count)
                 const counter = b.querySelector(".loop-counter");
                 if (counter) {
                      counter.onmousedown = (e) => { e.stopPropagation(); }; 
                      counter.onclick = (e) => {
                           e.stopPropagation();
                           let currentCount = parseInt(b.getAttribute("data-loop-count"));
                           let newCount = currentCount === 5 ? 2 : currentCount + 1;
                           if (newCount === 1) newCount = 2; 

                           b.setAttribute("data-loop-count", newCount);
                           
                           isFunctionBubbleOpen = true;
                           openLoopIndex = loopId; 
                           renderFunctionToolbar();
                           renderWorkspace(true); 
                      };
                      counter.innerText = b.getAttribute("data-loop-count"); // Update visual
                 }
                 
                 // 2. Tambahkan Nested Dropup (Bubble)
                 let loopDropup = document.createElement("div");
                 loopDropup.className = "loop-dropup";
                 loopDropup.id = `loop-dropup-${loopId}`;
                 loopDropup.innerHTML = `
                     <div class="loop-slot-container">
                         <div class="slot nested-slot" data-index="0" data-f-parent="true"></div>
                         <div class="slot nested-slot" data-index="1" data-f-parent="true"></div>
                     </div>
                 `;
                 
                 // 3. Posisikan dan Tampilkan Bubble jika aktif
                 if (loopId === openLoopIndex) {
                      // A. Set ID unik agar bisa dilacak saat drop
                      loopDropup.id = 'global-loop-dropup'; 
                      
                      // B. Ambil posisi Block Loop di layar (Block di dalam Function Bubble)
                      const blockRect = b.getBoundingClientRect();
                      
                      // C. Tentukan posisi absolut bubble (Posisi di ATAS blok)
                      loopDropup.style.position = 'fixed';
                      // Kita harus offset relatif terhadap viewport karena loopDropup dipindahkan ke body
                      loopDropup.style.top = `${blockRect.top - 105}px`; 
                      loopDropup.style.left = `${blockRect.left + blockRect.width / 2}px`;
                      loopDropup.style.transform = 'translateX(-50%)'; 
                      loopDropup.style.zIndex = 2000; 

                      
                      // D. Pindahkan bubble ke BODY (Stacking Context terluar)
                      document.body.appendChild(loopDropup);
                      loopDropup.style.display = "flex";
                      
                      // 4. Render Isi Nested Slot dari state baru
                      const nestedSlotsInBubble = loopDropup.querySelectorAll(".nested-slot");
                      functionLoopNestedContent[nestedIndex].forEach((innerBlock, innerIndex) => {
                          if (innerBlock) {
                              innerBlock.setAttribute('data-parent-loop-index', loopId); // ID string
                              innerBlock.setAttribute('data-nested-index', innerIndex);
                              
                              nestedSlotsInBubble[innerIndex].innerHTML = "";
                              nestedSlotsInBubble[innerIndex].appendChild(innerBlock);
                              cleanPositionStyles(innerBlock);
                              attachDragEventsToBlock(innerBlock);
                          }
                      });
                 }
                 
            } else if (nestedBlock.getAttribute("data-type") === "function") {
                 // Perbarui tampilan visual block Function yang ada di nested slot
                 createFunctionBlockDisplay(nestedBlock);
            }
        }
    });
}


function createFunctionBlockDisplay(b) {
    const innerIcons = functionContent.map(getIconHtml).filter(html => html.length > 0);
    
    // Default/Empty state: {} (Bug 3 Fix)
    if (innerIcons.length === 0) {
        // Tampilan {} besar
        b.innerHTML = `<span style="font-size: 40px; margin-top: -10px;">{}</span>`; 
        b.style.fontSize = ''; // Gunakan CSS default
        b.style.padding = '';
        return; 
    }
    
    // Content state: 🡳 | 🡳 (Bug 3 Fix)
    // Font size untuk pemisah dikecilkan menjadi 38px, ikon sudah 28px (Sesuai penyesuaian terbaru)
    const iconFontSize = '28px';
    const separatorFontSize = '28px'; // Gunakan ukuran ikon untuk konsistensi pemisah
    
    const displayHtml = innerIcons.join(`<span style="font-size: ${separatorFontSize}; color: var(--tk-function-text); margin: 0 4px; font-weight: bold;">|</span>`);
    
    b.innerHTML = `
        <div class="function-content-new">
            ${displayHtml}
        </div>
    `;
    b.style.fontSize = '12px'; 
    b.style.padding = '4px';
    
    // Pastikan style display flex diterapkan untuk centering
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

  // --- HAPUS BUBBLE LOOP GLOBAL SEBELUM RENDER ULANG ---
  const globalDropup = document.getElementById('global-loop-dropup');
  if (globalDropup) globalDropup.remove();
  // --- END HAPUS BUBBLE LOOP GLOBAL ---

  // Update Function Toolbar View
  renderFunctionToolbar();

  slots.forEach((slot, i) => {
    
    let b = workspaceSlots[i];
    
    // HANYA UPDATE visual block Function di workspace
    if (isFunctionUpdate && b && b.getAttribute("data-type") === "function") {
         createFunctionBlockDisplay(b);
         return; 
    }
    
    // Rendering Penuh (untuk semua kasus lain)
    slot.innerHTML = "";
    
    // Hapus dropup loop lama yang mungkin masih ada (fallback)
    const existingDropup = slot.querySelector(".loop-dropup");
    if (existingDropup) existingDropup.remove();

    if (b) {
      slot.appendChild(b);
      // PENTING: Pembersihan style positioning yang agresif dan murni
      cleanPositionStyles(b);
      
      attachDragEventsToBlock(b);

      // --- LOGIKA KHUSUS FUNCTION BLOCK INSTANCES ---
      if (b.getAttribute("data-type") === "function") {
          // Sinkronisasi display block Function di workspace
          createFunctionBlockDisplay(b);
      }
      
      // --- LOGIKA KHUSUS LOOP ---
      if (b.getAttribute("data-type") === "loop") {
          
          const loopId = i; // ID loop di workspace adalah index slotnya
          
          // Tambahkan tombol toggle manual
          const toggleBtn = document.createElement("div");
          toggleBtn.className = "loop-toggle-btn";
          toggleBtn.innerText = (loopId === openLoopIndex) ? "✕" : "▼"; // Visual status
          b.appendChild(toggleBtn);
          
          toggleBtn.onclick = (e) => {
              e.stopPropagation(); // Mencegah klik menyebar ke drag
              if (loopId === openLoopIndex) {
                  openLoopIndex = -1; // Tutup
              } else {
                  // Tutup function bubble jika ada
                  isFunctionBubbleOpen = false; 
                  openLoopIndex = loopId; // Buka loop ini
              }
              renderWorkspace();
          };
          
          // 1. Counter Click & Drag Prevention (FIX Bug 2)
          const counter = b.querySelector(".loop-counter");
          if (counter) {
              // Hentikan mousedown agar tidak memicu attachDragEventsToBlock
              // FIX BUG 2: Hentikan event propagation di mousedown/touchstart agar tidak memulai drag
              counter.onmousedown = (e) => { e.stopPropagation(); }; 
              
              counter.onclick = (e) => {
                  e.stopPropagation();

                  let currentCount = parseInt(b.getAttribute("data-loop-count"));
                  // Peningkatan/pengurangan count
                  let newCount = currentCount === 5 ? 2 : currentCount + 1;
                  
                  if (newCount === 1) newCount = 2; 

                  b.setAttribute("data-loop-count", newCount);
                  
                  // Buka bubble saat count diubah
                  isFunctionBubbleOpen = false;
                  openLoopIndex = loopId; 
                  workspaceSlots[i] = b; 
                  renderWorkspace();
              };
          }

          // 2. Tambahkan Nested Dropup (Bubble) - Dibuat di sini
          let loopDropup = document.createElement("div");
          loopDropup.className = "loop-dropup";
          loopDropup.id = `loop-dropup-${loopId}`;
          loopDropup.innerHTML = `
              <div class="loop-slot-container">
                  <div class="slot nested-slot" data-index="0"></div>
                  <div class="slot nested-slot" data-index="1"></div>
              </div>
          `;
          
          // 3. Render Isi Nested Slot (dipindahkan dari data ke DOM element loopDropup)
          const nestedSlots = loopDropup.querySelectorAll(".nested-slot");
          loopContent[i].forEach((nestedBlock, nestedIndex) => {
              if (nestedBlock) {
                  // KRITIS: Tambahkan index untuk lookup yang lebih mudah saat drag.
                  nestedBlock.setAttribute('data-parent-loop-index', i);
                  nestedBlock.setAttribute('data-nested-index', nestedIndex);
                  
                  // FIX: Jika block adalah function call, pastikan tampilan visualnya benar
                  if (nestedBlock.getAttribute("data-type") === "function") {
                      
                      // Mengganti konten slot dengan nestedBlock
                      nestedSlots[nestedIndex].innerHTML = "";
                      nestedSlots[nestedIndex].appendChild(nestedBlock);
                      cleanPositionStyles(nestedBlock);
                      
                      // Perbarui tampilan visual block Function yang ada di nested slot
                      createFunctionBlockDisplay(nestedBlock);
                      
                      attachDragEventsToBlock(nestedBlock); 
                      
                  } else {
                      // Block normal (jalan, tembak, loop)
                      nestedSlots[nestedIndex].appendChild(nestedBlock);
                      cleanPositionStyles(nestedBlock);
                      attachDragEventsToBlock(nestedBlock); 
                  }
              }
          });
          
          // 4. MEMPERTAHANKAN STATUS TERBUKA & PINDAH KE BODY (Bug 1 Fix)
          if (loopId === openLoopIndex) {
              
              // A. Set ID unik agar bisa dilacak saat drop
              loopDropup.id = 'global-loop-dropup';
              
              // B. Ambil posisi Block Loop di layar
              const blockRect = b.getBoundingClientRect();
              
              // C. Tentukan posisi absolut bubble (Posisi di ATAS blok)
              loopDropup.style.position = 'fixed';
              loopDropup.style.top = `${blockRect.top - 105}px`; 
              loopDropup.style.left = `${blockRect.left + blockRect.width / 2}px`;
              loopDropup.style.transform = 'translateX(-50%)'; 
              loopDropup.style.zIndex = 2000; 

              
              // D. Pindahkan bubble ke BODY (Stacking Context terluar)
              document.body.appendChild(loopDropup);
              loopDropup.style.display = "flex";
              
          } else {
              // Jika index ditutup, loopDropup (jika ada) akan dihapus oleh logika di awal renderWorkspace.
          }

          // Update visual counter
          const counterDisplay = b.querySelector(".loop-counter");
          if(counterDisplay) {
            counterDisplay.innerText = b.getAttribute("data-loop-count");
          }
      } else {
         // Jika ada block non-loop ditempatkan, pastikan openLoopIndex = -1
         if (i === openLoopIndex) {
              openLoopIndex = -1;
         }
      }
    }
  });

  applyLanguage(currentLang, true);
}

/* =========================================
   GAME ENGINE & LOOP 
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
  
  // PERBAIKAN: Perbarui arah hadap lebah agar tembakannya benar (Masalah 2)
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

  const flippedH = (gid & FLIPPED_H) !== 0;
  const flippedV = (gid & FLIPPED_V) !== 0;
  const flippedD = (gid & FLIPPED_D) !== 0;

  const realgid = gid & 0x1FFFFFFF;

  let ts = getTilesetForGID(realgid);
  if (!ts) return;

  let localId = realgid - ts.firstgid;

  let sx = (localId % ts.columns) * TILE_SIZE;
  let sy = Math.floor(localId / ts.columns) * TILE_SIZE;

  if(typeof ctx !== 'undefined') {
    ctx.save();
    ctx.translate(worldX, worldY);

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
}


function updateBee(dt) {
  const anim = beeAnimations[bee.state];
  if (!anim) return;

  bee.timer += dt;

  if (bee.state === "death" && bee.frame === anim.frames - 1) return;

  // Kontrol Animasi Tembak
  if (bee.state === "shoot") {
    if (bee.timer > 80) {      // 80ms per frame – natural
      bee.timer = 0;
      bee.frame++;

      if (bee.frame >= anim.frames) {
          bee.state = "idle";
          bee.frame = 0;
      }
    }
    return;
  }

  // Animasi Idle/Walk
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
  // Menentukan skala rendering proyektil (4x = 16px)
  const PROJECTILE_SCALE = 2;
  const RENDER_SIZE_W = projectileAnim.fw * PROJECTILE_SCALE;
  const RENDER_SIZE_H = projectileAnim.fh * PROJECTILE_SCALE;

  projectiles.forEach(p => {
    if(typeof ctx !== 'undefined') {
      ctx.save();
      ctx.translate(p.x, p.y);
      
      // Koreksi logika pembalikan sumbu X
      if (p.vx < 0) {
        // Jika bergerak ke kiri, pindahkan origin ke tepi kanan sprite (RENDER_SIZE_W)
        // sehingga ketika dibalik (scale -1), gambar tetap berada pada posisi awal p.x.
        ctx.translate(RENDER_SIZE_W, 0); 
        ctx.scale(-1, 1); 
      }

      // Render gambar proyektil dengan skala 4x (16x16)
      ctx.drawImage(
        projectileAnim.img, 0, 0, projectileAnim.fw, projectileAnim.fh, // Sprite asli (4x4)
        0, 0, RENDER_SIZE_W, RENDER_SIZE_H // Target ukuran rendering (16x16)
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
  bee.timer = 0; // Reset timer untuk animasi menembak

  const base = beeAnimations.idle;
  const w = base.fw * BEE_SCALE;
  const h = base.fh * BEE_SCALE;
  const cx = bee.x + w / 2;
  const cy = bee.y + h / 2;

  // Skala 4x untuk perhitungan offset (16px)
  const PROJECTILE_SCALE = 4;
  const PROJECTILE_RENDER_WIDTH = projectileAnim.fw * PROJECTILE_SCALE;

  // PERBAIKAN: Meningkatkan offset peluncuran proyektil (w * 0.7)
  const offsetDistance = w * 0.7; 
  
  // PERBAIKAN BUG 2: Sesuaikan offset X
  const offsetX = bee.facing === "right"
    ? +10
    : -10 - projectileAnim.fw * PROJECTILE_SCALE;


  const offsetY = (h * 0.55) - (h / 2);

  // Waktu peluncuran proyektil (cocok dengan animasi shoot frame 4)
  setTimeout(() => {
    projectiles.push({
      x: cx + offsetX,
      y: cy + offsetY,
      vx: bee.facing === "right" ? 3 : -3, // Kecepatan diatur ke 3 (lebih cepat)
      vy: 0,
      frame: 0
    });
  }, 100);

  // Animasi akan kembali ke "idle" di fungsi updateBee, bukan di sini.
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
          console.log("Spawn FIXED:", bee.x, bee.y);
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
    functionContent = [null, null]; // Reset Function content
    functionLoopNestedContent = Array(2).fill(null).map(() => Array(2).fill(null)); // Reset state nested Function Loop
    openLoopIndex = -1;
    isFunctionBubbleOpen = false; // Close function bubble
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
    // --- Render Function Toolbar saat inisialisasi ---
    renderFunctionToolbar();

    // === BLOK JALAN (Dropup) ===
    const btnJalan = document.getElementById("btn-jalan");
    const dropupJalan = document.getElementById("dropup-jalan");

    if (btnJalan) btnJalan.onmouseenter = () => { if(dropupJalan) dropupJalan.style.display = "flex"; };
    const toolbarArea = document.querySelector(".toolbar-area");
    if (toolbarArea) toolbarArea.onmouseleave = () => { 
        if(dropupJalan) dropupJalan.style.display = "none"; 
        // Jangan tutup Function bubble
    };

    // === BLOK TEMBAK, LOOP, IF/ELSE, FUNCTION (Single Drag) ===
    const singleBtns = [
        { id: "btn-tembak", type: "tembak", label: "🔫" },
        { id: "btn-loop", type: "loop", label: "🔁" },
        { id: "btn-if-else", type: "if-else", label: "2" },
        { id: "btn-function", type: "function", label: "Function: {}" }, // Label disesuaikan
    ];

    singleBtns.forEach(btnData => {
        const btn = document.getElementById(btnData.id);
        
        if (!btn) return;
        
        btn.onmousedown = (e) => {
            e.preventDefault();
            
            // --- FIX: Cegah Drag jika klik berasal dari tombol toggle Function ---
            if (btnData.type === 'function' && e.target.closest('.function-toggle-btn')) {
                 // Biarkan event onclick di renderFunctionToolbar yang mengurusnya
                 return; 
            }
            
            // FIX PENTING: Jika Function Definition Bubble terbuka dan target klik ada di dalamnya,
            // ini berarti pengguna mencoba menyeret block bersarang. Kita HENTIKAN pembuatan block baru di toolbar.
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

            // Perbarui tampilan clone function agar sesuai dengan definisi
            if (type === "function") {
                createFunctionBlockDisplay(clone);
            }


            currentDrag = clone;
            document.body.appendChild(clone);

            // Geser clone agar pusatnya berada di sekitar kursor
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

        // Perbarui tampilan clone function agar sesuai dengan definisi
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

        let type = b.getAttribute("data-type");

        if (type === "tembak") {
          commandQueue.push({ type: "shoot" });
        }
        else if (type === "jalan") {
            commandQueue.push({type:"move", dir:b.getAttribute("data-direction")});
        }
        else if (type === "loop") {
            const repeatCount = parseInt(b.getAttribute("data-loop-count")) || 1;
            const nestedCommands = [];
            
            // Ekstrak command dari nested slots
            loopContent[i].forEach(nestedBlock => {
                if (!nestedBlock) return;
                const nestedType = nestedBlock.getAttribute("data-type");
                
                // Jika nested block adalah function call, expand lagi
                if (nestedType === "function") {
                    nestedCommands.push(...getFunctionCommands());
                } else if (nestedType === "tembak") {
                    nestedCommands.push({ type: "shoot" });
                } else if (nestedType === "jalan") {
                    nestedCommands.push({type:"move", dir:nestedBlock.getAttribute("data-direction")});
                }
                // Jika nested block adalah loop, itu tidak diizinkan.
            });
            
            // Tambahkan perintah sebanyak repeatCount
            for (let r = 0; r < repeatCount; r++) {
                commandQueue.push(...nestedCommands);
            }
        }
        // --- LOGIKA EKSEKUSI FUNCTION BLOCK ---
        else if (type === "function") {
            commandQueue.push(...getFunctionCommands());
        }
    });

    if (commandQueue.length === 0) {
        console.warn("Workspace kosong.");
        return;
    }

    isRunningCommands = true;
    runNextCommand();
};

function getFunctionCommands() {
    const commands = [];
    functionContent.forEach((nestedBlock, funcIndex) => {
        if (!nestedBlock) return;
        const type = nestedBlock.getAttribute("data-type");
        
        if (type === "tembak") {
            commands.push({ type: "shoot" });
        } else if (type === "jalan") {
            commands.push({type:"move", dir:nestedBlock.getAttribute("data-direction")});
        } else if (type === "loop") {
            // Function definition berisi loop
            const repeatCount = parseInt(nestedBlock.getAttribute("data-loop-count")) || 1;
            
            // Ambil anak-anak dari Loop di dalam Function Definition
            const innerNestedCommands = [];
            functionLoopNestedContent[funcIndex].forEach(innerBlock => {
                 if (!innerBlock) return;
                 const innerType = innerBlock.getAttribute("data-type");
                 
                 // Hanya izinkan jalan/tembak di dalam Loop di Function (pembatasan rekursi)
                 if (innerType === "tembak") {
                     innerNestedCommands.push({ type: "shoot" });
                 } else if (innerType === "jalan") {
                     innerNestedCommands.push({type:"move", dir:innerBlock.getAttribute("data-direction")});
                 }
            });
            
            // Tambahkan perintah sebanyak repeatCount
            for (let r = 0; r < repeatCount; r++) {
                 commands.push(...innerNestedCommands);
            }

        }
        // Rekursi (Function Call di dalam Function Definition) DILARANG di drop logic.
    });
    return commands;
}

function runNextCommand() {
    if (commandQueue.length === 0) {
        isRunningCommands = false;
        bee.state = "idle";
        return;
    }

    setTimeout(() => {
        const cmd = commandQueue.shift();

        if (cmd.type === "shoot") {
            shootProjectile();
            setTimeout(runNextCommand, 300);
        }

        if (cmd.type === "move") {
            moveBeeOnce(cmd.dir, runNextCommand);
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