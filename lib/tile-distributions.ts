import { Language } from './word-judge';

export type ScrabbleTile = {
  letter: string;
  value: number;
  count: number;
  blank?: boolean;
};

export const TILE_DISTRIBUTIONS: Record<Language, ScrabbleTile[]> = {
  es: [
    { letter: 'A', value: 1, count: 12 },
    { letter: 'B', value: 3, count: 2 },
    { letter: 'C', value: 3, count: 4 },
    { letter: 'CH', value: 5, count: 1 },
    { letter: 'D', value: 2, count: 5 },
    { letter: 'E', value: 1, count: 12 },
    { letter: 'F', value: 4, count: 1 },
    { letter: 'G', value: 2, count: 2 },
    { letter: 'H', value: 4, count: 2 },
    { letter: 'I', value: 1, count: 6 },
    { letter: 'J', value: 8, count: 1 },
    { letter: 'L', value: 1, count: 4 },
    { letter: 'LL', value: 8, count: 1 },
    { letter: 'M', value: 3, count: 2 },
    { letter: 'N', value: 1, count: 5 },
    { letter: 'Ñ', value: 8, count: 1 },
    { letter: 'O', value: 1, count: 9 },
    { letter: 'P', value: 3, count: 2 },
    { letter: 'Q', value: 5, count: 1 },
    { letter: 'R', value: 1, count: 5 },
    { letter: 'RR', value: 8, count: 1 },
    { letter: 'S', value: 1, count: 6 },
    { letter: 'T', value: 1, count: 4 },
    { letter: 'U', value: 1, count: 5 },
    { letter: 'V', value: 4, count: 1 },
    { letter: 'X', value: 8, count: 1 },
    { letter: 'Y', value: 4, count: 1 },
    { letter: 'Z', value: 10, count: 1 },
    { letter: '★', value: 0, count: 2, blank: true },
  ],
  en: [
    { letter: 'A', value: 1, count: 9 },
    { letter: 'B', value: 3, count: 2 },
    { letter: 'C', value: 3, count: 2 },
    { letter: 'D', value: 2, count: 4 },
    { letter: 'E', value: 1, count: 12 },
    { letter: 'F', value: 4, count: 2 },
    { letter: 'G', value: 2, count: 3 },
    { letter: 'H', value: 4, count: 2 },
    { letter: 'I', value: 1, count: 9 },
    { letter: 'J', value: 8, count: 1 },
    { letter: 'K', value: 5, count: 1 },
    { letter: 'L', value: 1, count: 4 },
    { letter: 'M', value: 3, count: 2 },
    { letter: 'N', value: 1, count: 6 },
    { letter: 'O', value: 1, count: 8 },
    { letter: 'P', value: 3, count: 2 },
    { letter: 'Q', value: 10, count: 1 },
    { letter: 'R', value: 1, count: 6 },
    { letter: 'S', value: 1, count: 4 },
    { letter: 'T', value: 1, count: 6 },
    { letter: 'U', value: 1, count: 4 },
    { letter: 'V', value: 4, count: 2 },
    { letter: 'W', value: 4, count: 2 },
    { letter: 'X', value: 8, count: 1 },
    { letter: 'Y', value: 4, count: 2 },
    { letter: 'Z', value: 10, count: 1 },
    { letter: '★', value: 0, count: 2, blank: true },
  ],
};

export function totalTiles(language: Language): number {
  return TILE_DISTRIBUTIONS[language].reduce((total, tile) => total + tile.count, 0);
}
