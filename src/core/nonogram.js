// Monogram — pure spellogica (nonogram / picross).
//
// Dit bestand bevat GEEN DOM- of browser-code, zodat het één-op-één
// herbruikbaar is in de browser én getest kan worden met `node --test`.
//
// Conventies:
//  - Een "solution" is een 2D-array van 0/1 (of een array van strings
//    met '0'/'1' die we normaliseren). 1 = gevuld, 0 = leeg.
//  - "clues" (aanwijzingen) zijn de reeksen gevulde cellen per rij/kolom.
//    Een lege lijn krijgt de aanwijzing [0].

/** Zet een rij die als string is opgegeven om naar een array van 0/1. */
function normalizeRow(row) {
  if (typeof row === 'string') {
    return [...row].map((ch) => (ch === '1' || ch === '#' || ch === 'x' ? 1 : 0));
  }
  return row.map((v) => (v ? 1 : 0));
}

/** Normaliseer een volledige oplossing naar een 2D-array van 0/1. */
export function normalizeSolution(solution) {
  return solution.map(normalizeRow);
}

/**
 * Bereken de aanwijzingen voor één lijn (rij of kolom).
 * Bijv. [1,1,0,1,1,1] -> [2,3]; [0,0,0] -> [0].
 */
export function lineClues(line) {
  const clues = [];
  let run = 0;
  for (const cell of line) {
    if (cell) {
      run += 1;
    } else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues.length ? clues : [0];
}

/**
 * Bereken alle rij- en kolomaanwijzingen voor een oplossing.
 * Retourneert { rows: number[][], cols: number[][], width, height }.
 */
export function computeClues(solution) {
  const grid = normalizeSolution(solution);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  const rows = grid.map((row) => lineClues(row));

  const cols = [];
  for (let x = 0; x < width; x += 1) {
    const column = [];
    for (let y = 0; y < height; y += 1) column.push(grid[y][x]);
    cols.push(lineClues(column));
  }

  return { rows, cols, width, height };
}

/**
 * Vergelijk de gevulde cellen van de speler met de oplossing.
 * `state` is een 2D-array met waarden: 1 = gevuld, 0/2 = niet gevuld
 * (2 wordt gebruikt voor een gemarkeerd kruisje in de UI).
 * Retourneert true wanneer exact de juiste cellen gevuld zijn.
 */
export function isSolved(state, solution) {
  const grid = normalizeSolution(solution);
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const filled = state[y]?.[x] === 1;
      if (filled !== (grid[y][x] === 1)) return false;
    }
  }
  return true;
}

/** Is de totale som van een aanwijzingenlijst 0 (lege lijn)? */
function isEmptyClue(clue) {
  return clue.length === 0 || (clue.length === 1 && clue[0] === 0);
}

/**
 * Genereer elke mogelijke invulling (array van 0/1) van lengte `length`
 * die past bij `clue`. Gebruikt door de solver.
 */
export function lineArrangements(clue, length) {
  if (isEmptyClue(clue)) return [new Array(length).fill(0)];

  const results = [];
  const blocks = clue;

  function place(blockIndex, start, current) {
    if (blockIndex === blocks.length) {
      const line = current.slice();
      while (line.length < length) line.push(0);
      results.push(line);
      return;
    }
    const block = blocks[blockIndex];
    // Hoeveel ruimte hebben de resterende blokken minimaal nodig?
    let remaining = 0;
    for (let i = blockIndex; i < blocks.length; i += 1) remaining += blocks[i];
    remaining += blocks.length - blockIndex - 1; // scheidende spaties
    const maxStart = length - remaining;

    for (let pos = start; pos <= maxStart; pos += 1) {
      const next = current.slice();
      while (next.length < pos) next.push(0);
      for (let i = 0; i < block; i += 1) next.push(1);
      if (blockIndex < blocks.length - 1) next.push(0); // verplichte spatie
      place(blockIndex + 1, next.length, next);
    }
  }

  place(0, 0, []);
  return results;
}

// Celtoestanden voor de solver
const UNKNOWN = -1;
const EMPTY = 0;
const FILLED = 1;

/**
 * Los een puzzel op met constraint-propagatie (line solving).
 * Retourneert { solved, unique, grid } waarbij:
 *  - grid een 2D-array van -1/0/1 is (met -1 = nog onbekend),
 *  - solved = of het raster volledig bepaald is,
 *  - unique = of de propagatie tot één oplossing leidt zonder gokken.
 *
 * Goed ontworpen picross-puzzels zijn oplosbaar via pure logica; deze
 * solver bewijst dat in onze tests.
 */
export function solve(rowClues, colClues) {
  const height = rowClues.length;
  const width = colClues.length;

  const grid = Array.from({ length: height }, () => new Array(width).fill(UNKNOWN));

  // Cache van mogelijke arrangementen per lijn.
  const rowOptions = rowClues.map((c) => lineArrangements(c, width));
  const colOptions = colClues.map((c) => lineArrangements(c, height));

  // Filter arrangementen op basis van huidige bekende cellen en leidt
  // gemeenschappelijke cellen af.
  function reduceLine(options, known) {
    const compatible = options.filter((opt) =>
      opt.every((v, i) => known[i] === UNKNOWN || known[i] === v)
    );
    if (compatible.length === 0) return { options: compatible, deduced: null, contradiction: true };

    const deduced = new Array(known.length).fill(UNKNOWN);
    for (let i = 0; i < known.length; i += 1) {
      const first = compatible[0][i];
      if (compatible.every((opt) => opt[i] === first)) deduced[i] = first;
    }
    return { options: compatible, deduced, contradiction: false };
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (let y = 0; y < height; y += 1) {
      const known = grid[y];
      const { options, deduced, contradiction } = reduceLine(rowOptions[y], known);
      if (contradiction) return { solved: false, unique: false, grid };
      rowOptions[y] = options;
      for (let x = 0; x < width; x += 1) {
        if (deduced[x] !== UNKNOWN && grid[y][x] === UNKNOWN) {
          grid[y][x] = deduced[x];
          changed = true;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      const known = grid.map((row) => row[x]);
      const { options, deduced, contradiction } = reduceLine(colOptions[x], known);
      if (contradiction) return { solved: false, unique: false, grid };
      colOptions[x] = options;
      for (let y = 0; y < height; y += 1) {
        if (deduced[y] !== UNKNOWN && grid[y][x] === UNKNOWN) {
          grid[y][x] = deduced[y];
          changed = true;
        }
      }
    }
  }

  let solved = true;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y][x] === UNKNOWN) solved = false;
    }
  }

  return { solved, unique: solved, grid };
}

/**
 * Controleer of een puzzel via pure logica precies één oplossing heeft
 * die overeenkomt met de opgegeven solution.
 */
export function hasUniqueSolution(solution) {
  const { rows, cols } = computeClues(solution);
  const result = solve(rows, cols);
  if (!result.solved) return false;
  const normalized = normalizeSolution(solution);
  for (let y = 0; y < normalized.length; y += 1) {
    for (let x = 0; x < normalized[y].length; x += 1) {
      if (result.grid[y][x] !== normalized[y][x]) return false;
    }
  }
  return true;
}

/**
 * Bepaal per rij/kolom of de aanwijzing al voldaan is, op basis van de
 * huidige speltoestand. Handig om aanwijzingen in de UI door te strepen.
 */
export function lineSatisfaction(state, clues) {
  const height = clues.rows.length;
  const width = clues.cols.length;

  const rows = clues.rows.map((clue, y) => {
    const line = [];
    for (let x = 0; x < width; x += 1) line.push(state[y]?.[x] === 1 ? 1 : 0);
    return sameClue(lineClues(line), clue);
  });

  const cols = clues.cols.map((clue, x) => {
    const line = [];
    for (let y = 0; y < height; y += 1) line.push(state[y]?.[x] === 1 ? 1 : 0);
    return sameClue(lineClues(line), clue);
  });

  return { rows, cols };
}

function sameClue(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export const CELL = { UNKNOWN, EMPTY, FILLED };

/**
 * Genereer een willekeurige puzzel die gegarandeerd puur-logisch en
 * uniek oplosbaar is. Probeert tot `attempts` keer een raster te maken
 * en houdt het eerste dat de solver volledig kan oplossen.
 * Retourneert een 2D-array van 0/1, of null als het niet lukt.
 */
export function generateUniquePuzzle(width, height, density = 0.55, attempts = 400, rng = Math.random) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const grid = [];
    let filledCount = 0;
    for (let y = 0; y < height; y += 1) {
      const row = [];
      for (let x = 0; x < width; x += 1) {
        const cell = rng() < density ? 1 : 0;
        row.push(cell);
        filledCount += cell;
      }
      grid.push(row);
    }
    // Vermijd (bijna) lege of volledig gevulde rasters.
    if (filledCount < Math.max(2, width) || filledCount > width * height - 1) continue;

    const { rows, cols } = computeClues(grid);
    const result = solve(rows, cols);
    if (result.solved) {
      let matches = true;
      for (let y = 0; y < height && matches; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (result.grid[y][x] !== grid[y][x]) { matches = false; break; }
        }
      }
      if (matches) return grid;
    }
  }
  return null;
}
