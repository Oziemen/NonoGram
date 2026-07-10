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

test('getPuzzle: vindt bestaande en retourneert null voor onbekende', () => {
  assert.equal(getPuzzle(PUZZLES[0].id)?.id, PUZZLES[0].id);
  assert.equal(getPuzzle('bestaat-niet'), null);
});
