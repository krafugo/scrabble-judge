import { describe, expect, it } from 'vitest';
import { compileLexicon, countTiles, findWordsFromLetters, getInputError, getSpecialJudgeResult, hasWord, looksLikeSpanishLexicon, normalizeWord } from './word-judge';

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
  it('returns the requested personalized messages after normalization', () => {
    expect(getSpecialJudgeResult(normalizeWord('  MaríaClara  ', 'es'))).toEqual({
      forceInvalid: true,
      message: 'hidden message',
    });
    expect(getSpecialJudgeResult(normalizeWord('hidden-trigger-two', 'es'))).toEqual({
      forceInvalid: false,
      message: 'hidden message',
    });
    expect(getSpecialJudgeResult(normalizeWord('casa', 'es'))).toBeNull();
  });

  it('normalizes, sorts and deduplicates imported words', () => {
    const lexicon = compileLexicon('# prueba\nÁrbol\nniño\nARBOL\nmal-formada\n', 'es');
    expect(lexicon.text).toBe('arbol\nniño');
    expect(lexicon.count).toBe(2);
    expect(lexicon.rejected).toBe(1);
  });

  it('finds words made from all or part of the supplied letters', () => {
    const lexicon = 'as\nasa\ncasa\ncasas\nsaca\nsaco\n';

    expect(findWordsFromLetters(lexicon, 'csaa')).toEqual(['casa', 'saca', 'asa', 'as']);
    expect(findWordsFromLetters(lexicon, 'cassa')).toEqual(['casas', 'casa', 'saca', 'asa', 'as']);
    expect(findWordsFromLetters(lexicon, 'csa')).toEqual(['as']);
  });

  it('keeps Spanish Ñ distinct while finding anagrams', () => {
    const lexicon = 'nina\nniña\nñina';

    expect(findWordsFromLetters(lexicon, 'añin')).toEqual(['niña', 'ñina']);
    expect(findWordsFromLetters(lexicon, 'anin')).toEqual(['nina']);
  });

  it('finds VOZ from ZIVO without reusing or inventing letters', () => {
    const lexicon = 'vio\nvoz\nvozz\nzoo';

    expect(findWordsFromLetters(lexicon, 'zivo')).toEqual(['vio', 'voz']);
  });

  it('finds first, middle and last entries with binary search', () => {
    const lexicon = 'apple\nmoon\nriver\nword\nzebra';
    expect(hasWord(lexicon, 'apple')).toBe(true);
    expect(hasWord(lexicon, 'river')).toBe(true);
    expect(hasWord(lexicon, 'zebra')).toBe(true);
    expect(hasWord(lexicon, 'orange')).toBe(false);
  });

  it('supports bundled lexicons that end with a newline', () => {
    const lexicon = 'apple\nmoon\nriver\nword\nzebra\n';
    expect(hasWord(lexicon, 'apple')).toBe(true);
    expect(hasWord(lexicon, 'zebra')).toBe(true);
    expect(hasWord(lexicon, 'orange')).toBe(false);
  });

  it('counts Spanish digraph tiles instead of individual characters', () => {
    expect('achicharramientos').toHaveLength(17);
    expect(countTiles('achicharramientos', 'es')).toBe(14);
    expect(getInputError('achicharramientos', 'es')).toBeNull();
    expect(getInputError('ababillaraababillarais', 'es')).toBeTruthy();
  });

  it('imports long Spanish spellings when they use at most 15 tiles', () => {
    const lexicon = compileLexicon('abarquillamiento\nachicharramientos\nababillaraababillarais', 'es');
    expect(lexicon.count).toBe(2);
    expect(lexicon.rejected).toBe(1);
  });

  it('recognizes Spanish lexicons before they enter the English slot', () => {
    expect(looksLikeSpanishLexicon('arbol\nniño\nzapato', 'words.txt')).toBe(true);
    expect(looksLikeSpanishLexicon('apple\nriver\nword', 'scrabble-es.txt')).toBe(true);
    expect(looksLikeSpanishLexicon('apple\nriver\nword', 'csw24.txt')).toBe(false);
  });
});
