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
                    x: bx,
                    y: by,
                    baseY: by,
                    frame: 0,
                    timer: 0,
                    floatTimer: 0,
                    color: colorIndex,
                    dying: false,
                    alpha: 1,
                    scale: 1,
                    puff: 0
                });
            }
        }
    }
}

function updateEnemies(dt) {

    enemies.forEach(e => {

        if (!e.dying) {
            // idle flapping (sedikit naik turun)
            e.y += Math.sin(Date.now() / 150) * 0.1;

            // animasi frame
            e.timer += dt;
            if (e.timer > 120) {
                e.timer = 0;
                const anim = butterflyAnimations[e.color];
                e.frame = (e.frame + 1) % anim.frames;
            }

            return;
        }

        // ====================
        // PIXEL-PUFF EFFECT
        // ====================
        e.alpha -= 0.08;
        e.scale += 0.05;
        e.puff += 0.04;

        if (e.alpha <= 0) {
            e.remove = true;
        }
    });

    enemies = enemies.filter(e => !e.remove);
}

function drawEnemies() {
    enemies.forEach(e => {
        const anim = butterflyAnimations[e.color];
        if (!anim) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, e.alpha);

        ctx.translate(e.x, e.y);
        ctx.scale(e.scale, e.scale);

        // puff = blur kecil
        if (e.puff > 0) {
            ctx.filter = `blur(${e.puff}px)`;
        }

        ctx.drawImage(
            anim.img,
            anim.fw * e.frame, 0,
            anim.fw, anim.fh,
            -anim.fw / 2, -anim.fh / 2,
            anim.fw, anim.fh
        );

        ctx.restore();
    });
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