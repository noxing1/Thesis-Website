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
