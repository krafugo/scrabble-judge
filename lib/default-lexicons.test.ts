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
});
