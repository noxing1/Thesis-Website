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

function placeBlockIntoWorkspace(index, block) {
  if (isFromWorkspace) {
    workspaceSlots[originalSlotIndex] = null;
  }

  workspaceSlots[index] = block;
  renderWorkspace();
}

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

//function buildCommandQueue(){ ... }
