// === TETRIS GAME LOGIC ===

// Canvas setup
const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
const SCALE = 20; // 20x20 pixel blocks
context.scale(SCALE, SCALE);

// Mini canvases for next & hold
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
nextCtx.scale(8, 8); // mini scale

const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");
holdCtx.scale(8, 8);

// UI elements
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

// Game state
let arena = createMatrix(10, 20);
let player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  next: null,
  hold: null,
  score: 0,
  lines: 0,
  level: 0,
  canHold: true
};

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let running = false;
let paused = false;

// Piece colors
const colors = {
  0: null,
  1: '#00FFFF', // I
  2: '#0000FF', // J
  3: '#FFA500', // L
  4: '#FFFF00', // O
  5: '#00FF00', // S
  6: '#800080', // T
  7: '#FF0000'  // Z
};

// === Core functions ===
function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case 'I': return [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]];
    case 'J': return [[2,0,0],[2,2,2],[0,0,0]];
    case 'L': return [[0,0,3],[3,3,3],[0,0,0]];
    case 'O': return [[4,4],[4,4]];
    case 'S': return [[0,5,5],[5,5,0],[0,0,0]];
    case 'T': return [[0,6,0],[6,6,6],[0,0,0]];
    case 'Z': return [[7,7,0],[0,7,7],[0,0,0]];
  }
}

// bag randomizer
let bag = [];
function randomPiece() {
  if (bag.length === 0) {
    bag = 'TJLOSZI'.split('');
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function clear(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

function drawMatrix(ctx, matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.06;
        ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 &&
         (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function rotatePlayer(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) continue outer;
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++rowCount;
    ++y;
  }
  if (rowCount > 0) {
    const pointsPer = [0, 40, 100, 300, 1200];
    player.score += pointsPer[rowCount] * (player.level + 1);
    player.lines += rowCount;
    const newLevel = Math.floor(player.lines / 10);
    if (newLevel > player.level) {
      player.level = newLevel;
      dropInterval = Math.max(100, 1000 * Math.pow(0.9, player.level));
    }
  }
}

// === Drawing and updating ===
function draw() {
  clear(context, canvas.width, canvas.height);
  drawMatrix(context, arena, { x: 0, y: 0 });
  drawMatrix(context, player.matrix, player.pos);

  // next piece
  clear(nextCtx, nextCanvas.width, nextCanvas.height);
  if (player.next) {
    const nx = Math.floor((4 - player.next[0].length) / 2);
    const ny = Math.floor((4 - player.next.length) / 2);
    drawMatrix(nextCtx, player.next, { x: nx, y: ny });
  }

  // hold piece
  clear(holdCtx, holdCanvas.width, holdCanvas.height);
  if (player.hold) {
    const hx = Math.floor((4 - player.hold[0].length) / 2);
    const hy = Math.floor((4 - player.hold.length) / 2);
    drawMatrix(holdCtx, player.hold, { x: hx, y: hy });
  }
}

function update(time = 0) {
  if (!running || paused) {
    lastTime = time;
    requestAnimationFrame(update);
    return;
  }
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) playerDrop();
  draw();
  requestAnimationFrame(update);
}

// === Player operations ===
function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    arenaSweep();
    updateScore();
    playerReset();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  let dropDistance = 0;
  while (!collide(arena, player)) {
    player.pos.y++;
    dropDistance++;
  }
  player.pos.y--;
  dropDistance--;
  merge(arena, player);
  player.score += Math.max(0, dropDistance) * 2;
  arenaSweep();
  updateScore();
  playerReset();
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
}

function playerReset() {
  player.matrix = player.next ? player.next : createPiece(randomPiece());
  player.next = createPiece(randomPiece());
  player.pos.y = 0;
  player.pos.x = Math.floor((arena[0].length / 2) - (player.matrix[0].length / 2));
  player.canHold = true;

  if (collide(arena, player)) {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.level = 0;
    player.lines = 0;
    dropInterval = 1000;
    updateScore();
  }
}

function holdPiece() {
  if (!player.canHold) return;
  player.canHold = false;
  if (!player.hold) {
    player.hold = player.matrix;
    player.matrix = player.next;
    player.next = createPiece(randomPiece());
  } else {
    const tmp = player.hold;
    player.hold = player.matrix;
    player.matrix = tmp;
  }
  player.pos.y = 0;
  player.pos.x = Math.floor((arena[0].length / 2) - (player.matrix[0].length / 2));
  if (collide(arena, player)) {
    const temp = player.hold;
    player.hold = player.matrix;
    player.matrix = temp;
  }
}

function updateScore() {
  scoreEl.textContent = player.score;
  levelEl.textContent = player.level;
  linesEl.textContent = player.lines;
}

// === Controls ===
document.addEventListener("keydown", event => {
  if (!running) return;
  if (event.key === 'ArrowLeft') playerMove(-1);
  else if (event.key === 'ArrowRight') playerMove(1);
  else if (event.key === 'ArrowDown') playerDrop();
  else if (event.key === ' ') {
    event.preventDefault();
    playerHardDrop();
  } else if (event.key === 'ArrowUp') rotatePlayer(1);
  else if (event.key.toLowerCase() === 'z') rotatePlayer(-1);
  else if (event.key === 'Shift') holdPiece();
  else if (event.key.toLowerCase() === 'p') togglePause();
  draw();
});

// === Buttons ===
startBtn.addEventListener('click', () => {
  if (!running) startGame();
  else if (paused) togglePause();
});
pauseBtn.addEventListener('click', () => togglePause());
resetBtn.addEventListener('click', () => resetGame());

// === Game states ===
function startGame() {
  running = true;
  paused = false;
  arena = createMatrix(10, 20);
  player.score = 0;
  player.lines = 0;
  player.level = 0;
  dropInterval = 1000;
  player.next = createPiece(randomPiece());
  player.hold = null;
  player.matrix = createPiece(randomPiece());
  player.pos = { x: Math.floor((arena[0].length / 2) - (player.matrix[0].length / 2)), y: 0 };
  player.canHold = true;
  updateScore();
  lastTime = performance.now();
  requestAnimationFrame(update);
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
}

function resetGame() {
  running = false;
  paused = false;
  arena = createMatrix(10, 20);
  player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    next: null,
    hold: null,
    score: 0,
    lines: 0,
    level: 0,
    canHold: true
  };
  dropInterval = 1000;
  scoreEl.textContent = '0';
  levelEl.textContent = '0';
  linesEl.textContent = '0';
  pauseBtn.textContent = '⏸ Pause';
  clear(context, canvas.width, canvas.height);
  clear(nextCtx, nextCanvas.width, nextCanvas.height);
  clear(holdCtx, holdCanvas.width, holdCanvas.height);
}

// === Initial preview ===
clear(context, canvas.width, canvas.height);
clear(nextCtx, nextCanvas.width, nextCanvas.height);
clear(holdCtx, holdCanvas.width, holdCanvas.height);

player.next = createPiece(randomPiece());
player.hold = null;
player.matrix = createPiece(randomPiece());
player.pos = { x: Math.floor((arena[0].length / 2) - (player.matrix[0].length / 2)), y: 0 };
draw();
updateScore();
