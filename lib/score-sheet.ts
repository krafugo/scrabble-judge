export const SCORE_SHEET_STORAGE_KEY = 'palabra-justa-score-sheet-v1';
export const INITIAL_SCORE_ROUNDS = 20;
export const MAX_SCORE_ROUNDS = 30;
export const MAX_SCORE_PLAYERS = 4;

export type ScorePlayer = {
  id: string;
  name: string;
  scores: string[];
  adjustment: string;
};

export type ScoreSheetData = {
  version: 1;
  rounds: number;
  players: ScorePlayer[];
};

function emptyScores(rounds: number): string[] {
  return Array.from({ length: rounds }, () => '');
}

export function createScorePlayer(number: number, rounds: number): ScorePlayer {
  return {
    id: `player-${number}`,
    name: `Jugador ${number}`,
    scores: emptyScores(rounds),
    adjustment: '',
  };
}

export function createInitialScoreSheet(): ScoreSheetData {
  return {
    version: 1,
    rounds: INITIAL_SCORE_ROUNDS,
    players: [createScorePlayer(1, INITIAL_SCORE_ROUNDS), createScorePlayer(2, INITIAL_SCORE_ROUNDS)],
  };
}

function numericScore(value: string): number {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

export function playerTotal(player: ScorePlayer): number {
  return player.scores.reduce((total, score) => total + numericScore(score), 0) + numericScore(player.adjustment);
}

export function parseStoredScoreSheet(value: string): ScoreSheetData | null {
  try {
    const candidate = JSON.parse(value) as Partial<ScoreSheetData>;
    if (candidate.version !== 1 || !Number.isInteger(candidate.rounds)) return null;
    const rounds = candidate.rounds as number;
    if (rounds < 1 || rounds > MAX_SCORE_ROUNDS || !Array.isArray(candidate.players)) return null;
    if (candidate.players.length < 2 || candidate.players.length > MAX_SCORE_PLAYERS) return null;

    const players = candidate.players.map((player) => {
      if (!player || typeof player !== 'object') throw new Error('Invalid player.');
      if (typeof player.id !== 'string' || typeof player.name !== 'string' || typeof player.adjustment !== 'string') {
        throw new Error('Invalid player fields.');
      }
      if (!Array.isArray(player.scores) || player.scores.length !== rounds || player.scores.some((score) => typeof score !== 'string')) {
        throw new Error('Invalid scores.');
      }
      return {
        id: player.id.slice(0, 80),
        name: player.name.slice(0, 24),
        scores: player.scores.map((score) => score.slice(0, 5)),
        adjustment: player.adjustment.slice(0, 5),
      };
    });

    if (new Set(players.map((player) => player.id)).size !== players.length) return null;
    return { version: 1, rounds, players };
  } catch {
    return null;
  }
}
