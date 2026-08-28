import englishLexiconUrl from '../english-scrabble-words.txt?url';
import spanishLexiconUrl from '../spanish-scrabble-words.txt?url';
import type { Language } from './word-judge';

export type DefaultLexicon = {
  text: string;
  count: number;
  name: string;
};

type DefaultLexiconDefinition = Omit<DefaultLexicon, 'text'> & {
  url: string;
};

export const DEFAULT_LEXICONS: Record<Language, DefaultLexiconDefinition> = {
  es: {
    url: spanishLexiconUrl,
    count: 662_806,
    name: 'spanish-scrabble-words.txt',
  },
  en: {
    url: englishLexiconUrl,
    count: 268_134,
    name: 'english-scrabble-words.txt',
  },
};

export const DEFAULT_LEXICON_URLS = Object.values(DEFAULT_LEXICONS).map(({ url }) => url);

export async function loadDefaultLexicon(
  language: Language,
  signal?: AbortSignal,
): Promise<DefaultLexicon> {
  const definition = DEFAULT_LEXICONS[language];
  const response = await fetch(definition.url, { signal });

  if (!response.ok) {
    throw new Error(`Unable to load ${definition.name}: ${response.status}`);
  }

  return {
    text: await response.text(),
    count: definition.count,
    name: definition.name,
  };
}
