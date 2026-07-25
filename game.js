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

// Every platform below is placed so it's reachable by a real jump: the
// player's jump physics (JUMP_VELOCITY/GRAVITY) cap a single jump at ~3
// tiles of rise and ~4 tiles of horizontal gap, so anything taller is
// built as a staircase of ≤3-tile steps instead of one tall platform.
const LEVELS = [
  makeLevel({
    cols: 40, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 14], [18, 39]],
    platforms: [{ x: 21, y: 11, length: 4 }, { x: 30, y: 11, length: 3 }],
    coins: [[4, 13], [8, 13], [22, 10], [23, 10], [31, 10], [35, 13], [36, 13]],
    enemies: [{ x: 10 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 40 }],
    flag: { x: 38, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 48, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 10], [13, 20], [24, 30], [34, 47]],
    platforms: [
      { x: 15, y: 11, length: 3 },
      { x: 26, y: 11, length: 3 },
      { x: 37, y: 11, length: 3 },
      { x: 40, y: 8, length: 3 },
    ],
    coins: [[5, 13], [16, 10], [27, 10], [28, 10], [38, 10], [41, 7], [42, 7], [45, 13]],
    enemies: [
      { x: 14 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 55 },
      { x: 25 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 55 },
      { x: 36 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 45 },
    ],
    flag: { x: 46, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 56, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 8], [11, 15], [19, 22], [26, 29], [33, 38], [42, 55]],
    platforms: [
      { x: 12, y: 11, length: 3 },
      { x: 20, y: 11, length: 2 },
      { x: 27, y: 11, length: 2 },
      { x: 29, y: 8, length: 2 },
      { x: 34, y: 11, length: 2 },
      { x: 36, y: 8, length: 2 },
      { x: 44, y: 11, length: 3 },
      { x: 49, y: 8, length: 3 },
    ],
    coins: [[13, 10], [20, 10], [27, 10], [29, 7], [34, 10], [36, 7], [45, 10], [50, 7], [51, 7], [4, 13], [53, 13]],
    enemies: [
      { x: 3 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 60 },
      { x: 13 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 50 },
      { x: 28 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 50 },
      { x: 45 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 65 },
    ],
    flag: { x: 54, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 60, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 9], [12, 17], [21, 26], [30, 37], [41, 48], [52, 59]],
    platforms: [
      { x: 13, y: 11, length: 3 },
      { x: 22, y: 11, length: 3 },
      { x: 25, y: 8, length: 2 },
      { x: 31, y: 11, length: 3 },
      { x: 42, y: 11, length: 3 },
      { x: 45, y: 8, length: 2 },
      { x: 53, y: 11, length: 3 },
    ],
    coins: [[14, 10], [15, 10], [23, 10], [25, 7], [26, 7], [32, 10], [43, 10], [45, 7], [46, 7], [54, 10], [55, 10], [4, 13], [35, 13], [57, 13]],
    enemies: [
      { x: 4 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 60 },
      { x: 14 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 50 },
      { x: 23 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 65 },
      { x: 32 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 55 },
      { x: 53 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 70 },
    ],
    flag: { x: 58, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 66, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 9], [12, 16], [20, 25], [29, 34], [38, 45], [49, 56], [60, 65]],
    platforms: [
      { x: 13, y: 11, length: 3 },
      { x: 21, y: 11, length: 3 },
      { x: 24, y: 8, length: 2 },
      { x: 30, y: 11, length: 3 },
      { x: 39, y: 11, length: 3 },
      { x: 42, y: 8, length: 2 },
      { x: 45, y: 5, length: 2 },
      { x: 50, y: 11, length: 3 },
      { x: 61, y: 11, length: 3 },
    ],
    coins: [[14, 10], [22, 10], [24, 7], [31, 10], [32, 10], [40, 10], [42, 7], [43, 7], [45, 4], [51, 10], [52, 10], [62, 10], [4, 13], [54, 13], [63, 13]],
    enemies: [
      { x: 4 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 65 },
      { x: 14 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 55 },
      { x: 22 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 70 },
      { x: 31 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 60 },
      { x: 40 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 75 },
      { x: 51 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 60 },
      { x: 62 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 80 },
    ],
    flag: { x: 64, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 72, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 8], [11, 15], [19, 24], [28, 33], [37, 42], [46, 53], [57, 62], [66, 71]],
    platforms: [
      { x: 12, y: 11, length: 3 },
      { x: 20, y: 11, length: 3 },
      { x: 23, y: 8, length: 2 },
      { x: 29, y: 11, length: 3 },
      { x: 38, y: 11, length: 3 },
      { x: 41, y: 8, length: 2 },
      { x: 47, y: 11, length: 3 },
      { x: 50, y: 8, length: 2 },
      { x: 58, y: 11, length: 3 },
      { x: 67, y: 11, length: 3 },
    ],
    coins: [[13, 10], [21, 10], [23, 7], [30, 10], [31, 10], [39, 10], [41, 7], [42, 7], [48, 10], [50, 7], [59, 10], [60, 10], [68, 10], [4, 13], [69, 13]],
    enemies: [
      { x: 4 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 65 },
      { x: 13 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 55 },
      { x: 21 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 70 },
      { x: 30 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 60 },
      { x: 39 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 75 },
      { x: 48 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 65 },
      { x: 59 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 80 },
      { x: 68 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 65 },
    ],
    flag: { x: 70, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 80, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 8], [11, 15], [19, 24], [28, 33], [37, 42], [46, 51], [55, 60], [64, 69], [73, 79]],
    platforms: [
      { x: 12, y: 11, length: 3 },
      { x: 20, y: 11, length: 3 },
      { x: 23, y: 8, length: 2 },
      { x: 29, y: 11, length: 3 },
      { x: 38, y: 11, length: 3 },
      { x: 41, y: 8, length: 2 },
      { x: 44, y: 5, length: 2 },
      { x: 47, y: 11, length: 3 },
      { x: 56, y: 11, length: 3 },
      { x: 59, y: 8, length: 2 },
      { x: 65, y: 11, length: 3 },
      { x: 74, y: 11, length: 3 },
    ],
    coins: [[13, 10], [21, 10], [23, 7], [30, 10], [31, 10], [39, 10], [41, 7], [44, 4], [48, 10], [57, 10], [59, 7], [60, 7], [66, 10], [67, 10], [75, 10], [4, 13], [76, 13]],
    enemies: [
      { x: 4 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 70 },
      { x: 13 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 60 },
      { x: 21 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 75 },
      { x: 30 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 65 },
      { x: 39 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 80 },
      { x: 48 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 65 },
      { x: 57 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 70 },
      { x: 66 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 85 },
      { x: 75 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 70 },
    ],
    flag: { x: 77, y: 13 },
    player: { x: 1, y: 13 },
  }),
  makeLevel({
    cols: 88, rows: VIEW_ROWS, groundRow: 14,
    groundRanges: [[0, 8], [11, 15], [19, 24], [28, 33], [37, 42], [46, 51], [55, 60], [64, 69], [73, 78], [82, 87]],
    platforms: [
      { x: 12, y: 11, length: 3 },
      { x: 20, y: 11, length: 3 },
      { x: 23, y: 8, length: 2 },
      { x: 29, y: 11, length: 3 },
      { x: 38, y: 11, length: 3 },
      { x: 41, y: 8, length: 2 },
      { x: 44, y: 5, length: 2 },
      { x: 47, y: 11, length: 3 },
      { x: 56, y: 11, length: 3 },
      { x: 59, y: 8, length: 2 },
      { x: 65, y: 11, length: 3 },
      { x: 68, y: 8, length: 2 },
      { x: 74, y: 11, length: 3 },
      { x: 83, y: 11, length: 3 },
    ],
    coins: [
      [13, 10], [21, 10], [23, 7], [30, 10], [31, 10], [39, 10], [41, 7], [44, 4],
      [48, 10], [57, 10], [59, 7], [60, 7], [66, 10], [68, 7], [75, 10], [76, 10],
      [84, 10], [85, 10], [4, 13], [76, 13],
    ],
    enemies: [
      { x: 4 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 70 },
      { x: 13 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 60 },
      { x: 21 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 75 },
      { x: 30 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 65 },
      { x: 39 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 80 },
      { x: 48 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 65 },
      { x: 57 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 70 },
      { x: 66 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 85 },
      { x: 75 * TILE, y: 10 * TILE, w: 14, h: 14, speed: 75 },
      { x: 84 * TILE, y: 13 * TILE, w: 14, h: 14, speed: 90 },
    ],
    flag: { x: 86, y: 13 },
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
// The bounce after stomping an enemy should clear one extra tile of height
// compared to the base 0.6x bounce, computed from the height formula
// (v^2 / 2g) so it stays correct if the base jump ever changes.
const BASE_STOMP_HEIGHT = ((JUMP_VELOCITY * 0.6) ** 2) / (2 * GRAVITY);
const STOMP_BOUNCE_VELOCITY = -Math.sqrt(2 * GRAVITY * (BASE_STOMP_HEIGHT + TILE));

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

  const prevBottom = player.y + player.h;
  moveAndCollide(player, player.vx * dt, player.vy * dt);

  if (player.y > level.heightPx + 64) {
    killPlayer();
    return;
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    en.x += en.dir * en.speed * dt;
    if (en.x < en.minX) { en.x = en.minX; en.dir = 1; }
    if (en.x > en.maxX) { en.x = en.maxX; en.dir = -1; }
    if (rectsOverlap(player, en)) {
      // A stomp is judged by where the player WAS a moment ago, not by how
      // deep the overlap ended up — the player must have been above the
      // enemy's head before this frame's move, otherwise a same-height
      // walk-in reads as a landing purely by coincidence of frame timing.
      const stomped = player.vy >= 0 && prevBottom <= en.y + 4;
      if (stomped) {
        enemies.splice(i, 1);
        player.vy = STOMP_BOUNCE_VELOCITY;
        score += 20;
      } else {
        killPlayer();
        return;
      }
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
