// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { clearMeaningCache, MEANING_CACHE_KEY, readMeaningCache, saveMeaningCache } from './meaning-cache';
import type { MeaningResult } from './word-meanings';

const entry = (word = 'casa', language: 'es' | 'en' = 'es'): MeaningResult => ({ language, word, fetchedAt: '2026-08-30T12:00:00.000Z', entries: [{ title: word, revision: 123, senses: [{ text: 'Definition.', category: 'Noun' }] }] });
// Explicit storage double avoids Node 26's native localStorage shadowing jsdom.
const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};
beforeEach(() => { values.clear(); vi.stubGlobal('localStorage', localStorage); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('bounded local meaning cache', () => {
  it('retains a successful response across reads and normalizes case and spaces', () => {
    expect(saveMeaningCache(entry())).toBe(true);
    expect(readMeaningCache(' CASA ', 'es')).toEqual(entry());
  });
  it('separates languages, accents and Ñ', () => {
    for (const word of ['ano', 'año', 'papa', 'papá']) saveMeaningCache(entry(word));
    saveMeaningCache(entry('papa', 'en'));
    expect(readMeaningCache('año', 'es')?.word).toBe('año');
    expect(readMeaningCache('ano', 'es')?.word).toBe('ano');
    expect(readMeaningCache('papa', 'es')?.language).toBe('es');
    expect(readMeaningCache('papa', 'en')?.language).toBe('en');
    expect(readMeaningCache('papá', 'es')?.word).toBe('papá');
  });
  it('caps stored consultations and replaces a refreshed entry', () => {
    for (let i = 0; i < 70; i++) saveMeaningCache(entry(`casa${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`));
    expect(JSON.parse(localStorage.getItem(MEANING_CACHE_KEY)!)).toHaveLength(60);
    expect(readMeaningCache('casaaa', 'es')).toBeNull();
    saveMeaningCache(entry('casacc'));
    saveMeaningCache(entry('casacc'));
    expect(JSON.parse(localStorage.getItem(MEANING_CACHE_KEY)!)).toHaveLength(60);
  });
  it.each(['broken-json', '{}', '[null,1,"bad"]', 'x'.repeat(1_000_001)])('ignores corrupt or excessive cache data', (value) => {
    localStorage.setItem(MEANING_CACHE_KEY, value);
    expect(readMeaningCache('casa', 'es')).toBeNull();
  });
  it('does not cache missing meanings or an unrelated entry', () => {
    expect(saveMeaningCache({ ...entry(), entries: [] })).toBe(false);
    const wrong = entry(); wrong.entries[0].title = 'other';
    expect(saveMeaningCache(wrong)).toBe(false);
  });
  it('handles unavailable storage without blocking lookup', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(readMeaningCache('casa', 'es')).toBeNull();
    expect(saveMeaningCache(entry())).toBe(false);
  });
  it('clears only definitions, leaving other app storage intact', () => {
    localStorage.setItem('other-app-data', 'keep');
    saveMeaningCache(entry());
    expect(clearMeaningCache()).toBe(true);
    expect(readMeaningCache('casa', 'es')).toBeNull();
    expect(localStorage.getItem('other-app-data')).toBe('keep');
  });
});
