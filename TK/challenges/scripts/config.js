// ============= CONFIG GLOBAL =============

// ganti ini di setiap halaman challenge
// nanti halaman challenge-list.html akan mengirim ID ini
window.CHALLENGE_ID = 1;

// lokasi JSON untuk setiap challenge
window.CHALLENGE_MAPS = {
    1: "../../../Asset/Sprites/Background-easy-walk.json",
};

// ukuran grid & tileset
const TILE_SIZE = 16;
const DRAW_SIZE = 24;

const BEE_SCALE = 0.9;
const PROJECTILE_SCALE = 1;

let commandQueue = [];
let workspaceSlots = Array(10).fill(null);

let mapData = null;
let enemies = [];
let projectiles = [];

let hasDied = false;
let isRunningCommands = false;

let ctx, canvas;
