(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
  
    const keys = {};
    document.addEventListener('keydown', e => keys[e.key] = true);
    document.addEventListener('keyup', e => keys[e.key] = false);
  
    const player = { x: width / 2, y: height - 80, w: 40, h: 56, speed: 5, cooldown: 0 };
    const bullets = [];
    const enemies = [];
    let score = 0;
    let running = false;
    let spawnTimer = 0;
  
    function startGame() {
      player.x = width / 2;
      bullets.length = 0;
      enemies.length = 0;
      score = 0;
      spawnTimer = 0;
      running = true;
      loop();
    }
    document.getElementById('startGame').addEventListener('click', startGame);
  
    function shoot() {
      if (player.cooldown > 0) return;
      bullets.push({ x: player.x + player.w / 2, y: player.y + 6, r: 4, vy: -8 });
      player.cooldown = 12;
    }
  
    function spawnEnemy() {
      const ex = Math.random() * (width - 30) + 15;
      const size = 18 + Math.random() * 28;
      const speed = 1.5 + Math.random() * 2.5;
      enemies.push({ x: ex, y: -size, r: size, vy: speed });
    }
  
    function collides(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y;
      const r = (a.r || Math.max(a.w, a.h)/2) + (b.r || Math.max(b.w, b.h)/2);
      return dx*dx + dy*dy < r*r;
    }
  
    function drawPlayer() {
      const px = player.x, py = player.y;
      ctx.fillStyle = '#89a'; ctx.fillRect(px, py + 14, player.w, player.h - 14);
      ctx.fillStyle = '#c4a77b'; ctx.fillRect(px + 10, py, 20, 18);
      ctx.fillStyle = '#334'; ctx.fillRect(px + 6, py - 6, 28, 10);
      ctx.fillStyle = '#222'; ctx.fillRect(px + player.w - 6, py + 26, 24, 6);
    }
  
    function draw() {
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle = '#06121a';
      ctx.fillRect(0,0,width,height);
      ctx.fillStyle = '#bfe'; ctx.font = '18px sans-serif';
      ctx.fillText('Score: ' + score, 12, 24);
  
      bullets.forEach(b => { ctx.beginPath(); ctx.fillStyle = '#ffd'; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); });
      enemies.forEach(e => { ctx.beginPath(); ctx.fillStyle = '#f86'; ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill(); });
      drawPlayer();
    }
  
    function update() {
      if (keys['ArrowLeft'] || keys['a']) player.x -= player.speed;
      if (keys['ArrowRight'] || keys['d']) player.x += player.speed;
      if (player.x < 0) player.x = 0;
      if (player.x + player.w > width) player.x = width - player.w;
      if (keys[' '] || keys['Spacebar']) shoot();
      if (player.cooldown > 0) player.cooldown--;
  
      for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y += bullets[i].vy;
        if (bullets[i].y < -10) bullets.splice(i, 1);
      }
  
      spawnTimer++;
      if (spawnTimer > 40) { spawnEnemy(); spawnTimer = 0; }
  
      for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].y += enemies[i].vy;
        if (enemies[i].y - enemies[i].r > height + 50) enemies.splice(i, 1);
      }
  
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        for (let j = bullets.length - 1; j >= 0; j--) {
          if (collides(e, bullets[j])) {
            enemies.splice(i, 1);
            bullets.splice(j, 1);
            score += 10;
            break;
          }
        }
      }
  
      for (const e of enemies) {
        const p = { x: player.x + player.w / 2, y: player.y + player.h / 2, r: Math.max(player.w, player.h)/2 };
        if (collides(e, p)) running = false;
      }
    }
  
    function loop() {
      update(); draw();
      if (running) requestAnimationFrame(loop);
      else {
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,width,height);
        ctx.fillStyle='#fff'; ctx.font='40px sans-serif'; ctx.textAlign='center';
        ctx.fillText('Game Over — Score: '+score, width/2, height/2);
      }
    }
  })();
  