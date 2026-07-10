import test from 'node:test';
import assert from 'node:assert/strict';

import {
  lineClues,
  computeClues,
  isSolved,
  lineArrangements,
  solve,
  hasUniqueSolution,
  lineSatisfaction,
  normalizeSolution,
  generateUniquePuzzle,
} from '../src/core/nonogram.js';
import { PUZZLES, getPuzzle, DIFFICULTY_ORDER } from '../src/core/puzzles.js';
import { levelConfig, generateLevel, starRating, mulberry32 } from '../src/core/levels.js';

test('lineClues: basisgevallen', () => {
  assert.deepEqual(lineClues([1, 1, 0, 1, 1, 1]), [2, 3]);
  assert.deepEqual(lineClues([0, 0, 0]), [0]);
  assert.deepEqual(lineClues([1, 1, 1]), [3]);
  assert.deepEqual(lineClues([1, 0, 1, 0, 1]), [1, 1, 1]);
  assert.deepEqual(lineClues([0, 1, 0]), [1]);
});

test('computeClues: rijen en kolommen kloppen voor een bekend raster', () => {
  const solution = [
    '110',
    '011',
    '101',
  ];
  const { rows, cols, width, height } = computeClues(solution);
  assert.equal(width, 3);
  assert.equal(height, 3);
  assert.deepEqual(rows, [[2], [2], [1, 1]]);
  assert.deepEqual(cols, [[1, 1], [2], [2]]);
});

test('isSolved: herkent juiste en foute invullingen', () => {
  const solution = ['10', '01'];
  assert.equal(isSolved([[1, 0], [0, 1]], solution), true);
  // gemarkeerde kruisjes (2) tellen als niet-gevuld
  assert.equal(isSolved([[1, 2], [2, 1]], solution), true);
  assert.equal(isSolved([[1, 1], [0, 1]], solution), false);
  assert.equal(isSolved([[0, 0], [0, 0]], solution), false);
});

test('lineArrangements: aantal en geldigheid', () => {
  // clue [2] in lengte 4 -> posities 0,1,2 => 3 mogelijkheden
  const arr = lineArrangements([2], 4);
  assert.equal(arr.length, 3);
  for (const line of arr) {
    assert.deepEqual(lineClues(line), [2]);
    assert.equal(line.length, 4);
  }
  // lege clue -> precies één (alles leeg)
  assert.deepEqual(lineArrangements([0], 3), [[0, 0, 0]]);
  // volle lijn
  assert.deepEqual(lineArrangements([3], 3), [[1, 1, 1]]);
});

test('solve: lost een eenvoudige puzzel volledig en uniek op', () => {
  const solution = [
    '110',
    '011',
    '101',
  ];
  const { rows, cols } = computeClues(solution);
  const result = solve(rows, cols);
  assert.equal(result.solved, true);
  assert.equal(result.unique, true);
  assert.deepEqual(result.grid, normalizeSolution(solution));
});

test('lineSatisfaction: markeert voldane rijen/kolommen', () => {
  const solution = ['11', '10'];
  const clues = computeClues(solution);
  const state = [[1, 1], [1, 0]];
  const sat = lineSatisfaction(state, clues);
  assert.deepEqual(sat.rows, [true, true]);
  assert.deepEqual(sat.cols, [true, true]);

  const partial = [[1, 0], [0, 0]];
  const sat2 = lineSatisfaction(partial, clues);
  assert.equal(sat2.rows[0], false);
});

test('puzzelbibliotheek: elke puzzel is rechthoekig en geldig', () => {
  assert.ok(PUZZLES.length >= 10, 'verwacht een ruime puzzelcollectie');
  const ids = new Set();
  for (const puzzle of PUZZLES) {
    assert.ok(puzzle.id, 'puzzel heeft een id');
    assert.ok(!ids.has(puzzle.id), `dubbele id: ${puzzle.id}`);
    ids.add(puzzle.id);
    assert.ok(puzzle.name, `puzzel ${puzzle.id} heeft een naam`);
    assert.ok(DIFFICULTY_ORDER.includes(puzzle.difficulty), `geldige moeilijkheid: ${puzzle.id}`);

    const grid = normalizeSolution(puzzle.grid);
    const width = grid[0].length;
    for (const row of grid) {
      assert.equal(row.length, width, `puzzel ${puzzle.id} is rechthoekig`);
    }
    // minstens één gevulde cel
    assert.ok(grid.some((row) => row.some((c) => c === 1)), `puzzel ${puzzle.id} is niet leeg`);
  }
});

test('puzzelbibliotheek: elke puzzel heeft een unieke, logisch oplosbare oplossing', () => {
  for (const puzzle of PUZZLES) {
    assert.equal(
      hasUniqueSolution(puzzle.grid),
      true,
      `puzzel "${puzzle.name}" (${puzzle.id}) moet uniek logisch oplosbaar zijn`
    );
  }
});

test('generateUniquePuzzle: levert een uniek oplosbaar raster', () => {
  // Deterministische pseudo-random generator voor een stabiele test.
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const grid = generateUniquePuzzle(5, 5, 0.55, 500, rng);
  assert.ok(grid, 'er moet een raster gegenereerd worden');
  assert.equal(grid.length, 5);
  assert.equal(grid[0].length, 5);
  assert.equal(hasUniqueSolution(grid), true, 'het gegenereerde raster moet uniek oplosbaar zijn');
});

test('mulberry32: deterministisch en in bereik [0,1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i += 1) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('levelConfig: grootte loopt op en blijft begrensd', () => {
  assert.equal(levelConfig(1).size, 5);
  assert.equal(levelConfig(5).size, 5);
  assert.equal(levelConfig(6).size, 10);
  assert.equal(levelConfig(15).size, 10);
  assert.equal(levelConfig(16).size, 15);
  assert.equal(levelConfig(999).size, 15);
  for (const n of [1, 7, 20, 100]) {
    const c = levelConfig(n);
    assert.ok(c.density > 0.3 && c.density <= 0.66, `dichtheid in bereik voor level ${n}`);
  }
});

test('generateLevel: deterministisch, geldig en uniek oplosbaar', () => {
  // Test een reeks levels over alle grootte-tiers.
  for (const n of [1, 3, 6, 12, 16, 25, 40]) {
    const p1 = generateLevel(n);
    const p2 = generateLevel(n);
    assert.deepEqual(p1.grid, p2.grid, `level ${n} is deterministisch`);
    assert.equal(p1.id, `level-${n}`);
    assert.equal(hasUniqueSolution(p1.grid), true, `level ${n} moet uniek oplosbaar zijn`);
    const size = levelConfig(n).size;
    assert.equal(p1.grid.length, size);
    assert.equal(p1.grid[0].length, size);
  }
});

test('starRating: 1–3 sterren, sneller is beter', () => {
  assert.equal(starRating(1, 1000), 3);           // heel snel
  assert.equal(starRating(1, 25 * 3 * 1000), 2);  // gemiddeld
  assert.equal(starRating(1, 25 * 10 * 1000), 1); // traag
});

test('getPuzzle: vindt bestaande en retourneert null voor onbekende', () => {
  assert.equal(getPuzzle(PUZZLES[0].id)?.id, PUZZLES[0].id);
  assert.equal(getPuzzle('bestaat-niet'), null);
});
