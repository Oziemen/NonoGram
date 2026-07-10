// Monogram — puzzelbibliotheek.
//
// Elke puzzel is een pixel-tekening: '1' (of '#') = gevulde cel, alle
// andere tekens = leeg. De aanwijzingen worden automatisch berekend uit
// het raster met computeClues(). Alle puzzels worden in de tests
// gecontroleerd op een unieke, puur-logisch oplosbare oplossing.

export const PUZZLES = [
  // ---------------------------------------------------------------- 5×5
  {
    id: 'hartje',
    name: 'Hartje',
    difficulty: 'easy',
    emoji: '❤️',
    grid: [
      '01010',
      '11111',
      '11111',
      '01110',
      '00100',
    ],
  },
  {
    id: 'huisje',
    name: 'Huisje',
    difficulty: 'easy',
    emoji: '🏠',
    grid: [
      '00100',
      '01110',
      '11111',
      '01010',
      '01110',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    difficulty: 'easy',
    emoji: '➕',
    grid: [
      '00100',
      '00100',
      '11111',
      '00100',
      '00100',
    ],
  },
  {
    id: 'kopje',
    name: 'Kopje koffie',
    difficulty: 'easy',
    emoji: '☕',
    grid: [
      '00001',
      '11110',
      '11111',
      '11110',
      '00000',
    ],
  },
  {
    id: 'muzieknoot',
    name: 'Muzieknoot',
    difficulty: 'easy',
    emoji: '🎵',
    grid: [
      '00111',
      '00101',
      '00111',
      '11100',
      '11100',
    ],
  },

  // --------------------------------------------------------------- 10×10
  {
    id: 'kat',
    name: 'Kat',
    difficulty: 'medium',
    emoji: '🐱',
    grid: [
      '0000000000',
      '0110000110',
      '0111001110',
      '0111111110',
      '0110110110',
      '0111111110',
      '0101111010',
      '0110110110',
      '0011111100',
      '0000000000',
    ],
  },
  {
    id: 'bloem',
    name: 'Bloem',
    difficulty: 'medium',
    emoji: '🌸',
    grid: [
      '0001100000',
      '0011110000',
      '0011110000',
      '0111111100',
      '1110011110',
      '1100110110',
      '0110011100',
      '0001100000',
      '0001100000',
      '0011110000',
    ],
  },
  {
    id: 'vis',
    name: 'Vis',
    difficulty: 'medium',
    emoji: '🐟',
    grid: [
      '0000000000',
      '0000000000',
      '0011110001',
      '0110111011',
      '1110111111',
      '1110111111',
      '0110111011',
      '0011110001',
      '0000000000',
      '0000000000',
    ],
  },
  {
    id: 'spook',
    name: 'Spookje',
    difficulty: 'medium',
    emoji: '👻',
    grid: [
      '0001111000',
      '0011111100',
      '0110110110',
      '0111111110',
      '0111111110',
      '0111111110',
      '0111111110',
      '0111111110',
      '0111111110',
      '0101101010',
    ],
  },
  {
    id: 'anker',
    name: 'Anker',
    difficulty: 'medium',
    emoji: '⚓',
    grid: [
      '0001100000',
      '0011110000',
      '0001100000',
      '0011110000',
      '0001100000',
      '1001100100',
      '1001100100',
      '1101101100',
      '0111111000',
      '0001100000',
    ],
  },

  // --------------------------------------------------------------- 15×15
  {
    id: 'raket',
    name: 'Raket',
    difficulty: 'hard',
    emoji: '🚀',
    grid: [
      '000000100000000',
      '000001110000000',
      '000011111000000',
      '000011011000000',
      '000011111000000',
      '000011111000000',
      '000111111100000',
      '001111111110000',
      '001110001110000',
      '000000100000000',
      '000001110000000',
      '000011111000000',
      '000011111000000',
      '000001110000000',
      '000000100000000',
    ],
  },
  {
    id: 'paddenstoel',
    name: 'Paddenstoel',
    difficulty: 'hard',
    emoji: '🍄',
    grid: [
      '000000000000000',
      '000001111100000',
      '000111111111000',
      '001111111111100',
      '011111111111110',
      '011101110111110',
      '011111111111110',
      '001111111111100',
      '000011111110000',
      '000000111000000',
      '000000111000000',
      '000000111000000',
      '000000111000000',
      '000001111100000',
      '000000000000000',
    ],
  },
];

export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABELS = {
  easy: 'Makkelijk',
  medium: 'Gemiddeld',
  hard: 'Moeilijk',
};

/** Zoek een puzzel op via id. */
export function getPuzzle(id) {
  return PUZZLES.find((p) => p.id === id) || null;
}
