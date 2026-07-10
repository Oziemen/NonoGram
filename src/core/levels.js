// Monogram — eindeloze levels.
//
// Elk level is een procedureel gegenereerde puzzel. De generatie is
// deterministisch: level N levert altijd exact dezelfde puzzel op (dankzij
// een vaste seed), zodat voortgang, beste tijden en sterren stabiel blijven.
// De reeks levels is in principe oneindig.

import { generateUniquePuzzle } from './nonogram.js';
import { DIFFICULTY_LABELS } from './puzzles.js';

/** Deterministische pseudo-random generator (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bepaal de configuratie van een level: rastergrootte, dichtheid en seed.
 * De grootte loopt op van 5×5 naar 15×15 en blijft daar; de dichtheid
 * varieert deterministisch zodat opeenvolgende levels afwisselend aanvoelen.
 */
export function levelConfig(n) {
  const level = Math.max(1, Math.floor(n));

  let size;
  if (level <= 5) size = 5;
  else if (level <= 15) size = 10;
  else size = 15;

  const base = size <= 5 ? 0.5 : size <= 10 ? 0.52 : 0.54;
  const wobble = ((level * 37) % 13) / 100; // 0.00 .. 0.12, deterministisch
  const density = Math.min(0.66, base + wobble);

  // Grote priemvermenigvuldiging zorgt voor goed gespreide seeds.
  const seed = (level * 2654435761) >>> 0;

  return { level, size, density, seed };
}

/** Moeilijkheidslabel-sleutel op basis van rastergrootte. */
function tierFor(size) {
  return size <= 5 ? 'easy' : size <= 10 ? 'medium' : 'hard';
}

/**
 * Genereer de puzzel voor level `n`. Deterministisch en gegarandeerd
 * uniek-oplosbaar. Retourneert een puzzelobject in hetzelfde formaat als
 * de handgemaakte puzzels.
 */
export function generateLevel(n) {
  const { level, size, density, seed } = levelConfig(n);

  // Probeer opeenvolgende (deterministische) seeds tot een geldig,
  // uniek-oplosbaar raster gevonden is. In de praktijk lukt dit vrijwel
  // altijd bij de eerste poging.
  let grid = null;
  for (let attempt = 0; attempt < 40 && !grid; attempt += 1) {
    const rng = mulberry32((seed + attempt * 0x9e3779b1) >>> 0);
    grid = generateUniquePuzzle(size, size, density, 2500, rng);
  }
  if (!grid) {
    // Uiterste noodgeval: een minimaal geldig raster.
    grid = Array.from({ length: size }, (_, y) => new Array(size).fill(y === 0 ? 1 : 0));
  }

  const tier = tierFor(size);
  return {
    id: `level-${level}`,
    name: `Level ${level}`,
    difficulty: tier,
    difficultyLabel: DIFFICULTY_LABELS[tier],
    emoji: '🧩',
    level,
    grid: grid.map((row) => row.join('')),
  };
}

/**
 * Bereken een sterrenwaardering (1–3) op basis van de tijd, geschaald naar
 * de rastergrootte. Louter voor de motivatie.
 */
export function starRating(level, elapsedMs) {
  const { size } = levelConfig(level);
  const cells = size * size;
  const seconds = elapsedMs / 1000;
  if (seconds <= cells * 1.8) return 3;
  if (seconds <= cells * 4.0) return 2;
  return 1;
}
