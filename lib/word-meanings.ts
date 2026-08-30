import { getInputError, normalizeWord, type Language } from './word-judge';

export type MeaningSense = { text: string; category: string };
export type MeaningEntry = { title: string; revision: number; senses: MeaningSense[] };
export type MeaningResult = { language: Language; word: string; entries: MeaningEntry[]; fetchedAt: string };
export const MEANING_LIMITS = { entries: 3, senses: 6, text: 600, cache: 60 } as const;
export const MEANING_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

export class MeaningRateLimitError extends Error {
  constructor(public retryAt: number) { super('Dictionary rate limit'); }
}

// Unlike tile normalization, dictionary spelling must retain accents: papa ≠ papá.
export function meaningWord(word: string, language: Language): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase(language);
}

export function meaningSourceUrl(language: Language, word: string, revision?: number): string {
  const base = `https://${language}.wiktionary.org`;
  return revision
    ? `${base}/w/index.php?title=${encodeURIComponent(word)}&oldid=${revision}`
    : `${base}/wiki/${encodeURIComponent(word)}#${language === 'es' ? 'Español' : 'English'}`;
}

function cleanText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, link, sup, dl, ul, ol, table, .mw-editsection, .defdate').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Extract only the requested language's lexical senses, never execute/render remote HTML. */
export function parseMeaningHtml(html: string, language: Language): MeaningSense[] {
  if (html.length > 3_000_000) throw new Error('Definition response too large');
  // Template contents are inert: scripts, images and styles are never attached to the document.
  const template = document.createElement('template');
  template.innerHTML = html;
  const senses: MeaningSense[] = [];
  const seen = new Set<string>();
  let active = false;
  let category = '';
  const pos = language === 'es'
    ? /^(Sustantivo|Adjetivo|Verbo|Forma verbal|Forma sustantiva|Forma adjetiva|Adverbio|Pronombre|Artículo|Preposición|Conjunción|Interjección|Numeral|Determinante)\b/i
    : /^(Noun|Verb|Adjective|Adverb|Pronoun|Article|Preposition|Conjunction|Interjection|Numeral|Determiner|Participle)\b/i;

  for (const element of template.content.querySelectorAll('h2, h3, h4, h5, h6, dt, ol > li')) {
    const tag = element.tagName;
    if (tag === 'H2') {
      active = cleanText(element) === (language === 'es' ? 'Español' : 'English');
      category = '';
      continue;
    }
    if (!active) continue;
    if (/^H[3-6]$/.test(tag)) {
      const heading = cleanText(element);
      if (pos.test(heading)) {
        category = heading;
      } else category = '';
      continue;
    }
    if (!category || element.closest('table, .references, .citation-whole')) continue;
    let text = '';
    let label = category;
    if (language === 'es' && tag === 'DT' && /^\d+(?:\s|$)/.test(cleanText(element))) {
      const definition = element.nextElementSibling;
      if (definition?.tagName !== 'DD' || element.parentElement?.closest('dd, li')) continue;
      text = cleanText(definition);
      const domain = cleanText(element).replace(/^\d+\s*/, '');
      if (domain) label += ` · ${domain}`;
    } else if (language === 'en' && tag === 'LI' && !element.parentElement?.parentElement?.closest('li, dd')) {
      text = cleanText(element);
    }
    if (!text || seen.has(text)) continue;
    seen.add(text);
    senses.push({ text: text.length > MEANING_LIMITS.text ? `${text.slice(0, MEANING_LIMITS.text - 1)}…` : text, category: label.slice(0, 160) });
    if (senses.length === MEANING_LIMITS.senses) break;
  }
  return senses;
}

type ApiResponse = {
  error?: { code?: string };
  parse?: { title?: string; text?: string; revid?: number };
  query?: { search?: { title?: string }[] };
};

async function request(language: Language, params: Record<string, string>, signal: AbortSignal): Promise<ApiResponse> {
  const url = new URL(`https://${language}.wiktionary.org/w/api.php`);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }).toString();
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (response.status === 429) {
    const header = response.headers.get('Retry-After');
    const seconds = header && /^\d+$/.test(header) ? Number(header) : NaN;
    const retryAt = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(header ?? '');
    throw new MeaningRateLimitError(Math.max(Date.now() + 1000, Number.isFinite(retryAt) ? retryAt : Date.now() + 60_000));
  }
  if (!response.ok) throw new Error(`Dictionary HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid dictionary response');
  return data as ApiResponse;
}

/** Called explicitly by the reader, never by the local word judge. */
export async function fetchWordMeanings(input: string, language: Language, signal?: AbortSignal): Promise<MeaningResult> {
  const word = meaningWord(input, language);
  const normalized = normalizeWord(word, language);
  if (getInputError(normalized, language)) throw new Error('Invalid word');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  const entries: MeaningEntry[] = [];
  try {
    async function loadTitle(title: string) {
      controller.signal.throwIfAborted();
      const data = await request(language, { action: 'parse', page: title, prop: 'text|revid', redirects: '1', disableeditsection: '1' }, controller.signal);
      if (data.error?.code === 'missingtitle') return;
      if (data.error || typeof data.parse?.text !== 'string' || typeof data.parse.title !== 'string' || !Number.isSafeInteger(data.parse.revid) || data.parse.revid! <= 0) {
        throw new Error('Invalid dictionary entry');
      }
      // Do not replace this word with an unrelated redirect or a suggestion.
      if (normalizeWord(data.parse.title, language) !== normalized) return;
      const senses = parseMeaningHtml(data.parse.text, language);
      if (senses.length && !entries.some((entry) => entry.title === data.parse!.title)) {
        entries.push({ title: data.parse.title, revision: data.parse.revid!, senses });
      }
    }
    await loadTitle(word);
    // Spanish tile spelling omits accents. Search titles, then accept ONLY exact
    // tile-equivalent spellings (including Ñ); never use fuzzy search definitions.
    if (language === 'es' && (word === normalized || !entries.length)) {
      try {
        const data = await request(language, { action: 'query', list: 'search', srsearch: `intitle:${normalized}`, srnamespace: '0', srlimit: '20', srprop: '' }, controller.signal);
        if (data.error || !Array.isArray(data.query?.search)) throw new Error('Invalid dictionary search');
        const titles = [...new Set(data.query.search.map((entry) => entry.title).filter((title): title is string =>
          typeof title === 'string' && title !== word && meaningWord(title, language) === title && normalizeWord(title, language) === normalized))];
        for (const title of titles.slice(0, MEANING_LIMITS.entries - entries.length)) await loadTitle(title);
      } catch (error) {
        // Keep a usable exact result if optional accent discovery is unavailable.
        if (!entries.length || signal?.aborted) throw error;
      }
    }
    signal?.throwIfAborted();
    return { language, word, entries, fetchedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
