window.addEventListener("load", async () => {

    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");

    await loadMap();
    await loadBee();
    await loadButterflies();
    await loadProjectile();

    findBeeSpawn();
    loadEnemySpawn();

    canvas.width = mapData.width * DRAW_SIZE;
    canvas.height = mapData.height * DRAW_SIZE;

    requestAnimationFrame(gameLoop);
});

function gameLoop(ts){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    updateCamera();
    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    renderTiledMap();
    updateBee(ts);
    drawBee();
    updateProjectiles(ts);
    drawProjectiles();
    updateEnemies(ts);
    drawEnemies();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}
