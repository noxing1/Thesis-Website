// GLOBAL ANIMATION STORAGE
var beeAnimations = {
    idle: null,
    walk: null,
    death: null,
    shoot: null
};

var butterflyAnimations = [];
var butterflyColors = ["Blue", "Green", "Purple", "Yellow", "Grey", "Pink"];

async function loadMap() {
  const res = await fetch("../Asset/Sprites/Background-easy-walk.json");
  mapData = await res.json();
  console.log("MAP LOADED", mapData);
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

async function loadBee() {
  beeAnimations.idle  = await loadAnim("normal");
  beeAnimations.walk  = await loadAnim("normal");  // pakai anim sama
  beeAnimations.death = await loadAnim("death");
  beeAnimations.shoot = await loadAnim("shoot");
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
