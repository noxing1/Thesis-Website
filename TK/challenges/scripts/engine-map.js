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
