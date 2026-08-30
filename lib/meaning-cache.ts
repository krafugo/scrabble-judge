import { MEANING_LIMITS, meaningWord, type MeaningResult } from './word-meanings';
import { normalizeWord, type Language } from './word-judge';

export const MEANING_CACHE_KEY = 'palabra-justa-meanings-v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isMeaningResult(value: unknown): value is MeaningResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as MeaningResult;
  return (result.language === 'es' || result.language === 'en') && typeof result.word === 'string' && result.word.length <= 40 &&
    result.word === meaningWord(result.word, result.language) && typeof result.fetchedAt === 'string' && Number.isFinite(Date.parse(result.fetchedAt)) &&
    Array.isArray(result.entries) && result.entries.length > 0 && result.entries.length <= MEANING_LIMITS.entries &&
    result.entries.every((entry) => entry && typeof entry.title === 'string' && entry.title.length <= 40 &&
      normalizeWord(entry.title, result.language) === normalizeWord(result.word, result.language) &&
      Number.isSafeInteger(entry.revision) && entry.revision > 0 && Array.isArray(entry.senses) && entry.senses.length > 0 && entry.senses.length <= MEANING_LIMITS.senses &&
      entry.senses.every((sense) => sense && typeof sense.text === 'string' && sense.text.length > 0 && sense.text.length <= MEANING_LIMITS.text && typeof sense.category === 'string' && sense.category.length <= 160));
}

function readAll(storage: StorageLike): MeaningResult[] {
  try {
    const text = storage.getItem(MEANING_CACHE_KEY);
    if (!text || text.length > 1_000_000) return [];
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(isMeaningResult).slice(-MEANING_LIMITS.cache) : [];
  } catch { return []; }
}

export function readMeaningCache(word: string, language: Language): MeaningResult | null {
  try {
    return readAll(window.localStorage).find((entry) => entry.word === meaningWord(word, language) && entry.language === language) ?? null;
  } catch { return null; }
}

export function saveMeaningCache(result: MeaningResult): boolean {
  if (!isMeaningResult(result)) return false;
  try {
    const storage = window.localStorage;
    const entries = readAll(storage).filter((entry) => entry.word !== result.word || entry.language !== result.language);
    storage.setItem(MEANING_CACHE_KEY, JSON.stringify([...entries, result].slice(-MEANING_LIMITS.cache)));
    return true;
  } catch { return false; }
}

export function clearMeaningCache(): boolean {
  try { window.localStorage.removeItem(MEANING_CACHE_KEY); return true; } catch { return false; }
}
