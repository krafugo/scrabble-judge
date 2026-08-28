'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { readStoredLexicon, removeStoredLexicon, saveStoredLexicon } from '../lib/lexicon-store';
import { compileLexicon, getInputError, hasWord, Language, normalizeWord, STARTER_LEXICONS } from '../lib/word-judge';

type ActiveLexicon = {
  text: string;
  count: number;
  name: string;
  source: 'starter' | 'imported';
  updatedAt?: string;
};

type JudgeResult = {
  kind: 'valid' | 'invalid' | 'error';
  normalized: string;
  message: string;
} | null;

const LANGUAGE_LABELS: Record<Language, { short: string; name: string; input: string }> = {
  es: { short: 'ES', name: 'Español', input: 'Ej. murciélago' },
  en: { short: 'EN', name: 'English', input: 'E.g. beautiful' },
};

function starterLexicon(language: Language): ActiveLexicon {
  return {
    ...STARTER_LEXICONS[language],
    name: language === 'es' ? 'Vocabulario inicial en español' : 'English starter vocabulary',
    source: 'starter',
  };
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('es');
  const [word, setWord] = useState('');
  const [dictionary, setDictionary] = useState<ActiveLexicon | null>(() => starterLexicon('es'));
  const [result, setResult] = useState<JudgeResult>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadLanguage(nextLanguage: Language) {
    try {
      const stored = await readStoredLexicon(nextLanguage);
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
    } catch {
      // IndexedDB can be unavailable in private browsing; the bundled list remains usable.
    }
    setDictionary(starterLexicon(nextLanguage));
  }

  useEffect(() => {
    readStoredLexicon('es')
      .then((stored) => {
        if (stored) {
          setDictionary({ text: stored.text, count: stored.count, name: stored.name, source: 'imported', updatedAt: stored.updatedAt });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setManagerOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  function chooseLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    setDictionary(null);
    setLanguage(nextLanguage);
    void loadLanguage(nextLanguage);
    setWord('');
    setResult(null);
    setImportMessage('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function judge(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeWord(word, language);
    const inputError = getInputError(normalized, language);

    if (inputError) {
      setResult({ kind: 'error', normalized, message: inputError });
      return;
    }
    if (!dictionary) return;

    const valid = hasWord(dictionary.text, normalized);
    setResult({
      kind: valid ? 'valid' : 'invalid',
      normalized,
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
      const compiled = compileLexicon(await file.text(), language);
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

  async function restoreStarter() {
    try {
      await removeStoredLexicon(language);
    } catch {
      // Reset the in-memory list even when persistence is blocked.
    }
    setDictionary(starterLexicon(language));
    setResult(null);
    setImportMessage('Se restauró el vocabulario inicial.');
  }

  const resultTitle = result?.kind === 'valid'
    ? language === 'es' ? 'VÁLIDA' : 'VALID'
    : result?.kind === 'invalid'
      ? language === 'es' ? 'INVÁLIDA' : 'INVALID'
      : language === 'es' ? 'REVISA LA PALABRA' : 'CHECK THE WORD';

  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Navegación principal">
        <a className="brand" href="#inicio" aria-label="Palabra justa, inicio">
          <span className="brand-mark" aria-hidden="true">P<small>1</small></span>
          <span>Palabra justa</span>
        </a>
        <div className="nav-actions">
          <button className="about-button" type="button" onClick={() => document.getElementById('como-funciona')?.scrollIntoView()}>
            ¿Cómo funciona?
          </button>
          <button className="manage-button" type="button" onClick={() => { setManagerOpen(true); setImportMessage(''); }}>
            <span aria-hidden="true">＋</span> Diccionarios
          </button>
        </div>
      </nav>

      <section className="hero" id="inicio">
        <div className="eyebrow"><span aria-hidden="true">●</span> JUEZ DE PALABRAS</div>
        <h1>¿Es una palabra válida?</h1>
        <p className="hero-copy">Comprueba palabras al instante. Sin conexión, sin esperas.</p>

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
            <label htmlFor="word">{language === 'es' ? 'Escribe una palabra' : 'Enter a word'}</label>
            <div className="input-row">
              <div className="input-wrap">
                <input
                  ref={inputRef}
                  id="word"
                  value={word}
                  onChange={(event) => { setWord(event.target.value); setResult(null); }}
                  placeholder={LANGUAGE_LABELS[language].input}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  enterKeyHint="go"
                  maxLength={40}
                  aria-describedby="dictionary-note"
                  autoFocus
                />
                {word && <button className="clear-button" type="button" aria-label="Borrar palabra" onClick={clearWord}>×</button>}
              </div>
              <button className="check-button" type="submit" disabled={!dictionary}>
                {dictionary ? (language === 'es' ? 'Comprobar' : 'Check') : 'Cargando…'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>

          {result && (
            <section className={`result-panel ${result.kind}`} role="status" aria-live="polite" aria-atomic="true">
              <span className="result-symbol" aria-hidden="true">{result.kind === 'valid' ? '✓' : result.kind === 'invalid' ? '×' : '!'}</span>
              <div>
                <p className="result-kicker">{resultTitle}</p>
                {result.normalized && <strong>{result.normalized.toLocaleUpperCase(language)}</strong>}
                <p>{result.message}</p>
              </div>
            </section>
          )}

          <div className="dictionary-note" id="dictionary-note">
            <span className={`source-dot ${dictionary?.source ?? ''}`} aria-hidden="true" />
            {dictionary ? (
              <span>
                {dictionary.source === 'starter' ? 'Vocabulario inicial' : dictionary.name} · {dictionary.count.toLocaleString()} palabras
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
        <p className="section-intro">La app incluye vocabularios pequeños para probarla. Para arbitraje oficial, importa el archivo autorizado de tu torneo: se ordena, se guarda y se consulta únicamente en este dispositivo.</p>
        <div className="steps-grid">
          <article><span>01</span><h3>Elige el idioma</h3><p>Alterna entre español e inglés sin mezclar sus reglas.</p></article>
          <article><span>02</span><h3>Escribe y comprueba</h3><p>Ignoramos mayúsculas y tildes; la Ñ se conserva correctamente.</p></article>
          <article><span>03</span><h3>Importa tu lista</h3><p>Añade un TXT oficial con una palabra por línea. No se sube a internet.</p></article>
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
            <p className="modal-intro">Importa una lista autorizada para obtener resultados completos de torneo. El archivo no abandona tu dispositivo.</p>

            <div className="active-dictionary">
              <span className="file-glyph" aria-hidden="true">TXT</span>
              <div>
                <strong>{dictionary?.name ?? 'Cargando…'}</strong>
                <p>{dictionary?.count.toLocaleString() ?? '—'} palabras · {dictionary?.source === 'imported' ? 'Importado localmente' : 'Lista de demostración'}</p>
              </div>
            </div>

            <label className={`import-button ${importing ? 'disabled' : ''}`}>
              <input type="file" accept=".txt,text/plain" onChange={importLexicon} disabled={importing} />
              <span aria-hidden="true">↑</span> {importing ? 'Importando…' : 'Importar archivo .TXT'}
            </label>
            {dictionary?.source === 'imported' && <button className="reset-button" type="button" onClick={restoreStarter}>Restaurar vocabulario inicial</button>}
            {importMessage && <p className="import-message" role="status">{importMessage}</p>}

            <div className="format-box">
              <strong>Formato esperado</strong>
              <ul>
                <li>Texto UTF-8 (.txt), máximo 25 MB</li>
                <li>Una palabra por línea, de 2 a 15 letras</li>
                <li>Se aceptan tildes; la Ñ se mantiene distinta de la N</li>
                <li>Líneas vacías y las que comienzan con # se ignoran</li>
              </ul>
            </div>
            <p className="license-note">Las listas oficiales de Scrabble pueden estar protegidas por licencia y por eso no se redistribuyen con esta app.</p>
          </section>
        </div>
      )}
    </main>
  );
}
