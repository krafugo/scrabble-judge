'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import ScoreSheet from '../components/score-sheet';
import WordMeaning, { AnagramMeanings } from '../components/word-meaning';
import { clearMeaningCache } from '../lib/meaning-cache';
import { DEFAULT_LEXICON_URLS, loadDefaultLexicon } from '../lib/default-lexicons';
import { readStoredLexicon, removeStoredLexicon, saveStoredLexicon } from '../lib/lexicon-store';
import { RULES_CONTENT } from '../lib/rules-content';
import { resolveSecretAction } from '../lib/secret-actions';
import { compileLexicon, findWordsFromLetters, getInputError, hasWord, Language, looksLikeSpanishLexicon, normalizeWord } from '../lib/word-judge';

type ActiveLexicon = {
  text: string;
  count: number;
  name: string;
  source: 'default' | 'imported';
  updatedAt?: string;
};

type JudgeResult = {
  kind: 'valid' | 'invalid' | 'error' | 'anagrams';
  normalized: string;
  message: string;
  lookupWord?: string;
  specialMessage?: string;
  words?: string[];
} | null;

const LANGUAGE_LABELS: Record<Language, { short: string; name: string; input: string }> = {
  es: { short: 'ES', name: 'Español', input: 'Ej. murciélago' },
  en: { short: 'EN', name: 'English', input: 'E.g. beautiful' },
};

const DICTIONARY_LOAD_ERROR = 'No se pudo cargar el diccionario completo. Vuelve a intentarlo o importa un archivo .TXT.';

async function bundledLexicon(language: Language, signal?: AbortSignal): Promise<ActiveLexicon> {
  return { ...(await loadDefaultLexicon(language, signal)), source: 'default' };
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('es');
  const [word, setWord] = useState('');
  const [rulesLanguage, setRulesLanguage] = useState<Language>('es');
  const [dictionary, setDictionary] = useState<ActiveLexicon | null>(null);
  const [dictionaryError, setDictionaryError] = useState('');
  const [result, setResult] = useState<JudgeResult>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [anagramMode, setAnagramMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secretSequenceRef = useRef({ count: 0, lastPress: 0 });
  const judgmentRevision = useRef(0);
  const resetResult = useCallback(() => {
    judgmentRevision.current += 1;
    setResult(null);
  }, []);

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
          setDictionaryError('');
          return;
        }
        const included = await bundledLexicon(language, controller.signal);
        if (!active) return;
        setDictionary(included);
        setDictionaryError('');
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setDictionary(null);
        setDictionaryError(DICTIONARY_LOAD_ERROR);
        setImportMessage(DICTIONARY_LOAD_ERROR);
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
        resetResult();
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [resetResult]);

  function toggleAnagramMode() {
    setAnagramMode((active) => !active);
    setWord('');
    resetResult();
    secretSequenceRef.current.count = 0;
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function chooseLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    setDictionary(null);
    setDictionaryError('');
    setLanguage(nextLanguage);
    setRulesLanguage(nextLanguage);
    setWord('');
    resetResult();
    setImportMessage('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function judge(event: FormEvent) {
    event.preventDefault();
    const revision = ++judgmentRevision.current;
    const normalized = normalizeWord(word, language);
    const secretAction = await resolveSecretAction(normalized.replace(/\s+/g, ' '));
    if (revision !== judgmentRevision.current) return;
    if (secretAction?.type === 'toggle-anagrams') {
      toggleAnagramMode();
      return;
    }

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

    const specialResult = secretAction?.type === 'judge-message' ? secretAction : null;
    const valid = specialResult?.forceInvalid ? false : hasWord(dictionary.text, normalized);
    setResult({
      kind: valid ? 'valid' : 'invalid',
      normalized,
      lookupWord: word,
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
    resetResult();
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
      setDictionaryError('');
      resetResult();
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
    await loadBundledDictionary('Se restauró el diccionario predeterminado.');
  }

  async function retryDefault() {
    await loadBundledDictionary('El diccionario completo está listo.');
  }

  async function loadBundledDictionary(successMessage: string) {
    setDictionary(null);
    setDictionaryError('');
    setImportMessage('Cargando el diccionario completo…');
    try {
      setDictionary(await bundledLexicon(language));
      setDictionaryError('');
      setImportMessage(successMessage);
    } catch {
      setDictionary(null);
      setDictionaryError(DICTIONARY_LOAD_ERROR);
      setImportMessage(DICTIONARY_LOAD_ERROR);
    }
    resetResult();
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
          <button className="score-button" type="button" onClick={() => document.getElementById('puntuacion')?.scrollIntoView()}>
            Puntos
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
                <p><strong>{language === 'es' ? 'Modo secreto activo' : 'Secret mode active'}</strong><small>{language === 'es' ? 'Escribe H cinco veces o repite el comando secreto para salir.' : 'Type H five times or repeat the secret command to exit.'}</small></p>
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
                  onChange={(event) => { setWord(event.target.value); resetResult(); }}
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
                  : dictionaryError ? 'Sin diccionario' : 'Cargando…'} <span aria-hidden="true">→</span>
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
              </div>
            </section>
          )}

          {result?.kind === 'valid' && <WordMeaning key={`${language}:${result.lookupWord}`} word={result.lookupWord ?? result.normalized} language={language} />}
          {result?.kind === 'anagrams' && Boolean(result.words?.length) && (
            <AnagramMeanings key={`${language}:${result.normalized}`} words={result.words!} language={language} />
          )}

          <div className="dictionary-note" id="dictionary-note" role="status" aria-live="polite">
            <span className={`source-dot ${dictionary?.source ?? (dictionaryError ? 'error' : '')}`} aria-hidden="true" />
            {dictionary ? (
              <span>
                {dictionary.name} · {dictionary.count.toLocaleString()} palabras
              </span>
            ) : dictionaryError ? <span>Diccionario completo no disponible.</span> : <span>Cargando léxico local…</span>}
            {dictionaryError && <button type="button" onClick={retryDefault}>Reintentar</button>}
            <button type="button" onClick={() => setManagerOpen(true)}>Gestionar</button>
          </div>
          <p className="privacy-note"><span aria-hidden="true">✓</span> {language === 'es' ? 'Validación privada y sin conexión. Los significados solo se consultan si los solicitas.' : 'Private, offline validation. Meanings are only looked up when you request them.'}</p>
        </div>
      </section>

      <section className="trust-strip" aria-label="Características">
        <div><span className="feature-icon" aria-hidden="true">ϟ</span><p><strong>Instantáneo</strong><br />Búsqueda binaria optimizada</p></div>
        <div><span className="feature-icon" aria-hidden="true">⌁</span><p><strong>Validación privada</strong><br />Significados en línea opcionales</p></div>
        <div><span className="feature-icon" aria-hidden="true">✓</span><p><strong>Listo para jugar</strong><br />En móvil y computadora</p></div>
      </section>

      <ScoreSheet language={language} onLanguageChange={chooseLanguage} />

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
                <strong>{dictionary?.name ?? (dictionaryError ? 'Diccionario completo no disponible' : 'Cargando…')}</strong>
                {dictionary
                  ? <p>{dictionary.count.toLocaleString()} palabras · {dictionary.source === 'imported' ? 'Importado localmente' : 'Diccionario incluido'}</p>
                  : <p>{dictionaryError ? 'La validación queda desactivada hasta cargarlo o importar un TXT.' : 'Preparando el léxico local…'}</p>}
              </div>
            </div>

            {dictionaryError && <button className="retry-button" type="button" onClick={retryDefault}>Volver a intentar la carga</button>}
            <label className={`import-button ${importing ? 'disabled' : ''}`}>
              <input type="file" accept=".txt,text/plain" onChange={importLexicon} disabled={importing} />
              <span aria-hidden="true">↑</span> {importing ? 'Importando…' : 'Importar archivo .TXT'}
            </label>
            {dictionary?.source === 'imported' && <button className="reset-button" type="button" onClick={restoreDefault}>Restaurar diccionario predeterminado</button>}
            <button className="reset-button" type="button" onClick={() => setImportMessage(clearMeaningCache()
              ? 'Se borraron los significados guardados. Los léxicos no han cambiado.'
              : 'No se pudo acceder al almacenamiento de significados.')}>
              Borrar significados guardados
            </button>
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
