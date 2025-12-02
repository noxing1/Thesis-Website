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

function runIntroCameraSequence() {
  cameraToBee(() => {
    cameraToFlower(() => {
      cameraBackToBee(() => {
        cam.lockOnBee = true; // kembali ke mode follow lebah
      });
    });
  });
}