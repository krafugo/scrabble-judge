// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWordMeanings, MeaningRateLimitError, meaningSourceUrl, meaningWord, parseMeaningHtml } from './word-meanings';

// Synthetic fixtures model the API's legacy and current heading/list structures.
const esHtml = '<div class="mw-heading"><h2><span id="es"></span>Español</h2></div><h3>Sustantivo femenino</h3><dl><dt>1 Arquitectura</dt><dd>Un edificio para vivir.<ul><li>Ejemplo citado.</li></ul></dd><dt>2</dt><dd>Una familia.<sup>[1]</sup></dd></dl><h3>Traducciones</h3><ol><li>Ignore me</li></ol><h2>Italiano</h2><h3>Sustantivo</h3><dl><dt>1</dt><dd>No español</dd></dl>';
const enHtml = '<h2><span class="mw-headline">English</span></h2><h3>Etymology</h3><ol><li>Not a sense</li></ol><h3>Noun</h3><ol><li>A <a href="/wiki/home">home</a>.<dl><dd>A quoted example.</dd></dl><ol><li>A nested meaning.</li></ol></li><li>A household.<style>bad css</style><script>bad()</script></li></ol><h4>Related terms</h4><ol><li>Not a definition</li></ol><h2>French</h2><h3>Noun</h3><ol><li>Wrong language</li></ol>';
const parsed = (title: string, html = esHtml) => ({ parse: { title, text: html, revid: 12345 } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('meaning spelling and parsing', () => {
  it('preserves accents, diaeresis and Ñ with case/whitespace/Unicode normalization', () => {
    expect(meaningWord('  ÁRBOL  ', 'es')).toBe('árbol');
    expect(meaningWord('NIN\u0303O', 'es')).toBe('niño');
    expect(meaningWord('PINGÜINO', 'es')).toBe('pingüino');
    expect(meaningWord(' HOUSE ', 'en')).toBe('house');
    expect(meaningWord('papá', 'es')).not.toBe(meaningWord('papa', 'es'));
  });
  it('extracts Spanish senses and categories, excluding examples, references and other languages', () => {
    expect(parseMeaningHtml(esHtml, 'es')).toEqual([
      { text: 'Un edificio para vivir.', category: 'Sustantivo femenino · Arquitectura' },
      { text: 'Una familia.', category: 'Sustantivo femenino' },
    ]);
  });
  it('extracts English senses without examples, nested lists, etymology or related terms', () => {
    expect(parseMeaningHtml(enHtml, 'en')).toEqual([{ text: 'A home.', category: 'Noun' }, { text: 'A household.', category: 'Noun' }]);
    expect(parseMeaningHtml(enHtml, 'es')).toEqual([]);
  });
  it('never executes remote content and decodes entities as plain text', () => {
    const html = '<h2>English</h2><h3>Noun</h3><ol><li>&lt;script&gt;alert(1)&lt;/script&gt; &amp; text<img src="https://example.com/tracker" onerror="window.hacked=true"></li></ol>';
    expect(parseMeaningHtml(html, 'en')[0].text).toBe('<script>alert(1)</script> & text');
    expect(document.querySelector('img')).toBeNull();
    expect('hacked' in window).toBe(false);
  });
  it('bounds and deduplicates senses and rejects oversized HTML', () => {
    const list = ['Same', 'Same', ...Array.from({ length: 20 }, (_, i) => `${i}${'a'.repeat(800)}`)];
    const senses = parseMeaningHtml(`<h2>English</h2><h3>Noun</h3><ol>${list.map((s) => `<li>${s}</li>`).join('')}</ol>`, 'en');
    expect(senses).toHaveLength(6);
    expect(senses[1].text).toHaveLength(600);
    expect(() => parseMeaningHtml('a'.repeat(3_000_001), 'es')).toThrow();
  });
  it('creates fixed-host attributed links', () => {
    expect(meaningSourceUrl('es', 'árbol')).toContain('%C3%A1rbol');
    expect(meaningSourceUrl('en', 'house', 123)).toBe('https://en.wiktionary.org/w/index.php?title=house&oldid=123');
  });
});

describe('definition provider', () => {
  it('uses the English provider without sending credentials or referrer', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(parsed('house', enHtml)));
    vi.stubGlobal('fetch', fetcher);
    const result = await fetchWordMeanings(' HOUSE ', 'en');
    expect(result.entries[0].senses[0].text).toBe('A home.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url.hostname).toBe('en.wiktionary.org');
    expect(url.searchParams.get('origin')).toBe('*');
    expect(options.credentials).toBe('omit');
    expect(options.referrerPolicy).toBe('no-referrer');
  });
  it('resolves an unaccented word to an exact tile-equivalent spelling', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 'missingtitle' } }))
      .mockResolvedValueOnce(response({ query: { search: [{ title: 'murciélago' }, { title: 'murciélagos' }] } }))
      .mockResolvedValueOnce(response(parsed('murciélago')));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchWordMeanings('murcielago', 'es')).entries[0].title).toBe('murciélago');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('retains papa and papá separately rather than silently substituting', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(parsed('papa')))
      .mockResolvedValueOnce(response({ query: { search: [{ title: 'papa' }, { title: 'papá' }] } }))
      .mockResolvedValueOnce(response(parsed('papá'))));
    expect((await fetchWordMeanings('papa', 'es')).entries.map((entry) => entry.title)).toEqual(['papa', 'papá']);
  });
  it('does not conflate N with Ñ or accept unrelated fuzzy matches', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 'missingtitle' } }))
      .mockResolvedValueOnce(response({ query: { search: [{ title: 'año' }, { title: 'anos' }] } }));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchWordMeanings('ano', 'es')).entries).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('never shows a different redirect target or a foreign-language-only definition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(parsed('other', enHtml))).mockResolvedValueOnce(response(parsed('house', esHtml))));
    expect((await fetchWordMeanings('house', 'en')).entries).toEqual([]);
    expect((await fetchWordMeanings('house', 'en')).entries).toEqual([]);
  });
  it('does not search variants when the reader explicitly supplied an accented spelling', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(parsed('papá')));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchWordMeanings('PAPÁ', 'es')).entries).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([{ error: { code: 'ratelimited' } }, {}, null, { parse: { text: 123 } }])('rejects provider failures/malformed responses instead of saying no definition', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));
    await expect(fetchWordMeanings('house', 'en')).rejects.toThrow();
  });
  it('preserves an exact definition if optional variant search fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(parsed('casa'))).mockResolvedValueOnce(response({}, 429)));
    expect((await fetchWordMeanings('casa', 'es')).entries).toHaveLength(1);
  });
  it('reports rate limiting with the server cooldown rather than automatically retrying', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', fetcher);
    const now = Date.now();
    const error = await fetchWordMeanings('house', 'en').catch((error) => error);
    expect(error).toBeInstanceOf(MeaningRateLimitError);
    expect(error.retryAt).toBeGreaterThanOrEqual(now + 120_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds requests for variant titles', async () => {
    const fetcher = vi.fn(async (url: URL) => response(url.searchParams.get('action') === 'query'
      ? { query: { search: ['pápa', 'papá', 'pápá', 'papa'].map((title) => ({ title })) } }
      : parsed(url.searchParams.get('page')!)));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchWordMeanings('papa', 'es')).entries).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('rejects invalid input and pre-aborted requests without fetching', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(fetchWordMeanings('bad word', 'en')).rejects.toThrow();
    await expect(fetchWordMeanings('house', 'en', AbortSignal.abort())).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('cancels requests after the total timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: URL, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const promise = expect(fetchWordMeanings('house', 'en')).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_001);
    await promise;
  });
});
