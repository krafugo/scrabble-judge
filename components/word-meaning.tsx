'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { readMeaningCache, saveMeaningCache } from '../lib/meaning-cache';
import { fetchWordMeanings, MEANING_LICENSE_URL, MeaningRateLimitError, meaningSourceUrl, type MeaningResult } from '../lib/word-meanings';
import type { Language } from '../lib/word-judge';

type State = { kind: 'idle' | 'loading' | 'missing' | 'offline' | 'error' } |
  { kind: 'rate-limited'; retryAt: number } |
  { kind: 'ready'; data: MeaningResult; saved: boolean; cached: boolean };

// Parent keys this component by spelling + language; unmount cancels old requests.
export default function WordMeaning({ word, language }: { word: string; language: Language }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [expanded, setExpanded] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const id = useId();
  const es = language === 'es';
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (state.kind !== 'rate-limited') return;
    const timer = setTimeout(() => setState({ kind: 'error' }), Math.min(2_147_483_647, Math.max(0, state.retryAt - Date.now())));
    return () => clearTimeout(timer);
  }, [state]);

  async function load(refresh = false) {
    setExpanded(true);
    requestRef.current?.abort();
    if (!refresh) {
      const cached = readMeaningCache(word, language);
      if (cached) {
        setState({ kind: 'ready', data: cached, saved: true, cached: true });
        return;
      }
    }
    if (!navigator.onLine) { setState({ kind: 'offline' }); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ kind: 'loading' });
    try {
      const data = await fetchWordMeanings(word, language, controller.signal);
      if (controller.signal.aborted) return;
      setState(data.entries.length ? { kind: 'ready', data, saved: saveMeaningCache(data), cached: false } : { kind: 'missing' });
    } catch (error) {
      if (!controller.signal.aborted) setState(error instanceof MeaningRateLimitError
        ? { kind: 'rate-limited', retryAt: error.retryAt }
        : { kind: navigator.onLine ? 'error' : 'offline' });
    }
  }

  function toggle() {
    if (expanded) { setExpanded(false); return; }
    if (state.kind === 'idle') void load();
    else setExpanded(true);
  }

  return (
    <section className="meaning-panel" aria-label={es ? `Significado de ${word}` : `Meaning of ${word}`}>
      <button className="meaning-toggle" type="button" aria-expanded={expanded} aria-controls={id} onClick={toggle}>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        {expanded ? (es ? 'Ocultar significado' : 'Hide meaning') : (es ? 'Ver significado' : 'Show meaning')}
      </button>
      <p className="meaning-privacy">{es
        ? 'Consulta opcional: se envía esta palabra a Wikcionario, salvo que ya esté guardada en este dispositivo.'
        : 'Optional lookup: sends this word to Wiktionary unless it is already saved on this device.'}</p>
      <div id={id} hidden={!expanded}>
        <p className="meaning-disclaimer">{es
          ? 'Las definiciones son informativas. La validez para jugar depende solo del léxico activo.'
          : 'Definitions are informational. Only the active lexicon determines whether a word is playable.'}</p>
        <div role="status" aria-live="polite" aria-busy={state.kind === 'loading'}>
          {state.kind === 'loading' && <p>{es ? 'Buscando significado…' : 'Looking up meaning…'}</p>}
          {state.kind === 'offline' && <p>{es ? 'Sin conexión. Esta definición aún no está guardada. La palabra sigue siendo válida.' : 'Offline. This definition has not been saved yet. The word is still valid.'}</p>}
          {state.kind === 'missing' && <p>{es ? 'No encontramos una definición para esta palabra en español. Esto no cambia su validez; puede ser una forma flexionada o una entrada que falta en Wikcionario.' : 'No English definition was found. This does not change its validity; it may be an inflected form or an entry missing from Wiktionary.'}</p>}
          {state.kind === 'error' && <p>{es ? 'No se pudo consultar el significado. Puedes reintentar; la validación local sigue funcionando.' : 'The meaning could not be loaded. Try again; local word validation still works.'}</p>}
          {state.kind === 'rate-limited' && <p>{es ? 'Wikcionario ha limitado temporalmente las consultas. Espera antes de reintentar; la palabra sigue siendo válida.' : 'Wiktionary has temporarily limited lookups. Please wait before retrying; the word is still valid.'}</p>}
          {state.kind === 'ready' && <>
            {es && state.data.entries.some((entry) => entry.title !== state.data.word) && <p className="meaning-spelling">En el tablero se omiten las tildes. Estas son grafías equivalentes para esas fichas; sus significados pueden ser distintos.</p>}
            {state.data.entries.map((entry) => <article className="meaning-entry" key={entry.title}>
              <h3 lang={language}>{entry.title}</h3>
              <ol lang={language}>{entry.senses.map((sense, index) => <li key={index}><span className="meaning-category">{sense.category}</span>{sense.text}</li>)}</ol>
              <p className="meaning-source">
                {es ? 'Selección de acepciones adaptada de ' : 'Selected senses adapted from '}
                <a href={meaningSourceUrl(language, entry.title, entry.revision)} target="_blank" rel="noopener noreferrer">{es ? 'Wikcionario y sus colaboradores' : 'Wiktionary and its contributors'}</a>
                {' · '}<a href={MEANING_LICENSE_URL} target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
                {' · '}<a href={meaningSourceUrl(language, entry.title)} target="_blank" rel="noopener noreferrer">{es ? 'Entrada completa ↗' : 'Full entry ↗'}</a>
              </p>
            </article>)}
            <p className="meaning-storage">{state.saved
              ? (es ? 'Guardado en este dispositivo para consultar sin conexión.' : 'Saved on this device for offline reading.')
              : (es ? 'No se pudo guardar para uso sin conexión.' : 'Could not save for offline reading.')}
              {' '}{es ? 'Consultado: ' : 'Retrieved: '}{new Date(state.data.fetchedAt).toLocaleDateString(language)}
              {state.cached && (es ? ' · Copia local' : ' · Local copy')}
            </p>
          </>}
        </div>
        {state.kind !== 'loading' && state.kind !== 'idle' && <div className="meaning-actions">
          <button type="button" disabled={state.kind === 'rate-limited'} onClick={() => void load(true)}>{state.kind === 'ready' ? (es ? 'Actualizar en línea' : 'Refresh online') : (es ? 'Reintentar' : 'Try again')}</button>
          {state.kind !== 'ready' && <a href={meaningSourceUrl(language, word)} target="_blank" rel="noopener noreferrer">{es ? 'Abrir Wikcionario ↗' : 'Open Wiktionary ↗'}</a>}
        </div>}
      </div>
    </section>
  );
}

export function AnagramMeanings({ words, language }: { words: string[]; language: Language }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <div className="anagram-meanings">
    <p className="meaning-hint">{language === 'es' ? 'Selecciona una palabra para consultar su significado.' : 'Select a word to look up its meaning.'}</p>
    <ul className="anagram-list" aria-label={language === 'es' ? 'Anagramas encontrados' : 'Anagrams found'}>
      {words.map((word) => <li key={word}><button type="button" aria-pressed={word === selected} onClick={() => setSelected(word)}>{word.toLocaleUpperCase(language)}</button></li>)}
    </ul>
    {selected && <WordMeaning key={`${language}:${selected}`} word={selected} language={language} />}
  </div>;
}
