import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LEXICONS } from './default-lexicons';
import { getInputError, hasWord, Language, normalizeWord } from './word-judge';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

const FILES: Record<Language, string> = {
  es: 'spanish-scrabble-words.txt',
  en: 'english-scrabble-words.txt',
};

describe('bundled default lexicons', () => {
  it('never substitutes a reduced starter vocabulary when a full dictionary cannot load', () => {
    const wordJudge = fs.readFileSync(path.join(PROJECT_ROOT, 'lib/word-judge.ts'), 'utf8');
    const page = fs.readFileSync(path.join(PROJECT_ROOT, 'app/page.tsx'), 'utf8');

    expect(wordJudge).not.toContain('STARTER_LEXICON');
    expect(wordJudge).not.toContain('STARTER_SPANISH');
    expect(wordJudge).not.toContain('STARTER_ENGLISH');
    expect(page).not.toContain('fallbackLexicon');
    expect(page).toContain('No se pudo cargar el diccionario completo');
    expect(page).toContain('Volver a intentar la carga');
  });

  for (const language of ['es', 'en'] as const) {
    it(`keeps the ${language} file normalized, unique and ready for lookup`, () => {
      const fileName = FILES[language];
      const source = fs.readFileSync(path.join(PROJECT_ROOT, fileName), 'utf8');
      const words = source.trimEnd().split(/\r?\n/);
      let previous = '';

      for (const [index, word] of words.entries()) {
        if (normalizeWord(word, language) !== word || getInputError(word, language)) {
          throw new Error(`${fileName}:${index + 1} is not a valid normalized entry: ${word}`);
        }
        if (previous && previous >= word) {
          throw new Error(`${fileName}:${index + 1} is duplicated or out of order: ${word}`);
        }
        previous = word;
      }

      expect(words).toHaveLength(DEFAULT_LEXICONS[language].count);
      expect(hasWord(source, words[0])).toBe(true);
      expect(hasWord(source, words[Math.floor(words.length / 2)])).toBe(true);
      expect(hasWord(source, words.at(-1)!)).toBe(true);
    });
  }

  it.each([
    ['es', ['dios', 'budismo', 'islam', 'chile', 'lima', 'granada', 'rosa', 'paella', 'ceviche', 'ajolote', 'radar', 'ovni', 'boicot', 'diesel'], ['zeus', 'jehova', 'madrid', 'mexico', 'axolote', 'pluto', 'onu', 'dvd', 'usb']],
    ['en', ['god', 'faith', 'china', 'turkey', 'nice', 'rose', 'will', 'pizza', 'paella', 'axolotl', 'radar', 'scuba', 'sandwich', 'quixotic'], ['zeus', 'allah', 'london', 'madrid', 'rome', 'pluto', 'fbi', 'dvd', 'usb', 'nasa']],
  ] as const)('supports the documented %s category examples', (language, accepted, rejected) => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, FILES[language]), 'utf8');

    for (const word of accepted) expect(hasWord(source, word), `${word} should be accepted`).toBe(true);
    for (const word of rejected) expect(hasWord(source, word), `${word} should be rejected`).toBe(false);
  });
});
