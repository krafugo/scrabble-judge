import { describe, expect, it } from 'vitest';
import { compileLexicon, getInputError, hasWord, normalizeWord } from './word-judge';

describe('normalizeWord', () => {
  it('trims and ignores case', () => {
    expect(normalizeWord('  MuRcIÉLaGo  ', 'es')).toBe('murcielago');
    expect(normalizeWord('  BEAUTIFUL ', 'en')).toBe('beautiful');
  });

  it('removes Spanish vowel accents but preserves Ñ', () => {
    expect(normalizeWord('NIÑO', 'es')).toBe('niño');
    expect(normalizeWord('pingüino', 'es')).toBe('pinguino');
    expect(normalizeWord('CANCIÓN', 'es')).toBe('cancion');
  });

  it('rejects internal spaces and punctuation after normalization', () => {
    expect(getInputError(normalizeWord('dos palabras', 'es'), 'es')).toBeTruthy();
    expect(getInputError(normalizeWord('ice-cream', 'en'), 'en')).toBeTruthy();
  });
});

describe('lexicon compilation and lookup', () => {
  it('normalizes, sorts and deduplicates imported words', () => {
    const lexicon = compileLexicon('# prueba\nÁrbol\nniño\nARBOL\nmal-formada\n', 'es');
    expect(lexicon.text).toBe('arbol\nniño');
    expect(lexicon.count).toBe(2);
    expect(lexicon.rejected).toBe(1);
  });

  it('finds first, middle and last entries with binary search', () => {
    const lexicon = 'apple\nmoon\nriver\nword\nzebra';
    expect(hasWord(lexicon, 'apple')).toBe(true);
    expect(hasWord(lexicon, 'river')).toBe(true);
    expect(hasWord(lexicon, 'zebra')).toBe(true);
    expect(hasWord(lexicon, 'orange')).toBe(false);
  });
});
