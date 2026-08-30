'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createInitialScoreSheet,
  createScorePlayer,
  INITIAL_SCORE_ROUNDS,
  MAX_SCORE_PLAYERS,
  MAX_SCORE_ROUNDS,
  parseStoredScoreSheet,
  playerTotal,
  SCORE_SHEET_STORAGE_KEY,
  ScorePlayer,
} from '../lib/score-sheet';
import { TILE_DISTRIBUTIONS, totalTiles } from '../lib/tile-distributions';
import { Language } from '../lib/word-judge';

type ScoreSheetProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
};

export default function ScoreSheet({ language, onLanguageChange }: ScoreSheetProps) {
  const [rounds, setRounds] = useState(INITIAL_SCORE_ROUNDS);
  const [players, setPlayers] = useState<ScorePlayer[]>(() => createInitialScoreSheet().players);
  const [storageReady, setStorageReady] = useState(false);
  const totals = useMemo(() => players.map(playerTotal), [players]);
  const hasScores = players.some((player) => player.adjustment || player.scores.some(Boolean));
  const leadingScore = hasScores ? Math.max(...totals) : null;
  const tiles = TILE_DISTRIBUTIONS[language];

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = parseStoredScoreSheet(window.localStorage.getItem(SCORE_SHEET_STORAGE_KEY) ?? '');
        if (stored) {
          setRounds(stored.rounds);
          setPlayers(stored.players);
        }
      } catch {
        // The score sheet still works in memory when browser storage is unavailable.
      }
      setStorageReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(SCORE_SHEET_STORAGE_KEY, JSON.stringify({ version: 1, rounds, players }));
    } catch {
      // Keep scoring available even if local persistence is blocked.
    }
  }, [players, rounds, storageReady]);

  function updatePlayerName(playerId: string, name: string) {
    setPlayers((current) => current.map((player) => player.id === playerId ? { ...player, name } : player));
  }

  function updateScore(playerId: string, roundIndex: number, score: string) {
    setPlayers((current) => current.map((player) => {
      if (player.id !== playerId) return player;
      const scores = [...player.scores];
      scores[roundIndex] = score;
      return { ...player, scores };
    }));
  }

  function updateAdjustment(playerId: string, adjustment: string) {
    setPlayers((current) => current.map((player) => player.id === playerId ? { ...player, adjustment } : player));
  }

  function addPlayer() {
    if (players.length >= MAX_SCORE_PLAYERS) return;
    const nextNumber = Math.max(...players.map((player) => Number(player.id.replace('player-', '')) || 0), 0) + 1;
    setPlayers((current) => [...current, createScorePlayer(nextNumber, rounds)]);
  }

  function removePlayer(playerId: string) {
    if (players.length <= 2) return;
    const player = players.find((candidate) => candidate.id === playerId);
    if (!window.confirm(`¿Quieres eliminar a ${player?.name || 'este jugador'} y todos sus puntos?`)) return;
    setPlayers((current) => current.filter((player) => player.id !== playerId));
  }

  function addRound() {
    if (rounds >= MAX_SCORE_ROUNDS) return;
    setRounds((current) => current + 1);
    setPlayers((current) => current.map((player) => ({ ...player, scores: [...player.scores, ''] })));
  }

  function resetSheet() {
    if (!window.confirm('¿Quieres borrar todos los nombres y puntos de esta partida?')) return;
    const empty = createInitialScoreSheet();
    setRounds(empty.rounds);
    setPlayers(empty.players);
  }

  return (
    <section className="score-section" id="puntuacion" aria-labelledby="score-title">
      <div className="score-heading">
        <div>
          <p className="section-kicker">MARCADOR DE PARTIDA</p>
          <h2 id="score-title">Anota cada jugada. Nosotros hacemos la suma.</h2>
          <p>Registra de dos a cuatro jugadores, consulta los totales al instante y ten a mano el valor y la cantidad de cada ficha.</p>
        </div>
        <div className="score-actions">
          <button type="button" onClick={addPlayer} disabled={players.length >= MAX_SCORE_PLAYERS}>＋ Jugador</button>
          <button type="button" onClick={resetSheet}>Nueva partida</button>
        </div>
      </div>

      <div className="score-layout">
        <div className="scoreboard-card">
          <div className="score-totals" aria-label="Totales actuales" aria-live="polite">
            {players.map((player, index) => (
              <div className={leadingScore !== null && totals[index] === leadingScore ? 'leader' : ''} key={player.id}>
                <span>{player.name.trim() || `Jugador ${index + 1}`}</span>
                <strong>{totals[index]}</strong>
              </div>
            ))}
          </div>

          <div className="score-table-wrap">
            <table className="score-table" aria-label="Hoja de puntuación de la partida">
              <thead>
                <tr>
                  <th scope="col">Ronda</th>
                  {players.map((player, index) => (
                    <th scope="col" key={player.id}>
                      <div className="player-heading">
                        <input
                          type="text"
                          value={player.name}
                          onChange={(event) => updatePlayerName(player.id, event.target.value)}
                          maxLength={24}
                          aria-label={`Nombre del jugador ${index + 1}`}
                        />
                        {players.length > 2 && (
                          <button type="button" onClick={() => removePlayer(player.id)} aria-label={`Eliminar ${player.name || `jugador ${index + 1}`}`}>×</button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rounds }, (_, roundIndex) => (
                  <tr key={roundIndex}>
                    <th scope="row">{roundIndex + 1}</th>
                    {players.map((player, playerIndex) => (
                      <td key={player.id}>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={player.scores[roundIndex]}
                          onChange={(event) => updateScore(player.id, roundIndex, event.target.value)}
                          min="-999"
                          max="999"
                          placeholder="—"
                          aria-label={`Puntos de ${player.name || `jugador ${playerIndex + 1}`} en la ronda ${roundIndex + 1}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="adjustment-row">
                  <th scope="row">Ajuste final</th>
                  {players.map((player, index) => (
                    <td key={player.id}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={player.adjustment}
                        onChange={(event) => updateAdjustment(player.id, event.target.value)}
                        min="-999"
                        max="999"
                        placeholder="±0"
                        aria-label={`Ajuste final de ${player.name || `jugador ${index + 1}`}`}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="total-row">
                  <th scope="row">Total</th>
                  {totals.map((total, index) => <td key={players[index].id}>{total}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
          <button className="add-round-button" type="button" onClick={addRound} disabled={rounds >= MAX_SCORE_ROUNDS}>＋ Añadir ronda</button>
          <p className="score-hint">Guardado automáticamente en este dispositivo. El ajuste final admite valores positivos o negativos para fichas sobrantes y penalizaciones.</p>
        </div>

        <aside className="tile-reference" aria-labelledby="tiles-title">
          <div className="tile-reference-heading">
            <div>
              <p className="section-kicker">REFERENCIA RÁPIDA</p>
              <h3 id="tiles-title">Fichas · {totalTiles(language)} en total</h3>
            </div>
            <div className="tile-language-switch" aria-label="Idioma de las fichas">
              <button type="button" className={language === 'es' ? 'active' : ''} onClick={() => onLanguageChange('es')}>ES</button>
              <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onLanguageChange('en')}>EN</button>
            </div>
          </div>
          <div className="tile-legend"><span>× cantidad</span><span>valor ↘</span></div>
          <div className="tile-grid">
            {tiles.map((tile) => (
              <div className={`reference-tile ${tile.blank ? 'blank' : ''}`} key={tile.letter} aria-label={`${tile.blank ? language === 'es' ? 'Comodín' : 'Blank' : tile.letter}: ${tile.value} puntos, ${tile.count} fichas`}>
                <span className="tile-count">×{tile.count}</span>
                <strong>{tile.letter}</strong>
                <small>{tile.value}</small>
              </div>
            ))}
          </div>
          <p className="tile-note">En español, CH, LL y RR son fichas propias. La estrella representa el comodín de valor cero.</p>
          <div className="tile-sources">
            <a href="https://www.filexico.com/_files/ugd/86eae9_86712e8640ae41b79685810e006fd8ac.pdf" target="_blank" rel="noreferrer">Distribución FILE ↗</a>
            <a href="https://www.hasbro.com/common/instruct/scrabble.pdf" target="_blank" rel="noreferrer">Tile values Hasbro ↗</a>
          </div>
        </aside>
      </div>
    </section>
  );
}
