// BLOCK RUNNER — a warm, colorful 8-bit platformer in the spirit of the
// Google Doodle built for Jerry Lawson: a sunny Mario-like world where you
// run, jump, and collect circuit-board parts to build a game cartridge.

const TILE = 16;
const VIEW_COLS = 24; // 384 / 16
const VIEW_ROWS = 16; // 256 / 16

const PALETTE = {
  sky: '#5cc4f2',
  cloud: '#ffffff',
  ground: '#8a5a2b',
  groundTop: '#4caf50',
  platform: '#c97b3d',
  platformMortar: '#8a5a2b',
  skin: '#c98a54',
  hair: '#2b1d14',
  shirt: '#e0792c',
  enemy: '#8a4fd1',
  enemyDark: '#5c2fa0',
  chipBody: '#2b2b2b',
  chipPin: '#d8c828',
  cartBody: '#3a3a3a',
  cartLabel: '#e0792c',
  text: '#1a2f1a',
  outline: '#1a1208',
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

// ---------------------------------------------------------------------
// Level construction helpers — levels are built from ranges/coordinates
// rather than hand-typed ASCII so row lengths can never drift.
// ---------------------------------------------------------------------

function makeLevel({ cols, rows, groundRow, groundRanges, platforms, coins, enemies, flag, player }) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));

  for (const [xStart, xEnd] of groundRanges) {
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = groundRow; y < rows; y++) {
        grid[y][x] = y === groundRow ? '#' : '=';
      }
    }
  }

  const platformTiles = [];
  for (const p of platforms || []) {
    for (let x = p.x; x < p.x + p.length; x++) {
      grid[p.y][x] = '#';
      platformTiles.push({ x, y: p.y });
    }
  }

  for (const [x, y] of coins || []) {
    grid[y][x] = 'C';
  }

  if (flag) grid[flag.y][flag.x] = 'F';

  return {
    cols, rows, grid, platformTiles,
    widthPx: cols * TILE,
    heightPx: rows * TILE,
    enemies: (enemies || []).map(e => ({ ...e })),
    coinsTotal: (coins || []).length,
    playerStart: { x: player.x * TILE, y: player.y * TILE },
  };
}

function isSolid(level, row, col) {
  if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) return row >= level.rows ? false : true;
  const t = level.grid[row][col];
  return t === '#' || t === '=';
}

const LEVELS = [
  makeLevel({
    cols: 40, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 14], [18, 39]],
    platforms: [{ x: 21, y: 10, length: 4 }, { x: 30, y: 11, length: 3 }],
    coins: [[4, 13], [8, 13], [22, 9], [23, 9], [31, 10], [35, 13], [36, 13]],
    enemies: [{ x: 10 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 40 }],
    flag: { x: 38, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 48, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 10], [13, 20], [24, 30], [34, 47]],
    platforms: [
      { x: 15, y: 11, length: 3 },
      { x: 26, y: 9, length: 3 },
      { x: 37, y: 10, length: 3 },
      { x: 41, y: 7, length: 3 },
    ],
    coins: [[5, 13], [16, 10], [27, 8], [28, 8], [38, 9], [42, 6], [43, 6], [45, 13]],
    enemies: [
      { x: 14 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 55 },
      { x: 25 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 55 },
      { x: 41 * TILE, y: 6 * TILE, w: 14, h: 14, speed: 45 },
    ],
    flag: { x: 46, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 56, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 8], [11, 15], [19, 22], [26, 29], [33, 38], [42, 55]],
    platforms: [
      { x: 12, y: 10, length: 2 },
      { x: 20, y: 11, length: 2 },
      { x: 27, y: 9, length: 2 },
      { x: 34, y: 8, length: 2 },
      { x: 44, y: 11, length: 3 },
      { x: 49, y: 8, length: 3 },
    ],
    coins: [[4, 13], [12, 9], [20, 10], [27, 8], [34, 7], [45, 10], [50, 7], [51, 7], [53, 13]],
    enemies: [
      { x: 3 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 60 },
      { x: 12 * TILE, y: 9 * TILE, w: 14, h: 14, speed: 50 },
      { x: 27 * TILE, y: 8 * TILE, w: 14, h: 14, speed: 50 },
      { x: 45 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 65 },
    ],
    flag: { x: 54, y: 13 },
    player: { x: 1, y: 13 },
  }),
];

// ---------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------

const STATE = { TITLE: 'title', PLAYING: 'playing', LEVEL_DONE: 'levelDone', DEAD: 'dead', GAME_OVER: 'gameOver', WIN: 'win' };

let state = STATE.TITLE;
let levelIndex = 0;
let score = 0;
let lives = 3;
let camX = 0;
let stateTimer = 0;

const GRAVITY = 900;
const JUMP_VELOCITY = -330;
const MOVE_SPEED = 110;
const TERMINAL_VY = 500;

let player, level, enemies, coins;

function loadLevel(i) {
  level = LEVELS[i];
  player = {
    x: level.playerStart.x, y: level.playerStart.y,
    w: 14, h: 15, vx: 0, vy: 0, grounded: false, facing: 1,
  };
  enemies = level.enemies.map(e => {
    const bounds = findPatrolBounds(level, Math.round(e.y / TILE), Math.round(e.x / TILE), e.range || 3);
    return { ...e, dir: 1, minX: bounds.min, maxX: bounds.max };
  });
  coins = [];
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === 'C') coins.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE, taken: false });
    }
  }
  camX = 0;
}

function findPatrolBounds(level, row, col, range) {
  let left = col;
  while (left - 1 >= 0 && left > col - range && isSolid(level, row + 1, left - 1) && !isSolid(level, row, left - 1)) left--;
  let right = col;
  while (right + 1 < level.cols && right < col + range && isSolid(level, row + 1, right + 1) && !isSolid(level, row, right + 1)) right++;
  return { min: left * TILE, max: (right + 1) * TILE - 14 };
}

function resetGame() {
  levelIndex = 0;
  score = 0;
  lives = 3;
  loadLevel(levelIndex);
}

// ---------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Enter') {
    if (state === STATE.TITLE || state === STATE.GAME_OVER || state === STATE.WIN) {
      resetGame();
      state = STATE.PLAYING;
    }
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function isLeft() { return keys['ArrowLeft'] || keys['KeyA']; }
function isRight() { return keys['ArrowRight'] || keys['KeyD']; }
function isJump() { return keys['Space'] || keys['ArrowUp'] || keys['KeyW']; }

// ---------------------------------------------------------------------
// Physics / collision
// ---------------------------------------------------------------------

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveAndCollide(entity, dx, dy) {
  entity.x += dx;
  resolveAxis(entity, 'x', dx);
  entity.y += dy;
  entity.grounded = false;
  resolveAxis(entity, 'y', dy);
}

function resolveAxis(entity, axis, delta) {
  if (delta === 0) return;
  const left = Math.floor(entity.x / TILE);
  const right = Math.floor((entity.x + entity.w - 1) / TILE);
  const top = Math.floor(entity.y / TILE);
  const bottom = Math.floor((entity.y + entity.h - 1) / TILE);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (!isSolid(level, row, col)) continue;
      if (axis === 'x') {
        if (delta > 0) entity.x = col * TILE - entity.w;
        else entity.x = (col + 1) * TILE;
        entity.vx = 0;
      } else {
        if (delta > 0) { entity.y = row * TILE - entity.h; entity.grounded = true; }
        else entity.y = (row + 1) * TILE;
        entity.vy = 0;
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------

function killPlayer() {
  lives--;
  if (lives <= 0) {
    state = STATE.GAME_OVER;
  } else {
    state = STATE.DEAD;
    stateTimer = 1.0;
  }
}

function update(dt) {
  if (state === STATE.PLAYING) {
    updatePlaying(dt);
  } else if (state === STATE.DEAD) {
    stateTimer -= dt;
    if (stateTimer <= 0) {
      player.x = level.playerStart.x;
      player.y = level.playerStart.y;
      player.vx = 0; player.vy = 0;
      state = STATE.PLAYING;
    }
  } else if (state === STATE.LEVEL_DONE) {
    stateTimer -= dt;
    if (stateTimer <= 0) {
      levelIndex++;
      if (levelIndex >= LEVELS.length) {
        state = STATE.WIN;
      } else {
        loadLevel(levelIndex);
        state = STATE.PLAYING;
      }
    }
  }
}

function updatePlaying(dt) {
  player.vx = isLeft() ? -MOVE_SPEED : isRight() ? MOVE_SPEED : 0;
  if (player.vx < 0) player.facing = -1;
  if (player.vx > 0) player.facing = 1;

  if (isJump() && player.grounded) {
    player.vy = JUMP_VELOCITY;
  }

  player.vy = Math.min(player.vy + GRAVITY * dt, TERMINAL_VY);

  moveAndCollide(player, player.vx * dt, player.vy * dt);

  if (player.y > level.heightPx + 64) {
    killPlayer();
    return;
  }

  for (const en of enemies) {
    en.x += en.dir * en.speed * dt;
    if (en.x < en.minX) { en.x = en.minX; en.dir = 1; }
    if (en.x > en.maxX) { en.x = en.maxX; en.dir = -1; }
    if (rectsOverlap(player, en)) {
      killPlayer();
      return;
    }
  }

  for (const c of coins) {
    if (!c.taken && rectsOverlap(player, c)) {
      c.taken = true;
      score += 10;
    }
  }

  const fx = getFlagTile();
  if (fx && rectsOverlap(player, fx)) {
    score += 50;
    state = STATE.LEVEL_DONE;
    stateTimer = 1.4;
  }

  const halfView = (VIEW_COLS * TILE) / 2;
  camX = Math.max(0, Math.min(player.x + player.w / 2 - halfView, level.widthPx - VIEW_COLS * TILE));
}

function getFlagTile() {
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === 'F') return { x: x * TILE, y: y * TILE, w: TILE, h: TILE };
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------

function draw() {
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  updateHud();

  if (state === STATE.TITLE) { drawTitle(); return; }
  if (state === STATE.GAME_OVER) { drawMessage('GAME OVER', `SCORE: ${score}`, 'PRESS ENTER TO RESTART'); return; }
  if (state === STATE.WIN) { drawMessage('YOU WIN!', `SCORE: ${score}`, 'PRESS ENTER TO PLAY AGAIN'); return; }

  drawLevel();
  drawEnemies();
  drawCoins();
  drawPlayer();

  if (state === STATE.LEVEL_DONE) {
    drawBanner('LEVEL COMPLETE');
  }
}

function drawCloud(cx, cy) {
  ctx.fillStyle = PALETTE.cloud;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 16, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 12, cy - 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(cx - 12, cy - 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTitle() {
  drawCloud(70, 40);
  drawCloud(300, 60);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BLOCK RUNNER', canvas.width / 2, 100);
  ctx.font = '9px monospace';
  ctx.fillText('build the cartridge, level by level', canvas.width / 2, 120);
  ctx.fillText('PRESS ENTER TO START', canvas.width / 2, 160);
  ctx.textAlign = 'left';
}

function drawMessage(title, sub, hint) {
  drawCloud(70, 40);
  drawCloud(300, 60);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 100);
  ctx.font = '10px monospace';
  ctx.fillText(sub, canvas.width / 2, 130);
  ctx.fillText(hint, canvas.width / 2, 160);
  ctx.textAlign = 'left';
}

function drawBanner(text) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(0, 100, canvas.width, 32);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, 122);
  ctx.textAlign = 'left';
}

function drawLevel() {
  drawCloud(60, 30);
  drawCloud(220, 45);
  drawCloud(340, 25);

  const startCol = Math.floor(camX / TILE);
  const endCol = Math.min(level.cols - 1, startCol + VIEW_COLS + 1);
  for (let row = 0; row < level.rows; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const t = level.grid[row][col];
      if (t !== '#' && t !== '=') continue;
      const px = col * TILE - camX;
      const py = row * TILE;
      if (t === '#') {
        ctx.fillStyle = PALETTE.groundTop;
        ctx.fillRect(px, py, TILE, TILE);
      } else {
        ctx.fillStyle = PALETTE.ground;
        ctx.fillRect(px, py, TILE, TILE);
      }
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
  }

  // floating platforms get a brick pattern instead of dirt/grass, so they
  // read as separate, jumpable blocks against the ground tiles
  for (const p of level.platformTiles || []) {
    const px = p.x * TILE - camX;
    const py = p.y * TILE;
    ctx.fillStyle = PALETTE.platform;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = PALETTE.platformMortar;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = PALETTE.outline;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  const flag = getFlagTile();
  if (flag) {
    const px = flag.x - camX;
    const py = flag.y;
    // a game cartridge standing on end — the level's goal is delivering it
    ctx.fillStyle = PALETTE.cartBody;
    ctx.fillRect(px + 2, py - 14, 12, 14);
    ctx.fillStyle = PALETTE.cartLabel;
    ctx.fillRect(px + 4, py - 11, 8, 5);
    ctx.fillStyle = PALETTE.outline;
    ctx.fillRect(px + 4, py - 16, 8, 2);
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 2.5, py - 13.5, 11, 13);
  }
}

function outlinedBlock(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

function drawEnemies() {
  for (const en of enemies) {
    const px = en.x - camX;
    if (px < -TILE || px > canvas.width) continue;
    const cx = px + en.w / 2;
    const cy = en.y + en.h / 2;
    ctx.fillStyle = PALETTE.enemy;
    ctx.beginPath();
    ctx.ellipse(cx, cy, en.w / 2, en.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.enemyDark;
    ctx.fillRect(px + en.w / 2 - 4, en.y + 4, 3, 3);
    ctx.fillRect(px + en.w / 2 + 1, en.y + 4, 3, 3);
  }
}

function drawCoins() {
  // circuit-board chips to collect, echoing the cartridge-building theme
  for (const c of coins) {
    if (c.taken) continue;
    const px = c.x - camX;
    if (px < -TILE || px > canvas.width) continue;
    const bx = px + 3, by = c.y + 4, bw = TILE - 6, bh = TILE - 8;
    ctx.fillStyle = PALETTE.chipPin;
    for (let i = 0; i < 3; i++) {
      const pinX = bx + 2 + i * 4;
      ctx.fillRect(pinX, by - 2, 2, 2);
      ctx.fillRect(pinX, by + bh, 2, 2);
    }
    ctx.fillStyle = PALETTE.chipBody;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  }
}

function drawPlayer() {
  const px = player.x - camX;
  const py = player.y;
  // a small Lawson-inspired sprite: shirt, skin tone, glasses, mustache, afro
  ctx.fillStyle = PALETTE.shirt;
  ctx.fillRect(px, py + 6, player.w, player.h - 6);
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(px + 2, py + 3, player.w - 4, 6);
  ctx.fillStyle = PALETTE.hair;
  ctx.fillRect(px + 1, py, player.w - 2, 4);
  ctx.fillRect(px, py + 2, 2, 3);
  ctx.fillRect(px + player.w - 2, py + 2, 2, 3);
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(px + 3, py + 7, player.w - 6, 1);
  const eyeX = player.facing > 0 ? px + player.w - 5 : px + 2;
  ctx.fillRect(eyeX, py + 5, 2, 2);
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, player.w - 1, player.h - 1);
}

function updateHud() {
  scoreEl.textContent = `SCORE: ${score}`;
  livesEl.textContent = `LIVES: ${Math.max(lives, 0)}`;
  levelEl.textContent = `LEVEL: ${levelIndex + 1}`;
}

// ---------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------

let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 1 / 30);
  lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

loadLevel(0);
requestAnimationFrame(loop);
