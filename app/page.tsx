'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { DEFAULT_LEXICON_URLS, loadDefaultLexicon } from '../lib/default-lexicons';
import { readStoredLexicon, removeStoredLexicon, saveStoredLexicon } from '../lib/lexicon-store';
import { RULES_CONTENT } from '../lib/rules-content';
import { compileLexicon, findWordsFromLetters, getInputError, getSpecialJudgeResult, hasWord, Language, looksLikeSpanishLexicon, normalizeWord, STARTER_LEXICONS } from '../lib/word-judge';

type ActiveLexicon = {
  text: string;
  count: number;
  name: string;
  source: 'default' | 'imported' | 'fallback';
  updatedAt?: string;
};

type JudgeResult = {
  kind: 'valid' | 'invalid' | 'error' | 'anagrams';
  normalized: string;
  message: string;
  specialMessage?: string;
  words?: string[];
} | null;

const LANGUAGE_LABELS: Record<Language, { short: string; name: string; input: string }> = {
  es: { short: 'ES', name: 'Español', input: 'Ej. murciélago' },
  en: { short: 'EN', name: 'English', input: 'E.g. beautiful' },
};

function fallbackLexicon(language: Language): ActiveLexicon {
  return {
    ...STARTER_LEXICONS[language],
    name: language === 'es' ? 'Vocabulario de respaldo en español' : 'English fallback vocabulary',
    source: 'fallback',
  };
}

async function bundledLexicon(language: Language, signal?: AbortSignal): Promise<ActiveLexicon> {
  return { ...(await loadDefaultLexicon(language, signal)), source: 'default' };
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('es');
  const [word, setWord] = useState('');
  const [rulesLanguage, setRulesLanguage] = useState<Language>('es');
  const [dictionary, setDictionary] = useState<ActiveLexicon | null>(null);
  const [result, setResult] = useState<JudgeResult>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [anagramMode, setAnagramMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secretSequenceRef = useRef({ count: 0, lastPress: 0 });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadLanguage() {
      try {
        const stored = await readStoredLexicon(language).catch(() => null);
        if (!active) return;
        if (stored) {
          setDictionary({
            text: stored.text,
            count: stored.count,
            name: stored.name,
            source: 'imported',
            updatedAt: stored.updatedAt,
          });
          return;
        }
        setDictionary(await bundledLexicon(language, controller.signal));
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setDictionary(fallbackLexicon(language));
        setImportMessage('No se pudo abrir el diccionario incluido. Se activó una lista de respaldo.');
      }
    }

    void loadLanguage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [language]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const serviceWorkerUrl = new URL('sw.js', document.baseURI);
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      const refreshOnUpdate = () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', refreshOnUpdate);
      navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
        .then(async (registration) => {
          await registration.update().catch(() => undefined);
          return navigator.serviceWorker.ready;
        })
        .then((registration) => {
          registration.active?.postMessage({ type: 'CACHE_URLS', urls: DEFAULT_LEXICON_URLS });
        })
        .catch(() => undefined);

      return () => navigator.serviceWorker.removeEventListener('controllerchange', refreshOnUpdate);
    }
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setManagerOpen(false);

      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLocaleLowerCase() !== 'h') {
        if (event.key !== 'Shift') secretSequenceRef.current.count = 0;
        return;
      }

      const now = Date.now();
      const sequence = secretSequenceRef.current;
      sequence.count = now - sequence.lastPress <= 1600 ? sequence.count + 1 : 1;
      sequence.lastPress = now;

      if (sequence.count === 5) {
        event.preventDefault();
        sequence.count = 0;
        setAnagramMode((active) => !active);
        setWord('');
        setResult(null);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  function toggleAnagramMode() {
    setAnagramMode((active) => !active);
    setWord('');
    setResult(null);
    secretSequenceRef.current.count = 0;
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function chooseLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    setDictionary(null);
    setLanguage(nextLanguage);
    setRulesLanguage(nextLanguage);
    setWord('');
    setResult(null);
    setImportMessage('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function judge(event: FormEvent) {
    event.preventDefault();

    const command = word.normalize('NFKC').trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
    if (command === 'hidden command') {
      toggleAnagramMode();
      return;
    }

    const normalized = normalizeWord(word, language);
    const inputError = getInputError(normalized, language);

    if (inputError) {
      setResult({ kind: 'error', normalized, message: inputError });
      return;
    }
    if (!dictionary) return;

    if (anagramMode) {
      const words = findWordsFromLetters(dictionary.text, normalized);
      setResult({
        kind: 'anagrams',
        normalized,
        words,
        message: words.length
          ? language === 'es'
            ? 'Cada resultado usa solo las letras disponibles, sin repetir ninguna más veces de las indicadas.'
            : 'Every result uses only the available letters, without repeating any more times than supplied.'
          : language === 'es'
            ? 'No se puede formar ninguna palabra del léxico activo con esas letras.'
            : 'No word in the active lexicon can be made from those letters.',
      });
      return;
    }

    const specialResult = getSpecialJudgeResult(normalized);
    const valid = specialResult?.forceInvalid ? false : hasWord(dictionary.text, normalized);
    setResult({
      kind: valid ? 'valid' : 'invalid',
      normalized,
      specialMessage: specialResult?.message,
      message: valid
        ? language === 'es'
          ? 'La palabra aparece en el léxico activo.'
          : 'This word appears in the active lexicon.'
        : language === 'es'
          ? 'La palabra no aparece en el léxico activo.'
          : 'This word does not appear in the active lexicon.',
    });
  }

  function clearWord() {
    setWord('');
    setResult(null);
    inputRef.current?.focus();
  }

  async function importLexicon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setImportMessage('El archivo supera el límite de 25 MB.');
      return;
    }

    setImporting(true);
    setImportMessage('Preparando el léxico…');
    try {
      const source = await file.text();
      if (language === 'en' && looksLikeSpanishLexicon(source, file.name)) {
        setImportMessage('Este archivo parece estar en español. Selecciona Español antes de importarlo.');
        return;
      }
      const compiled = compileLexicon(source, language);
      if (!compiled.count) {
        setImportMessage('No encontramos palabras válidas en ese archivo.');
        return;
      }

      const updatedAt = new Date().toISOString();
      await saveStoredLexicon({
        language,
        text: compiled.text,
        count: compiled.count,
        name: file.name,
        updatedAt,
      });
      setDictionary({ ...compiled, name: file.name, source: 'imported', updatedAt });
      setResult(null);
      setImportMessage(
        `${compiled.count.toLocaleString()} palabras listas${compiled.rejected ? ` · ${compiled.rejected.toLocaleString()} líneas omitidas` : ''}.`,
      );
    } catch {
      setImportMessage('No se pudo guardar el archivo. Comprueba que sea texto UTF-8.');
    } finally {
      setImporting(false);
    }
  }

  async function restoreDefault() {
    try {
      await removeStoredLexicon(language);
    } catch {
      // Restore the bundled list even when persistence is blocked.
    }
    setDictionary(null);
    try {
      setDictionary(await bundledLexicon(language));
      setImportMessage('Se restauró el diccionario predeterminado.');
    } catch {
      setDictionary(fallbackLexicon(language));
      setImportMessage('No se pudo abrir el diccionario incluido. Se activó una lista de respaldo.');
    }
    setResult(null);
  }

  const resultTitle = result?.kind === 'anagrams'
    ? result.words?.length
      ? language === 'es' ? `${result.words.length} RESULTADOS` : `${result.words.length} RESULTS`
      : language === 'es' ? 'SIN RESULTADOS' : 'NO RESULTS'
    : result?.kind === 'valid'
    ? language === 'es' ? 'VÁLIDA' : 'VALID'
    : result?.kind === 'invalid'
      ? language === 'es' ? 'INVÁLIDA' : 'INVALID'
      : language === 'es' ? 'REVISA LA PALABRA' : 'CHECK THE WORD';
  const rules = RULES_CONTENT[rulesLanguage];

  return (
    <main className={`page-shell ${anagramMode ? 'anagram-mode' : ''}`}>
      <nav className="topbar" aria-label="Navegación principal">
        <a className="brand" href="#inicio" aria-label="Palabra justa, inicio">
          <span className="brand-mark" aria-hidden="true">P<small>1</small></span>
          <span>Palabra justa</span>
        </a>
        <div className="nav-actions">
          <button className="about-button" type="button" onClick={() => document.getElementById('como-funciona')?.scrollIntoView()}>
            ¿Cómo funciona?
          </button>
          <button className="rules-button" type="button" onClick={() => document.getElementById('reglas')?.scrollIntoView()}>
            Reglas
          </button>
          <button className="manage-button" type="button" onClick={() => { setManagerOpen(true); setImportMessage(''); }}>
            <span aria-hidden="true">＋</span> Diccionarios
          </button>
        </div>
      </nav>

      <section className="hero" id="inicio">
        <div className="eyebrow"><span aria-hidden="true">●</span>{anagramMode ? (language === 'es' ? 'MODO ANAGRAMAS' : 'ANAGRAM MODE') : 'JUEZ DE PALABRAS'}</div>
        <h1>{anagramMode ? (language === 'es' ? '¿Qué palabras se pueden formar?' : 'Which words can you make?') : '¿Es una palabra válida?'}</h1>
        <p className="hero-copy">{anagramMode
          ? language === 'es'
            ? 'Encuentra todas las palabras válidas que puedes construir con tus letras.'
            : 'Find every valid word you can build from your letters.'
          : 'Comprueba palabras al instante. Sin conexión, sin esperas.'}</p>

        <div className="judge-card">
          <div className="language-switch" role="tablist" aria-label="Selecciona el idioma">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
              <button
                key={code}
                className={`language-option ${language === code ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={language === code}
                onClick={() => chooseLanguage(code)}
              >
                {LANGUAGE_LABELS[code].short} <span>{LANGUAGE_LABELS[code].name}</span>
              </button>
            ))}
          </div>

          <form onSubmit={judge}>
            {anagramMode && (
              <div className="secret-mode-banner" id="anagram-mode-note">
                <span aria-hidden="true">↻</span>
                <p><strong>{language === 'es' ? 'hidden command activo' : 'Orange mode active'}</strong><small>{language === 'es' ? 'Escribe H cinco veces o “hidden command” para salir.' : 'Type H five times or “hidden command” to exit.'}</small></p>
              </div>
            )}
            <label htmlFor="word">{anagramMode
              ? language === 'es' ? 'Escribe todas las letras' : 'Enter all letters'
              : language === 'es' ? 'Escribe una palabra' : 'Enter a word'}</label>
            <div className="input-row">
              <div className="input-wrap">
                <input
                  ref={inputRef}
                  id="word"
                  value={word}
                  onChange={(event) => { setWord(event.target.value); setResult(null); }}
                  placeholder={anagramMode ? (language === 'es' ? 'Ej. csaa' : 'E.g. stop') : LANGUAGE_LABELS[language].input}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  enterKeyHint="go"
                  maxLength={40}
                  aria-describedby={anagramMode ? 'anagram-mode-note dictionary-note' : 'dictionary-note'}
                  autoFocus
                />
                {word && <button className="clear-button" type="button" aria-label="Borrar palabra" onClick={clearWord}>×</button>}
              </div>
              <button className="check-button" type="submit" disabled={!dictionary}>
                {dictionary
                  ? anagramMode
                    ? language === 'es' ? 'Combinar' : 'Find words'
                    : language === 'es' ? 'Comprobar' : 'Check'
                  : 'Cargando…'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>

          {result && (
            <section className={`result-panel ${result.kind}`} role="status" aria-live="polite" aria-atomic="true">
              <span className="result-symbol" aria-hidden="true">{result.kind === 'valid' ? '✓' : result.kind === 'invalid' ? '×' : result.kind === 'anagrams' ? '↻' : '!'}</span>
              <div className="result-copy">
                <p className="result-kicker">{resultTitle}</p>
                {result.normalized && <strong>{result.normalized.toLocaleUpperCase(language)}</strong>}
                <p>{result.message}</p>
                {result.specialMessage && <p className="special-message">{result.specialMessage}</p>}
                {result.kind === 'anagrams' && Boolean(result.words?.length) && (
                  <ul className="anagram-list" aria-label={language === 'es' ? 'Anagramas encontrados' : 'Anagrams found'}>
                    {result.words?.map((anagram) => <li key={anagram}>{anagram.toLocaleUpperCase(language)}</li>)}
                  </ul>
                )}
              </div>
            </section>
          )}

          <div className="dictionary-note" id="dictionary-note">
            <span className={`source-dot ${dictionary?.source ?? ''}`} aria-hidden="true" />
            {dictionary ? (
              <span>
                {dictionary.name} · {dictionary.count.toLocaleString()} palabras
              </span>
            ) : <span>Cargando léxico local…</span>}
            <button type="button" onClick={() => setManagerOpen(true)}>Gestionar</button>
          </div>
          <p className="privacy-note"><span aria-hidden="true">✓</span> Tus consultas nunca salen de este dispositivo</p>
        </div>
      </section>

      <section className="trust-strip" aria-label="Características">
        <div><span className="feature-icon" aria-hidden="true">ϟ</span><p><strong>Instantáneo</strong><br />Búsqueda binaria optimizada</p></div>
        <div><span className="feature-icon" aria-hidden="true">⌁</span><p><strong>100% privado</strong><br />Funciona sin un servidor</p></div>
        <div><span className="feature-icon" aria-hidden="true">✓</span><p><strong>Listo para jugar</strong><br />En móvil y computadora</p></div>
      </section>

      <section className="how-section" id="como-funciona">
        <p className="section-kicker">SENCILLO Y TRANSPARENTE</p>
        <h2>Tu léxico, tus reglas</h2>
        <p className="section-intro">La app incluye diccionarios completos en español e inglés. También puedes importar el léxico autorizado de tu torneo: se ordena, se guarda y se consulta únicamente en este dispositivo.</p>
        <div className="steps-grid">
          <article><span>01</span><h3>Elige el idioma</h3><p>Alterna entre español e inglés sin mezclar sus reglas.</p></article>
          <article><span>02</span><h3>Escribe y comprueba</h3><p>Ignoramos mayúsculas y tildes; la Ñ se conserva correctamente.</p></article>
          <article><span>03</span><h3>Importa tu lista</h3><p>Añade un TXT oficial con una palabra por línea. No se sube a internet.</p></article>
        </div>
      </section>

      <section className="rules-section" id="reglas" aria-labelledby="rules-title">
        <div className="rules-heading">
          <div>
            <p className="section-kicker">{rules.eyebrow}</p>
            <h2 id="rules-title">{rules.title}</h2>
            <p>{rules.intro}</p>
          </div>
          <div className="rules-language-switch" role="tablist" aria-label="Idioma de las reglas / Rules language">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
              <button
                key={code}
                className={rulesLanguage === code ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={rulesLanguage === code}
                aria-controls="rules-content"
                onClick={() => setRulesLanguage(code)}
              >
                <span>{LANGUAGE_LABELS[code].short}</span>
                {LANGUAGE_LABELS[code].name}
              </button>
            ))}
          </div>
        </div>

        <div className="rules-content" id="rules-content" key={rulesLanguage}>
          <div className="rules-edition"><span aria-hidden="true">✓</span>{rules.edition}</div>

          <div className="rules-facts" aria-label={rulesLanguage === 'es' ? 'Datos esenciales' : 'Essential facts'}>
            {rules.facts.map((fact) => (
              <div key={fact.label}><strong>{fact.value}</strong><span>{fact.label}</span></div>
            ))}
          </div>

          <aside className="rules-corrections">
            <div className="correction-mark" aria-hidden="true">!</div>
            <div>
              <h3>{rules.correctionTitle}</h3>
              <ul>{rules.corrections.map((correction) => <li key={correction}>{correction}</li>)}</ul>
            </div>
          </aside>

          <div className="rules-list">
            {rules.sections.map((section, index) => (
              <details key={section.number} open={index === 0}>
                <summary>
                  <span className="rule-number">{section.number}</span>
                  <span className="rule-summary-copy"><strong>{section.title}</strong><small>{section.summary}</small></span>
                  <span className="rule-toggle" aria-hidden="true">＋</span>
                </summary>
                <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>
                {section.examples && (
                  <div className="word-examples">
                    <div className="word-examples-heading">
                      <h4>{section.examples.title}</h4>
                      <p>{section.examples.intro}</p>
                    </div>
                    <div className="word-category-grid">
                      {section.examples.groups.map((group) => (
                        <article className="word-category" key={group.title}>
                          <h5>{group.title}</h5>
                          <p>{group.explanation}</p>
                          <div className="example-list allowed">
                            <strong><span aria-hidden="true">✓</span>{section.examples?.allowedLabel}</strong>
                            {group.allowed.map((example) => (
                              <div className="word-example" key={example.word}>
                                <b>{example.word}</b>
                                <span>{example.note}</span>
                              </div>
                            ))}
                          </div>
                          <div className="example-list rejected">
                            <strong><span aria-hidden="true">×</span>{section.examples?.rejectedLabel}</strong>
                            {group.rejected.map((example) => (
                              <div className="word-example" key={example.word}>
                                <b>{example.word}</b>
                                <span>{example.note}</span>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </details>
            ))}
          </div>

          <div className="rules-sources">
            <div>
              <h3>{rules.sourceTitle}</h3>
              <p>{rules.sourceNote}</p>
            </div>
            <div className="source-links">
              {rules.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<span aria-hidden="true">↗</span></a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark" aria-hidden="true">P<small>1</small></span><span>Palabra justa</span></div>
        <p>Herramienta independiente. Usa siempre el léxico indicado por la organización de tu partida.</p>
      </footer>

      {managerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setManagerOpen(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="manager-title">
            <button className="modal-close" type="button" aria-label="Cerrar" onClick={() => setManagerOpen(false)}>×</button>
            <p className="section-kicker">LÉXICOS LOCALES</p>
            <h2 id="manager-title">Diccionario de {LANGUAGE_LABELS[language].name}</h2>
            <p className="modal-intro">Usa el diccionario incluido o importa la lista autorizada para tu torneo. El archivo no abandona tu dispositivo.</p>

            <div className="active-dictionary">
              <span className="file-glyph" aria-hidden="true">TXT</span>
              <div>
                <strong>{dictionary?.name ?? 'Cargando…'}</strong>
                <p>{dictionary?.count.toLocaleString() ?? '—'} palabras · {dictionary?.source === 'imported' ? 'Importado localmente' : dictionary?.source === 'default' ? 'Diccionario incluido' : 'Lista de respaldo'}</p>
              </div>
            </div>

            <label className={`import-button ${importing ? 'disabled' : ''}`}>
              <input type="file" accept=".txt,text/plain" onChange={importLexicon} disabled={importing} />
              <span aria-hidden="true">↑</span> {importing ? 'Importando…' : 'Importar archivo .TXT'}
            </label>
            {dictionary?.source === 'imported' && <button className="reset-button" type="button" onClick={restoreDefault}>Restaurar diccionario predeterminado</button>}
            {importMessage && <p className="import-message" role="status">{importMessage}</p>}

            <div className="format-box">
              <strong>Formato esperado</strong>
              <ul>
                <li>Texto UTF-8 (.txt), máximo 25 MB</li>
                <li>Una palabra por línea, de 2 a 15 fichas</li>
                <li>En español, CH, LL y RR cuentan como una ficha</li>
                <li>Se aceptan tildes; la Ñ se mantiene distinta de la N</li>
                <li>Líneas vacías y las que comienzan con # se ignoran</li>
              </ul>
            </div>
            <p className="license-note">Comprueba siempre qué lexicón exige la organización de tu partida o torneo.</p>
          </section>
        </div>
      )}
    </main>
  );
}
