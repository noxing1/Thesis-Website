const bee = { x:0, y:0, frame:0, state:"idle", facing:"right" };

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

function resetBee() {
  hasDied = false;
  findBeeSpawn();
  bee.state = "idle";
  bee.frame = 0;

  // Tidak langsung jalan; user harus tekan run lagi
  isRunningCommands = false;

  // Jangan jalankan commandQueue otomatis
}

function triggerLose() {
  if (hasDied) return;
  hasDied = true;

  isRunningCommands = false;
  bee.state = "death";
  bee.frame = 0;

  showResetButton();
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
