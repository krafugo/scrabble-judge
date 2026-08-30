// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WordMeaning, { AnagramMeanings } from '../components/word-meaning';
import Home from '../app/page';
import { fetchWordMeanings, MeaningRateLimitError, type MeaningResult } from './word-meanings';
import { readMeaningCache, saveMeaningCache } from './meaning-cache';
import { resolveSecretAction } from './secret-actions';

vi.mock('./word-meanings', async (importOriginal) => ({ ...await importOriginal<typeof import('./word-meanings')>(), fetchWordMeanings: vi.fn() }));
vi.mock('./meaning-cache', () => ({ readMeaningCache: vi.fn(), saveMeaningCache: vi.fn(), clearMeaningCache: vi.fn() }));
vi.mock('./default-lexicons', () => ({ DEFAULT_LEXICON_URLS: [], loadDefaultLexicon: vi.fn(async () => ({ text: 'casa\nhouse\n', count: 2, name: 'Test' })) }));
vi.mock('./lexicon-store', () => ({ readStoredLexicon: vi.fn(async () => null), removeStoredLexicon: vi.fn(), saveStoredLexicon: vi.fn() }));
vi.mock('./secret-actions', () => ({ resolveSecretAction: vi.fn(async () => null) }));

const data: MeaningResult = { language: 'es', word: 'casa', fetchedAt: '2026-08-30T12:00:00Z', entries: [{ title: 'casa', revision: 123, senses: [{ text: 'Un edificio para vivir.', category: 'Sustantivo' }] }] };
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  vi.mocked(readMeaningCache).mockReturnValue(null);
  vi.mocked(saveMeaningCache).mockReturnValue(true);
  vi.mocked(fetchWordMeanings).mockResolvedValue(data);
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

async function show(word = 'casa') { await act(async () => root.render(createElement(WordMeaning, { word, language: 'es', key: word }))); }
async function click(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(text));
  expect(button, `Missing button ${text}`).toBeDefined();
  await act(async () => button!.click());
}

describe('optional definition UI', () => {
  it('makes no request until explicitly opened and keeps hide/show local', async () => {
    await show();
    expect(fetchWordMeanings).not.toHaveBeenCalled();
    expect(container.textContent).toContain('se envía esta palabra');
    await click('Ver significado');
    expect(fetchWordMeanings).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Un edificio para vivir.');
    expect(container.textContent).toContain('CC BY-SA 4.0');
    await click('Ocultar significado'); await click('Ver significado');
    expect(fetchWordMeanings).toHaveBeenCalledTimes(1);
  });
  it('reads saved meanings offline without any network request', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    vi.mocked(readMeaningCache).mockReturnValue(data);
    await show(); await click('Ver significado');
    expect(container.textContent).toContain('Copia local');
    expect(fetchWordMeanings).not.toHaveBeenCalled();
  });
  it('explains an offline cache miss without changing word validity', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await show(); await click('Ver significado');
    expect(container.textContent).toContain('La palabra sigue siendo válida');
    expect(fetchWordMeanings).not.toHaveBeenCalled();
  });
  it('distinguishes missing meanings from an unavailable provider and supports retry', async () => {
    vi.mocked(fetchWordMeanings).mockResolvedValueOnce({ ...data, entries: [] }).mockRejectedValueOnce(new Error('HTTP 429'));
    await show(); await click('Ver significado');
    expect(container.textContent).toContain('No encontramos una definición');
    expect(saveMeaningCache).not.toHaveBeenCalled();
    await click('Reintentar');
    expect(container.textContent).toContain('No se pudo consultar');
    await click('Reintentar');
    expect(container.textContent).toContain('Un edificio para vivir.');
  });
  it('still displays the result when persistence fails, without claiming offline availability', async () => {
    vi.mocked(saveMeaningCache).mockReturnValue(false);
    await show(); await click('Ver significado');
    expect(container.textContent).toContain('Un edificio para vivir.');
    expect(container.textContent).toContain('No se pudo guardar');
  });
  it('disables retry during the provider cooldown without retrying automatically', async () => {
    vi.mocked(fetchWordMeanings).mockRejectedValue(new MeaningRateLimitError(Date.now() + 60_000));
    await show(); await click('Ver significado');
    expect(container.textContent).toContain('limitado temporalmente');
    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reintentar')!;
    expect(retry.disabled).toBe(true);
    await click('Reintentar');
    expect(fetchWordMeanings).toHaveBeenCalledTimes(1);
  });
  it('ignores late responses and cancels the old request when the selected word changes', async () => {
    let resolve!: (value: MeaningResult) => void;
    vi.mocked(fetchWordMeanings).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await show(); await click('Ver significado');
    const signal = vi.mocked(fetchWordMeanings).mock.calls[0][2]!;
    expect(container.textContent).toContain('Buscando significado');
    await show('voz');
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(data));
    expect(container.textContent).not.toContain('Un edificio para vivir.');
  });
  it('escapes definition text instead of injecting HTML', async () => {
    vi.mocked(fetchWordMeanings).mockResolvedValue({ ...data, entries: [{ ...data.entries[0], senses: [{ text: '<img src=x onerror=alert(1)>', category: 'Noun' }] }] });
    await show(); await click('Ver significado');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });
  it('supports meanings for anagram results without fetching the entire list', async () => {
    await act(async () => root.render(createElement(AnagramMeanings, { words: ['casa', 'saca'], language: 'es' })));
    await click('CASA');
    expect(fetchWordMeanings).not.toHaveBeenCalled();
    await click('Ver significado');
    expect(fetchWordMeanings).toHaveBeenCalledTimes(1);
    await click('SACA');
    expect(container.textContent).not.toContain('Un edificio para vivir.');
  });
  it('offers definitions only after a valid local judgement, never for invalid words', async () => {
    await act(async () => root.render(createElement(Home)));
    const input = container.querySelector<HTMLInputElement>('#word')!;
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setValue.call(input, 'casa'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain('VÁLIDA');
    expect(container.textContent).toContain('Ver significado');
    expect(fetchWordMeanings).not.toHaveBeenCalled();
    await act(async () => { setValue.call(input, 'zzzzzz'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain('INVÁLIDA');
    expect(container.textContent).not.toContain('Ver significado');
    expect(fetchWordMeanings).not.toHaveBeenCalled();
  });
  it('does not attach an old valid result to a new input while secret resolution is pending', async () => {
    let finish!: (value: null) => void;
    vi.mocked(resolveSecretAction).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    await act(async () => root.render(createElement(Home)));
    const input = container.querySelector<HTMLInputElement>('#word')!;
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setValue.call(input, 'casa'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await act(async () => { setValue.call(input, 'zzzzzz'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => finish(null));
    expect(container.querySelector('.result-panel')).toBeNull();
    expect(container.textContent).not.toContain('Ver significado');
  });
});
