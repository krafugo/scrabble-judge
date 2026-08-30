export type Language = 'es' | 'en';

export type CompiledLexicon = {
  text: string;
  count: number;
  rejected: number;
};

export function normalizeWord(input: string, language: Language): string {
  const locale = language === 'es' ? 'es' : 'en';
  let value = input.normalize('NFKC').trim().toLocaleLowerCase(locale);

  if (language === 'es') {
    value = value.replace(/ñ/g, '\uE000');
  }

  value = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\uE000/g, 'ñ');

  return value;
}

export function countTiles(word: string, language: Language): number {
  if (language === 'en') return word.length;

  let tiles = 0;
  for (let index = 0; index < word.length; index += 1) {
    const pair = word.slice(index, index + 2);
    if (pair === 'ch' || pair === 'll' || pair === 'rr') index += 1;
    tiles += 1;
  }
  return tiles;
}

export function looksLikeSpanishLexicon(source: string, fileName = ''): boolean {
  const normalizedName = fileName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es');
  const spanishName = /(?:^|[-_.\s])(?:es|espanol|spanish)(?:[-_.\s]|$)/.test(normalizedName);
  return spanishName || /[ñÑ]/.test(source);
}

export function getInputError(word: string, language: Language): string | null {
  if (!word) return 'Escribe una palabra para comprobarla.';
  const pattern = language === 'es' ? /^[a-zñ]+$/ : /^[a-z]+$/;
  if (!pattern.test(word)) return 'Usa solo letras, sin espacios, guiones ni signos.';
  if (word.length < 2) return 'Las jugadas válidas deben tener al menos 2 letras.';
  if (countTiles(word, language) > 15) return 'Este juez admite palabras de hasta 15 fichas.';
  return null;
}

export function compileLexicon(source: string, language: Language): CompiledLexicon {
  const words = new Set<string>();
  let rejected = 0;

  for (const rawLine of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const word = normalizeWord(line, language);
    if (getInputError(word, language)) {
      rejected += 1;
      continue;
    }
    words.add(word);
  }

  const sorted = Array.from(words).sort();
  return { text: sorted.join('\n'), count: sorted.length, rejected };
}

export function hasWord(lexicon: string, target: string): boolean {
  let low = 0;
  let high = lexicon.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const start = middle === 0 ? 0 : lexicon.lastIndexOf('\n', middle - 1) + 1;
    const foundEnd = lexicon.indexOf('\n', middle);
    const end = foundEnd === -1 ? lexicon.length : foundEnd;
    const candidate = lexicon.slice(start, end);

    if (candidate === target) return true;
    if (candidate < target) low = end + 1;
    else high = start;
  }

  return false;
}

function letterIndex(character: string): number {
  if (character === 'ñ') return 26;
  const index = character.charCodeAt(0) - 97;
  return index >= 0 && index < 26 ? index : -1;
}

export function findWordsFromLetters(lexicon: string, letters: string): string[] {
  const targetCounts = new Uint8Array(27);
  const candidateCounts = new Uint8Array(27);
  const matches: string[] = [];

  for (const character of letters) {
    const index = letterIndex(character);
    if (index === -1) return [];
    targetCounts[index] += 1;
  }

  let start = 0;
  while (start < lexicon.length) {
    const foundEnd = lexicon.indexOf('\n', start);
    const end = foundEnd === -1 ? lexicon.length : foundEnd;

    const candidateLength = end - start;
    if (candidateLength >= 2 && candidateLength <= letters.length) {
      let isMatch = true;
      candidateCounts.fill(0);

      for (let index = start; index < end; index += 1) {
        const countIndex = letterIndex(lexicon[index]);
        if (countIndex === -1 || ++candidateCounts[countIndex] > targetCounts[countIndex]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) matches.push(lexicon.slice(start, end));
    }

    if (foundEnd === -1) break;
    start = end + 1;
  }

  return matches.sort((first, second) => second.length - first.length || first.localeCompare(second));
}
