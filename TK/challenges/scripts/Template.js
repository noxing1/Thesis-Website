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
    "../Asset/Sprites/Maps/01.json", "../Asset/Sprites/Maps/02.json", 
    "../Asset/Sprites/Maps/03.json", "../Asset/Sprites/Maps/04.json",
    "../Asset/Sprites/Maps/05.json", "../Asset/Sprites/Maps/06.json",
    "../Asset/Sprites/Maps/07.json", "../Asset/Sprites/Maps/08.json",
    "../Asset/Sprites/Maps/09.json", "../Asset/Sprites/Maps/10.json"
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

  // --- 2. Mencari slot terbaik di nested slots (Priority 2, hanya jika BUKAN Loop/Function) ---
  if (!isDraggingLoop && !isDraggingFunction) {
      // 2a. Nested Loop Slots
      if (openLoopIndex !== -1) {
        const activeBubble = document.getElementById('global-loop-dropup');
        if (activeBubble) {
            activeBubble.querySelectorAll(".nested-slot").forEach(nestedSlot => {
              let ov = getOverlap(block, nestedSlot);
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
            // Overlap lebih kecil karena kita ingin sensitivitas lebih rendah terhadap toolbar
            if (ov > bestVal && ov > 0.5) { 
                bestVal = ov;
                best = nestedSlot;
            }
          });
      }
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
    block.innerHTML = `{}`; 
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
    
    if (type === 'jalan') {
        const dir = sourceBlock.getAttribute('data-direction');
        const icon = {up:"🡱", right:"🡲", left:"🡸", down:"🡳"}[dir];
        return `<span style="font-size: 14px; color: var(--tk-brown);">${icon}</span>`;
    }
    if (type === 'tembak') {
        return `<span style="font-size: 14px; color: var(--tk-brown);">🔫</span>`;
    }
    return '';
}


/* =========================================
   DRAG AND DROP HANDLERS
========================================= */

function attachDragEventsToBlock(block) {
  block.onmousedown = (e) => {
    e.preventDefault();

    // Check if the click originated from control buttons
    if (e.target.closest('.loop-counter') || e.target.closest('.loop-toggle-btn') || e.target.closest('.function-toggle-btn')) return; 

    isFromWorkspace = block.closest(".workspace-area") !== null;
    isMovingLoop = block.getAttribute("data-type") === "loop" && isFromWorkspace; 
    
    const isNestedDrag = block.closest('.nested-slot') !== null || block.closest('.function-nested-slot') !== null;
    
    // Reset index nested
    originalNestedIndex = null;
    
    // --- State preparation based on drag origin ---
    if (isNestedDrag) {
        // Drag dari NESTED SLOT (Loop atau Function)
        
        const isFromFunction = block.closest('.function-nested-slot') !== null;
        
        if (isFromFunction) {
            // Drag dari Function Definition Slot (HANYA MUNGKIN INDEX 0 atau 1)
            originalSlotIndex = -1; // Flag untuk Function Global
            originalNestedIndex = parseInt(block.getAttribute('data-nested-index'));
            
            // Clear the function content state
            if (originalNestedIndex !== null && originalNestedIndex !== -1) {
                functionContent[originalNestedIndex] = null;
                console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari functionContent[${originalNestedIndex}].`);
            } else {
                console.warn("[WARN] Gagal mendapatkan indeks asal nested function block.");
                return;
            }

        } else {
            // Drag dari Loop Nested Slot
            const parentLoopIndexAttr = block.getAttribute('data-parent-loop-index');
            const nestedIndexAttr = block.getAttribute('data-nested-index');
            
            if (!parentLoopIndexAttr || !nestedIndexAttr) {
                 const parentLoopBlock = block.closest('.block[data-type="loop"]');
                 if (parentLoopBlock) {
                    for(let i = 0; i < workspaceSlots.length; i++) {
                        if (workspaceSlots[i] === parentLoopBlock) {
                            originalSlotIndex = i; 
                            break;
                        }
                    }
                 } else {
                     console.error("[ERROR] Nested block missing indices and parent loop block.");
                     return;
                 }
                 for (let i = 0; i < loopContent.length; i++) {
                    const nested = loopContent[i];
                    const idx = nested.indexOf(block);
                    if (idx !== -1) {
                        originalNestedIndex = idx;
                        break;
                    }
                 }
            } else {
                originalSlotIndex = parseInt(parentLoopIndexAttr); 
                originalNestedIndex = parseInt(nestedIndexAttr); 
            }

            if (originalSlotIndex !== null && originalNestedIndex !== null && originalSlotIndex !== -1 && originalNestedIndex !== -1) {
                loopContent[originalSlotIndex][originalNestedIndex] = null;
                console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari loopContent[${originalSlotIndex}][${originalNestedIndex}].`);
            } else {
                console.warn("[WARN] Gagal mendapatkan indeks asal nested loop block.");
                return;
            }
        }
        
        block.setAttribute('data-is-nested', 'true');
        // JANGAN TUTUP BUBBLE

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
            
            // Clear the main workspace slot array immediately.
            workspaceSlots[originalSlotIndex] = null; 
            console.log(`[DEBUG] Block ${block.getAttribute('data-type')} dihapus dari workspaceSlots[${originalSlotIndex}].`);
        }
    }


    realBlock = block;

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
          
          if (blockToPlace.getAttribute("data-type") === "loop" || blockToPlace.getAttribute("data-type") === "function") {
             // Loop atau Function TIDAK bisa di nested
             shouldRender = wasNestedDrag || isFromWorkspace;
          } 
          
          else if (isFunctionNestedTarget) {
              // Drop berhasil ke NESTED SLOT FUNCTION DEFINITION (TOOLBAR)
              const nestedIndex = parseInt(target.getAttribute("data-index"));
              const existingNestedBlock = functionContent[nestedIndex];

              // Jika slot function sudah terisi, kembalikan block lama ke slot asalnya
              if (existingNestedBlock) {
                  if (wasNestedDrag) {
                       // Swap block dari function/loop nested ke function/loop nested asal blockToPlace
                       if (originalSlotIndex === -1) { // Asal dari Function
                           functionContent[originalNestedIndex] = existingNestedBlock;
                       } else if (originalSlotIndex !== null) { // Asal dari Loop
                           loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                       }
                  } else if (isFromWorkspace && originalSlotIndex !== null) {
                       // Swap block dari function nested ke main slot asal blockToPlace
                       workspaceSlots[originalSlotIndex] = existingNestedBlock;
                  }
              }

              // Simpan Block ke Function Definition Slot
              functionContent[nestedIndex] = blockToPlace;
              isFunctionBubbleOpen = true; // Pertahankan bubble terbuka
              placedInFunction = true;
              shouldRender = true;

          }
          
          else if (isLoopNestedTarget) {
              // Drop berhasil ke NESTED SLOT LOOP
              let parentIndex = openLoopIndex; 
              
              if (parentIndex !== -1) {
                  const nestedIndex = parseInt(target.getAttribute("data-index"));
                  const existingNestedBlock = loopContent[parentIndex][nestedIndex];
                      
                  // Swap Logic: Jika slot nested sudah terisi, kembalikan ke slot asal
                  if (existingNestedBlock) {
                       if (wasNestedDrag) {
                           // Swap block dari loop/function nested ke loop/function nested asal blockToPlace
                            if (originalSlotIndex === -1) { // Asal dari Function
                                functionContent[originalNestedIndex] = existingNestedBlock;
                            } else if (originalSlotIndex !== null) { // Asal dari Loop
                                loopContent[originalSlotIndex][originalNestedIndex] = existingNestedBlock;
                            }
                       } else if (isFromWorkspace && originalSlotIndex !== null) {
                           // Swap block dari loop nested ke main slot asal blockToPlace
                           workspaceSlots[originalSlotIndex] = existingNestedBlock;
                       }
                  }
                  
                  // Simpan Block ke Loop Nested Slot Baru
                  loopContent[parentIndex][nestedIndex] = blockToPlace;
                  newOpenLoopIndex = parentIndex; // Pertahankan loop bubble terbuka
                  shouldRender = true;
              } else {
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
                  // Clean function content if we moved a function block out
                  if (existingTargetBlock.getAttribute("data-type") === "function" && blockToPlace.getAttribute("data-type") !== "function") {
                       // N/A
                  }
                  
                  workspaceSlots[originalSlotIndex] = existingTargetBlock;
                  if (newOpenLoopIndex === targetIndex) newOpenLoopIndex = originalSlotIndex;
            }
            // Skenario 2: Nested Slot (Loop/Function) ke Main Slot (Hapus block lama jika ada)
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
      // Drop gagal (dilepas di luar slot - Penghapusan)
      
      if (wasNestedDrag || isFromWorkspace) {
          shouldRender = true; 
      }
      
      // Hapus konten loop jika loop block dibuang
      if (isFromWorkspace && !wasNestedDrag && realBlock.getAttribute('data-type') === 'loop' && originalSlotIndex !== null) {
          loopContent[originalSlotIndex] = Array(2).fill(null);
      }

      // Jika drag berasal dari nested loop, loop bubble tetap terbuka
      if (wasNestedDrag && originalSlotIndex !== -1 && !placedInFunction) {
          newOpenLoopIndex = originalSlotIndex; 
      }
      
      // Jika drag berasal dari function definition, bubble function tetap terbuka
      if (wasNestedDrag && originalSlotIndex === -1) {
          isFunctionBubbleOpen = true; 
      }

      if (wasNestedDrag) {
          blockToPlace.removeAttribute('data-is-nested');
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
  
  const isDraggingLoopOrFunction = block.getAttribute("data-type") === "loop" || block.getAttribute("data-type") === "function";

  if (!isDraggingLoopOrFunction) {
      // Highlight Nested Loop Slots
      if (openLoopIndex !== -1) {
        const activeBubble = document.getElementById('global-loop-dropup');
        if (activeBubble) {
            activeBubble.querySelectorAll(".nested-slot").forEach(nestedSlot => {
              if (getOverlap(block, nestedSlot) > 0.7) nestedSlot.classList.add("highlight");
            });
        }
      }
      
      // Highlight Nested Function Slots
      if (isFunctionBubbleOpen) {
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
        
        if (nestedBlock) {
            // KRITIS: Tambahkan index untuk lookup yang lebih mudah saat drag.
            nestedBlock.setAttribute('data-parent-loop-index', -1); // Flag: Function global
            nestedBlock.setAttribute('data-nested-index', nestedIndex);

            slot.appendChild(nestedBlock);
            cleanPositionStyles(nestedBlock);
            attachDragEventsToBlock(nestedBlock); 
        }
    });
}


function createFunctionBlockDisplay(b) {
    let displayHtml = `{}`;
    const innerIcons = functionContent.map(getIconHtml).join('');
    
    // Jika ada konten, tampilkan ringkasan
    if (innerIcons.length > 0) {
        displayHtml = `
            <div class="function-content">
                <div>F: {}</div>
                <div class="function-icon-container">${innerIcons}</div>
            </div>
        `;
        b.innerHTML = displayHtml;
        b.style.fontSize = '12px';
        b.style.padding = '2px';
    } else {
        // Jika kosong, kembali ke tampilan dasar
        b.innerHTML = `{}`;
        b.style.fontSize = '18px';
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
         // Karena hanya visual, kita tidak perlu memanggil attachDragEventsToBlock 
         // atau logika DOM berat lainnya jika block tidak dipindahkan.
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
          
          // Tambahkan tombol toggle manual
          const toggleBtn = document.createElement("div");
          toggleBtn.className = "loop-toggle-btn";
          toggleBtn.innerText = (i === openLoopIndex) ? "✕" : "▼"; // Visual status
          b.appendChild(toggleBtn);
          
          toggleBtn.onclick = (e) => {
              e.stopPropagation(); // Mencegah klik menyebar ke drag
              if (i === openLoopIndex) {
                  openLoopIndex = -1; // Tutup
              } else {
                  // Tutup function bubble jika ada
                  isFunctionBubbleOpen = false; 
                  openLoopIndex = i; // Buka loop ini
              }
              renderWorkspace();
          };
          
          // 1. Counter Click & Drag Prevention
          const counter = b.querySelector(".loop-counter");
          if (counter) {
              counter.onmousedown = (e) => { e.stopPropagation(); };
              
              counter.onclick = (e) => {
                  e.stopPropagation();

                  let currentCount = parseInt(b.getAttribute("data-loop-count"));
                  let newCount = currentCount === 5 ? 2 : currentCount + 1;
                  
                  if (newCount === 1) newCount = 2; 

                  b.setAttribute("data-loop-count", newCount);
                  
                  // Buka bubble saat count diubah
                  // Tutup function bubble jika ada
                  isFunctionBubbleOpen = false;
                  openLoopIndex = i; 
                  workspaceSlots[i] = b; 
                  renderWorkspace();
              };
          }

          // 2. Tambahkan Nested Dropup (Bubble) - Dibuat di sini
          let loopDropup = document.createElement("div");
          loopDropup.className = "loop-dropup";
          loopDropup.id = `loop-dropup-${i}`;
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

                  nestedSlots[nestedIndex].appendChild(nestedBlock);
                  cleanPositionStyles(nestedBlock);
                  attachDragEventsToBlock(nestedBlock); 
              }
          });
          
          // 4. MEMPERTAHANKAN STATUS TERBUKA & PINDAH KE BODY (Bug 1 Fix)
          if (i === openLoopIndex) {
              
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
      // Jika sudah mencapai frame terakhir, hentikan timer agar frame tetap di terakhir
      if (bee.frame === anim.frames - 1) {
          // Hanya jika animasi telah selesai, kembalikan ke idle
          if (bee.timer > 200) { // Tahan di frame terakhir selama 200ms
               bee.state = "idle";
               bee.frame = 0;
          }
      } else if (bee.timer > 120) { 
          // Pindah ke frame berikutnya
          bee.timer = 0;
          bee.frame++;
      }
      return; // Jangan lakukan update frame idle/walk jika sedang menembak
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

function loadProjectile() {
  const json = fetch(`../Asset/Sprites/projectile.json`).then(r => r.json());

  const img = new Image();
  img.src = `../Asset/Sprites/projectile.png`;

  return {
    img: img,
    fw: json.frameWidth,
    fh: json.fh,
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
  const PROJECTILE_SCALE = 4;
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
            list.push({
                img: img, fw: json.frameWidth, fh: json.frameHeight, frames: json.frames
            });
        } catch (err) {
            console.warn("Butterfly JSON not found:", color);
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
    ? offsetDistance // Tembak ke kanan: Offset positif
    // Tembak ke kiri: Offset negatif MINUS lebar render proyektil
    : -offsetDistance - PROJECTILE_RENDER_WIDTH; 

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
if(btnBack) btnBack.onclick = () => { window.location.href = "../challenge-list.html"; };

const btnResetWorkspace = document.getElementById("btn-reset-workspace");
if(btnResetWorkspace) btnResetWorkspace.addEventListener("click", () => {
    workspaceSlots = Array(10).fill(null);
    loopContent = Array(10).fill(null).map(() => Array(2).fill(null));
    functionContent = [null, null]; // Reset Function content
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
        { id: "btn-function", type: "function", label: "{}" }, // Label disesuaikan
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
                    commandQueue.push(...getFunctionCommands());
                } else if (nestedType === "tembak") {
                    nestedCommands.push({ type: "shoot" });
                } else if (nestedType === "jalan") {
                    nestedCommands.push({type:"move", dir:nestedBlock.getAttribute("data-direction")});
                }
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
    functionContent.forEach(nestedBlock => {
        if (!nestedBlock) return;
        const type = nestedBlock.getAttribute("data-type");
        if (type === "tembak") {
            commands.push({ type: "shoot" });
        } else if (type === "jalan") {
            commands.push({type:"move", dir:nestedBlock.getAttribute("data-direction")});
        }
        // Catatan: Function di dalam Function (rekursi) TIDAK didukung di sini 
        // untuk menghindari kerumitan.
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