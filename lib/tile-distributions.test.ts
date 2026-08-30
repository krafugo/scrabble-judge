import { describe, expect, it } from 'vitest';
import { TILE_DISTRIBUTIONS, totalTiles } from './tile-distributions';

function tile(language: 'es' | 'en', letter: string) {
  return TILE_DISTRIBUTIONS[language].find((candidate) => candidate.letter === letter);
}

describe('Scrabble tile distributions', () => {
  it.each(['es', 'en'] as const)('%s contains exactly 100 tiles including two blanks', (language) => {
    expect(totalTiles(language)).toBe(100);
    expect(tile(language, '★')).toMatchObject({ count: 2, value: 0, blank: true });
  });

  it('uses the FILE Spanish digraphs, values and quantities', () => {
    expect(tile('es', 'A')).toMatchObject({ count: 12, value: 1 });
    expect(tile('es', 'CH')).toMatchObject({ count: 1, value: 5 });
    expect(tile('es', 'LL')).toMatchObject({ count: 1, value: 8 });
    expect(tile('es', 'Ñ')).toMatchObject({ count: 1, value: 8 });
    expect(tile('es', 'RR')).toMatchObject({ count: 1, value: 8 });
    expect(tile('es', 'Q')).toMatchObject({ count: 1, value: 5 });
    expect(tile('es', 'K')).toBeUndefined();
    expect(tile('es', 'W')).toBeUndefined();
  });

  it('uses the Hasbro English values and quantities', () => {
    expect(tile('en', 'E')).toMatchObject({ count: 12, value: 1 });
    expect(tile('en', 'K')).toMatchObject({ count: 1, value: 5 });
    expect(tile('en', 'Q')).toMatchObject({ count: 1, value: 10 });
    expect(tile('en', 'Z')).toMatchObject({ count: 1, value: 10 });
  });
});
