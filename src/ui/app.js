// Monogram — app-controller (browser).
// Bindt de pure spellogica uit ../core aan de DOM.

import { computeClues, isSolved, lineSatisfaction, generateUniquePuzzle } from '../core/nonogram.js';
import { PUZZLES, getPuzzle, DIFFICULTY_ORDER, DIFFICULTY_LABELS } from '../core/puzzles.js';
import { generateLevel, levelConfig, starRating } from '../core/levels.js';

// ------------------------------------------------------------ Opslag
const STORE = {
  progress: 'monogram:progress',
  settings: 'monogram:settings',
  levels: 'monogram:levels',
  save: (id) => `monogram:save:${id}`,
};

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const writeJSON = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* privé-modus */ }
};

let progress = readJSON(STORE.progress, {});
let settings = readJSON(STORE.settings, { theme: 'light', sound: true, autoCross: true });
// Levels: hoogste ontgrendelde level + beste tijd/sterren per level.
let levelData = readJSON(STORE.levels, { unlocked: 1, best: {}, stars: {} });

// ------------------------------------------------------------ Geluid
const audio = (() => {
  let ctx = null;
  const ensure = () => {
    if (!settings.sound) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, dur = 0.08, type = 'sine', gain = 0.06) => {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g); g.connect(c.destination);
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t); osc.stop(t + dur);
  };
  return {
    fill: () => tone(440, 0.06, 'square', 0.05),
    cross: () => tone(240, 0.05, 'sine', 0.04),
    erase: () => tone(180, 0.05, 'sine', 0.03),
    line: () => tone(660, 0.09, 'triangle', 0.05),
    hint: () => tone(880, 0.12, 'sine', 0.06),
    win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.07), i * 120)); },
  };
})();

// ------------------------------------------------------------ Elementen
const $ = (id) => document.getElementById(id);
const el = {
  home: $('homeScreen'), game: $('gameScreen'), levels: $('levelsScreen'),
  levelGrid: $('levelGrid'), levelsMore: $('levelsMore'), starsTotal: $('starsTotal'),
  levelBannerDesc: $('levelBannerDesc'),
  winHeading: $('winHeading'), winStars: $('winStars'),
  groups: $('puzzleGroups'), heroStats: $('heroStats'),
  board: $('board'), rowClues: $('rowClues'), colClues: $('colClues'),
  corner: $('corner'), layout: $('puzzleLayout'),
  timer: $('timer'), progressFill: $('progressFill'),
  gameName: $('gamePuzzleName'), gameDiff: $('gameDifficulty'),
  winOverlay: $('winOverlay'), winName: $('winName'), winTime: $('winTime'),
  winBest: $('winBest'), winEmoji: $('winEmoji'), confetti: $('confetti'),
  toast: $('toast'),
  modeFill: $('modeFillBtn'), modeCross: $('modeCrossBtn'),
  undo: $('undoBtn'), hint: $('hintBtn'), clear: $('clearBtn'),
  soundBtn: $('soundBtn'), themeBtn: $('themeBtn'),
};

// ------------------------------------------------------------ Speltoestand
const game = {
  puzzle: null,
  solution: null,   // 2D 0/1
  clues: null,
  state: [],        // 2D 0=leeg 1=gevuld 2=kruis
  width: 0, height: 0,
  mode: 'fill',
  undoStack: [],
  cells: [],        // DOM-cache
  startTime: 0, elapsed: 0, timerId: null,
  won: false,
  drag: null,
  level: null,        // levelnummer als dit een level-puzzel is, anders null
};

// ------------------------------------------------------------ Thema/geluid
function applySettings() {
  document.documentElement.setAttribute('data-theme', settings.theme);
  el.themeBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
  el.soundBtn.textContent = settings.sound ? '🔊' : '🔇';
  el.soundBtn.style.opacity = settings.sound ? '1' : '.55';
}
function saveSettings() { writeJSON(STORE.settings, settings); }

// ------------------------------------------------------------ Toast
let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 1800);
}

// ------------------------------------------------------------ Helpers
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const puzzleSize = (p) => `${p.grid[0].length}×${p.grid.length}`;

// ================================================== STARTSCHERM
function renderHome() {
  // Hero-statistieken
  const total = PUZZLES.length;
  const done = PUZZLES.filter((p) => progress[p.id]?.completed).length;
  el.heroStats.innerHTML = `
    <span class="chip">Opgelost <strong>${done}/${total}</strong></span>
    <span class="chip">Voortgang <strong>${Math.round((done / total) * 100)}%</strong></span>
  `;

  // Levels-banner bijwerken.
  const reached = levelData.unlocked;
  el.levelBannerDesc.textContent = reached > 1
    ? `Je bent bij level ${reached} — ga verder!`
    : 'Begin bij level 1';

  el.groups.innerHTML = '';
  for (const diff of DIFFICULTY_ORDER) {
    const items = PUZZLES.filter((p) => p.difficulty === diff);
    if (!items.length) continue;
    const doneCount = items.filter((p) => progress[p.id]?.completed).length;

    const group = document.createElement('div');
    group.className = 'group';
    group.innerHTML = `
      <div class="group-head">
        <span class="dot ${diff}"></span>
        <h2>${DIFFICULTY_LABELS[diff]}</h2>
        <span class="count">${doneCount}/${items.length}</span>
      </div>
      <div class="card-grid"></div>
    `;
    const grid = group.querySelector('.card-grid');

    for (const p of items) {
      const prog = progress[p.id];
      const card = document.createElement('button');
      card.className = 'puzzle-card';
      card.innerHTML = `
        ${prog?.completed ? '<span class="pc-check">✓</span>' : ''}
        <span class="pc-emoji">${prog?.completed ? p.emoji : '❔'}</span>
        <span class="pc-name">${p.name}</span>
        <span class="pc-size">${puzzleSize(p)}</span>
        ${prog?.bestMs ? `<span class="pc-best">🏅 ${fmtTime(prog.bestMs)}</span>` : ''}
      `;
      card.addEventListener('click', () => startPuzzle(p));
      grid.appendChild(card);
    }
    el.groups.appendChild(group);
  }
}

// ================================================== PUZZEL STARTEN
function startPuzzle(puzzle) {
  game.puzzle = puzzle;
  game.level = puzzle.level ?? null;
  const clues = computeClues(puzzle.grid);
  game.clues = clues;
  game.width = clues.width;
  game.height = clues.height;
  game.solution = puzzle.grid.map((row) => [...row].map((c) => (c === '1' || c === '#' || c === 1 ? 1 : 0)));
  game.mode = 'fill';
  game.undoStack = [];
  game.won = false;

  // Herstel opgeslagen voortgang (indien aanwezig en niet voltooid).
  const saved = readJSON(STORE.save(puzzle.id), null);
  if (saved && saved.state && saved.state.length === game.height && !progress[puzzle.id]?.completed) {
    game.state = saved.state.map((r) => r.slice());
    game.elapsed = saved.elapsed || 0;
  } else {
    game.state = Array.from({ length: game.height }, () => new Array(game.width).fill(0));
    game.elapsed = 0;
  }

  el.gameName.textContent = puzzle.name;
  el.gameDiff.textContent = DIFFICULTY_LABELS[puzzle.difficulty];

  buildBoard();
  setMode('fill');
  showScreen('game');
  startTimer();
  refreshAll();
}

// ================================================== BORD OPBOUWEN
function buildBoard() {
  const { rows, cols } = game.clues;
  const w = game.width, h = game.height;

  // Celgrootte bepalen zodat het bord past.
  const maxBoard = Math.min(window.innerWidth - 40, 640);
  const maxRowClue = Math.max(...rows.map((r) => (r[0] === 0 ? 1 : r.length)));
  const maxColClue = Math.max(...cols.map((c) => (c[0] === 0 ? 1 : c.length)));
  const clueSpace = maxRowClue * 18 + 12;
  let cell = Math.floor((maxBoard - clueSpace) / w);
  cell = Math.max(20, Math.min(cell, 40));
  el.layout.style.setProperty('--cell', `${cell}px`);
  el.layout.style.setProperty('--clue-fs', `${Math.max(10, Math.min(14, cell * 0.42))}px`);

  // Kolomaanwijzingen
  el.colClues.innerHTML = '';
  cols.forEach((clue) => {
    const col = document.createElement('div');
    col.className = 'clue-col';
    col.innerHTML = (clue[0] === 0 ? ['0'] : clue).map((n) => `<span class="clue-num">${n}</span>`).join('');
    el.colClues.appendChild(col);
  });

  // Rijaanwijzingen
  el.rowClues.innerHTML = '';
  rows.forEach((clue) => {
    const row = document.createElement('div');
    row.className = 'clue-row';
    row.innerHTML = (clue[0] === 0 ? ['0'] : clue).map((n) => `<span class="clue-num">${n}</span>`).join('');
    el.rowClues.appendChild(row);
  });

  // Cellen
  el.board.style.gridTemplateColumns = `repeat(${w}, var(--cell))`;
  el.board.style.gridTemplateRows = `repeat(${h}, var(--cell))`;
  el.board.innerHTML = '';
  game.cells = [];
  for (let y = 0; y < h; y += 1) {
    const rowCells = [];
    for (let x = 0; x < w; x += 1) {
      const c = document.createElement('div');
      c.className = 'cell';
      c.dataset.x = x; c.dataset.y = y;
      // Dikkere lijnen elke 5 cellen voor leesbaarheid.
      if ((x + 1) % 5 === 0 && x !== w - 1) c.classList.add('block-r');
      if ((y + 1) % 5 === 0 && y !== h - 1) c.classList.add('block-b');
      el.board.appendChild(c);
      rowCells.push(c);
    }
    game.cells.push(rowCells);
  }
}

// ================================================== INTERACTIE
function cellFromPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  if (!target || !target.classList.contains('cell')) return null;
  return { x: +target.dataset.x, y: +target.dataset.y };
}

function pushUndo() {
  game.undoStack.push(game.state.map((r) => r.slice()));
  if (game.undoStack.length > 100) game.undoStack.shift();
  el.undo.disabled = false;
}

function beginDrag(ev) {
  if (game.won) return;
  ev.preventDefault();
  const pos = cellFromPoint(ev.clientX, ev.clientY);
  if (!pos) return;

  const cur = game.state[pos.y][pos.x];
  const useCross = game.mode === 'cross' || ev.button === 2;
  let paint;
  if (useCross) paint = cur === 2 ? 0 : 2;
  else paint = cur === 1 ? 0 : 1;

  pushUndo();
  game.drag = { paint, axis: null, start: pos };
  el.board.setPointerCapture?.(ev.pointerId);
  applyCell(pos.x, pos.y, paint);
}

function moveDrag(ev) {
  if (!game.drag) return;
  const pos = cellFromPoint(ev.clientX, ev.clientY);
  if (!pos) return;
  const d = game.drag;
  // As vastzetten na eerste beweging (rechte lijnen tekenen).
  if (!d.axis && (pos.x !== d.start.x || pos.y !== d.start.y)) {
    d.axis = Math.abs(pos.x - d.start.x) >= Math.abs(pos.y - d.start.y) ? 'h' : 'v';
  }
  let { x, y } = pos;
  if (d.axis === 'h') y = d.start.y;
  if (d.axis === 'v') x = d.start.x;
  applyCell(x, y, d.paint);
}

function endDrag() {
  if (!game.drag) return;
  game.drag = null;
  if (settings.autoCross) autoCrossCompleted();
  refreshClues();
  saveGameState();
  checkWin();
}

function applyCell(x, y, value) {
  if (x < 0 || y < 0 || x >= game.width || y >= game.height) return;
  if (game.state[y][x] === value) return;
  const prev = game.state[y][x];
  game.state[y][x] = value;
  paintCell(x, y);
  updateProgressBar();
  if (value === 1) audio.fill();
  else if (value === 2) audio.cross();
  else if (prev !== 0) audio.erase();
}

function paintCell(x, y) {
  const c = game.cells[y][x];
  const v = game.state[y][x];
  c.classList.toggle('filled', v === 1);
  c.classList.toggle('crossed', v === 2);
}

// Zet automatisch kruisjes in rijen/kolommen die correct volledig gevuld zijn.
function autoCrossCompleted() {
  const sat = lineSatisfaction(game.state, game.clues);
  for (let y = 0; y < game.height; y += 1) {
    if (!sat.rows[y]) continue;
    for (let x = 0; x < game.width; x += 1) {
      if (game.state[y][x] === 0) { game.state[y][x] = 2; paintCell(x, y); }
    }
  }
  for (let x = 0; x < game.width; x += 1) {
    if (!sat.cols[x]) continue;
    for (let y = 0; y < game.height; y += 1) {
      if (game.state[y][x] === 0) { game.state[y][x] = 2; paintCell(x, y); }
    }
  }
}

// ================================================== BIJWERKEN
function refreshAll() {
  for (let y = 0; y < game.height; y += 1)
    for (let x = 0; x < game.width; x += 1) paintCell(x, y);
  refreshClues();
  updateProgressBar();
}

function refreshClues() {
  const sat = lineSatisfaction(game.state, game.clues);
  el.rowClues.querySelectorAll('.clue-row').forEach((n, i) => n.classList.toggle('satisfied', sat.rows[i]));
  el.colClues.querySelectorAll('.clue-col').forEach((n, i) => n.classList.toggle('satisfied', sat.cols[i]));
}

function updateProgressBar() {
  let correct = 0, total = 0;
  for (let y = 0; y < game.height; y += 1)
    for (let x = 0; x < game.width; x += 1) {
      if (game.solution[y][x] === 1) {
        total += 1;
        if (game.state[y][x] === 1) correct += 1;
      }
    }
  el.progressFill.style.width = `${total ? (correct / total) * 100 : 0}%`;
}

// ================================================== TIMER
function startTimer() {
  stopTimer();
  game.startTime = Date.now() - game.elapsed;
  el.timer.textContent = fmtTime(game.elapsed);
  game.timerId = setInterval(() => {
    game.elapsed = Date.now() - game.startTime;
    el.timer.textContent = fmtTime(game.elapsed);
  }, 250);
}
function stopTimer() { if (game.timerId) { clearInterval(game.timerId); game.timerId = null; } }

// ================================================== OPSLAAN
function saveGameState() {
  if (game.won || !game.puzzle) return;
  writeJSON(STORE.save(game.puzzle.id), { state: game.state, elapsed: game.elapsed });
}

// ================================================== WINNEN
function checkWin() {
  if (game.won) return;
  if (!isSolved(game.state, game.solution)) return;
  game.won = true;
  stopTimer();

  // Vul de tekening netjes af en verwijder overtollige kruisjes.
  for (let y = 0; y < game.height; y += 1)
    for (let x = 0; x < game.width; x += 1) {
      game.state[y][x] = game.solution[y][x] === 1 ? 1 : 0;
      paintCell(x, y);
    }

  const id = game.puzzle.id;

  if (game.level != null) {
    // Level-modus: beste tijd + sterren opslaan en het volgende ontgrendelen.
    const n = game.level;
    const prevBest = levelData.best[n];
    const best = prevBest && prevBest < game.elapsed ? prevBest : game.elapsed;
    const stars = starRating(n, best);
    levelData.best[n] = best;
    levelData.stars[n] = Math.max(levelData.stars[n] || 0, stars);
    levelData.unlocked = Math.max(levelData.unlocked, n + 1);
    writeJSON(STORE.levels, levelData);
    try { localStorage.removeItem(STORE.save(id)); } catch { /* ignore */ }
    audio.win();
    showWin(best, { level: n, stars });
    return;
  }

  const prev = progress[id] || {};
  const best = prev.bestMs && prev.bestMs < game.elapsed ? prev.bestMs : game.elapsed;
  progress[id] = { completed: true, bestMs: best };
  writeJSON(STORE.progress, progress);
  try { localStorage.removeItem(STORE.save(id)); } catch { /* ignore */ }

  audio.win();
  showWin(best);
}

function showWin(best, levelInfo = null) {
  const nextBtn = $('nextBtn');
  if (levelInfo) {
    el.winHeading.textContent = `Level ${levelInfo.level} voltooid!`;
    el.winName.textContent = 'Klaar voor de volgende uitdaging?';
    el.winEmoji.textContent = ['🎯', '⭐', '🏆'][levelInfo.stars - 1] || '🎯';
    el.winStars.classList.remove('hidden');
    el.winStars.innerHTML = [1, 2, 3]
      .map((i) => `<span class="star ${i <= levelInfo.stars ? 'on' : ''}">★</span>`)
      .join('');
    nextBtn.textContent = 'Volgend level';
  } else {
    el.winHeading.textContent = 'Opgelost!';
    el.winName.textContent = `${game.puzzle.emoji}  ${game.puzzle.name}`;
    el.winEmoji.textContent = game.puzzle.emoji;
    el.winStars.classList.add('hidden');
    nextBtn.textContent = 'Volgende puzzel';
  }
  el.winTime.textContent = fmtTime(game.elapsed);
  el.winBest.textContent = fmtTime(best);
  spawnConfetti();
  el.winOverlay.classList.remove('hidden');
}

function spawnConfetti() {
  const colors = ['#6366f1', '#8b5cf6', '#0ea5e9', '#16a34a', '#f59e0b', '#d05070'];
  el.confetti.innerHTML = '';
  for (let i = 0; i < 40; i += 1) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${1.4 + Math.random() * 1.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.confetti.appendChild(piece);
  }
}

// ================================================== HINT
function useHint() {
  if (game.won) return;
  // Herstel eerst foutieve invullingen.
  const wrong = [];
  const missing = [];
  for (let y = 0; y < game.height; y += 1)
    for (let x = 0; x < game.width; x += 1) {
      const sol = game.solution[y][x];
      const st = game.state[y][x];
      if (sol === 1 && st !== 1) missing.push({ x, y });
      if (sol === 0 && st === 1) wrong.push({ x, y });
    }
  const target = wrong[0] || missing[Math.floor(Math.random() * missing.length)];
  if (!target) return;

  pushUndo();
  game.state[target.y][target.x] = game.solution[target.y][target.x] === 1 ? 1 : 2;
  paintCell(target.x, target.y);
  game.cells[target.y][target.x].classList.add('hint-flash');
  setTimeout(() => game.cells[target.y][target.x].classList.remove('hint-flash'), 600);
  audio.hint();
  if (settings.autoCross) autoCrossCompleted();
  updateProgressBar();
  refreshClues();
  saveGameState();
  checkWin();
}

// ================================================== BESTURING
function setMode(mode) {
  game.mode = mode;
  el.modeFill.classList.toggle('active', mode === 'fill');
  el.modeCross.classList.toggle('active', mode === 'cross');
}

function undo() {
  if (!game.undoStack.length) return;
  game.state = game.undoStack.pop();
  refreshAll();
  saveGameState();
  el.undo.disabled = game.undoStack.length === 0;
}

function clearBoard() {
  if (game.won) return;
  pushUndo();
  game.state = Array.from({ length: game.height }, () => new Array(game.width).fill(0));
  refreshAll();
  saveGameState();
  toast('Bord gewist');
}

// ================================================== SCHERMEN
function showScreen(name) {
  el.home.classList.toggle('hidden', name !== 'home');
  el.game.classList.toggle('hidden', name !== 'game');
  el.levels.classList.toggle('hidden', name !== 'levels');
  window.scrollTo(0, 0);
}

function goHome() {
  stopTimer();
  saveGameState();
  el.winOverlay.classList.add('hidden');
  renderHome();
  showScreen('home');
}

// Verlaat het spel: in level-modus terug naar het levels-overzicht,
// anders naar het startscherm.
function leaveGame() {
  stopTimer();
  saveGameState();
  el.winOverlay.classList.add('hidden');
  if (game.level != null) { openLevels(); }
  else { renderHome(); showScreen('home'); }
}

// ================================================== SPECIALE PUZZELS
function dailyPuzzle() {
  const today = new Date();
  const seed = today.getFullYear() * 1000 + (today.getMonth() + 1) * 50 + today.getDate();
  const idx = seed % PUZZLES.length;
  toast('📅 Puzzel van vandaag');
  startPuzzle(PUZZLES[idx]);
}

function randomPuzzle() {
  toast('🎲 Nieuwe puzzel genereren…');
  // Kies willekeurige grootte en genereer een uniek oplosbaar raster.
  const sizes = [5, 5, 10, 10, 10, 15];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const density = 0.5 + Math.random() * 0.12;
  setTimeout(() => {
    const grid = generateUniquePuzzle(size, size, density, 600);
    if (!grid) { toast('Genereren mislukt, probeer opnieuw'); return; }
    const diff = size <= 5 ? 'easy' : size <= 10 ? 'medium' : 'hard';
    startPuzzle({
      id: `random-${Date.now()}`,
      name: 'Verrassing',
      difficulty: diff,
      emoji: '🎲',
      grid: grid.map((r) => r.join('')),
    });
  }, 30);
}

// ================================================== LEVELS
function openLevels() {
  renderLevels();
  showScreen('levels');
}

function renderLevels() {
  const unlocked = levelData.unlocked;
  const totalStars = Object.values(levelData.stars).reduce((a, b) => a + b, 0);
  el.starsTotal.textContent = `★ ${totalStars}`;

  // Toon alle ontgrendelde levels plus het eerstvolgende (nog op slot).
  const count = unlocked + 1;
  el.levelGrid.innerHTML = '';
  for (let n = 1; n <= count; n += 1) {
    const done = !!levelData.best[n];
    const locked = n > unlocked;
    const stars = levelData.stars[n] || 0;
    const size = levelConfig(n).size;

    const tile = document.createElement('button');
    tile.className = `level-tile${done ? ' done' : ''}${locked ? ' locked' : ''}`;
    tile.disabled = locked;
    tile.innerHTML = `
      <span class="lt-num">${locked ? '🔒' : n}</span>
      <span class="lt-size">${size}×${size}</span>
      <span class="lt-stars">${done ? '★★★'.slice(0, stars).padEnd(3, '☆') : (locked ? '' : '·')}</span>
    `;
    if (!locked) tile.addEventListener('click', () => startPuzzle(generateLevel(n)));
    el.levelGrid.appendChild(tile);
  }

  el.levelsMore.innerHTML = `<p class="levels-hint">Los level ${unlocked} op om verder te komen — er is geen einde! 🚀</p>`;
}

function nextPuzzle() {
  el.winOverlay.classList.add('hidden');
  if (game.level != null) { startPuzzle(generateLevel(game.level + 1)); return; }
  const list = PUZZLES;
  const idx = list.findIndex((p) => p.id === game.puzzle.id);
  // Zoek de volgende nog niet-opgeloste puzzel, anders de eerstvolgende.
  for (let step = 1; step <= list.length; step += 1) {
    const cand = list[(idx + step) % list.length];
    if (!progress[cand.id]?.completed) { startPuzzle(cand); return; }
  }
  startPuzzle(list[(idx + 1) % list.length]);
}

// ================================================== TOETSENBORD
let cursor = { x: 0, y: 0 };
function handleKey(ev) {
  if (el.game.classList.contains('hidden') || game.won) return;
  const move = (dx, dy) => {
    cursor.x = Math.max(0, Math.min(game.width - 1, cursor.x + dx));
    cursor.y = Math.max(0, Math.min(game.height - 1, cursor.y + dy));
    highlightCursor();
  };
  switch (ev.key) {
    case 'ArrowLeft': move(-1, 0); ev.preventDefault(); break;
    case 'ArrowRight': move(1, 0); ev.preventDefault(); break;
    case 'ArrowUp': move(0, -1); ev.preventDefault(); break;
    case 'ArrowDown': move(0, 1); ev.preventDefault(); break;
    case ' ': case 'Enter': {
      ev.preventDefault();
      pushUndo();
      const cur = game.state[cursor.y][cursor.x];
      applyCell(cursor.x, cursor.y, cur === 1 ? 0 : 1);
      afterEdit();
      break;
    }
    case 'x': case 'X': {
      pushUndo();
      const cur = game.state[cursor.y][cursor.x];
      applyCell(cursor.x, cursor.y, cur === 2 ? 0 : 2);
      afterEdit();
      break;
    }
    default: break;
  }
}
function afterEdit() {
  if (settings.autoCross) autoCrossCompleted();
  refreshClues(); saveGameState(); checkWin();
}
let cursorEl = null;
function highlightCursor() {
  if (cursorEl) cursorEl.style.outline = '';
  cursorEl = game.cells[cursor.y]?.[cursor.x];
  if (cursorEl) cursorEl.style.outline = '2px solid var(--accent)';
}

// ================================================== EVENTS
function bindEvents() {
  el.board.addEventListener('pointerdown', beginDrag);
  el.board.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  el.board.addEventListener('contextmenu', (e) => e.preventDefault());

  el.modeFill.addEventListener('click', () => setMode('fill'));
  el.modeCross.addEventListener('click', () => setMode('cross'));
  el.undo.addEventListener('click', undo);
  el.hint.addEventListener('click', useHint);
  el.clear.addEventListener('click', clearBoard);

  $('backBtn').addEventListener('click', leaveGame);
  $('brandBtn').addEventListener('click', goHome);
  $('dailyBtn').addEventListener('click', dailyPuzzle);
  $('randomBtn').addEventListener('click', randomPuzzle);
  $('levelsBtn').addEventListener('click', openLevels);
  $('levelsBackBtn').addEventListener('click', goHome);
  $('nextBtn').addEventListener('click', nextPuzzle);
  $('winHomeBtn').addEventListener('click', leaveGame);

  el.themeBtn.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings(); applySettings();
  });
  el.soundBtn.addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings(); applySettings();
    if (settings.sound) audio.line();
  });

  window.addEventListener('keydown', handleKey);
  window.addEventListener('beforeunload', saveGameState);
}

// ================================================== INIT
applySettings();
bindEvents();
renderHome();
showScreen('home');
