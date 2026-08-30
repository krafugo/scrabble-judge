import { describe, expect, it } from 'vitest';
import {
  createInitialScoreSheet,
  parseStoredScoreSheet,
  playerTotal,
  ScorePlayer,
} from './score-sheet';

describe('score sheet', () => {
  it('starts with two players and twenty empty rounds', () => {
    const sheet = createInitialScoreSheet();
    expect(sheet.rounds).toBe(20);
    expect(sheet.players).toHaveLength(2);
    expect(sheet.players.every((player) => player.scores.length === 20)).toBe(true);
  });

  it('calculates turn points and final adjustments continuously', () => {
    const player: ScorePlayer = {
      id: 'player-1',
      name: 'Ariel',
      scores: ['12', '', '35', '-10'],
      adjustment: '-7',
    };
    expect(playerTotal(player)).toBe(30);
  });

  it('restores valid local drafts and rejects malformed data', () => {
    const sheet = createInitialScoreSheet();
    sheet.players[0].name = 'María';
    sheet.players[0].scores[0] = '24';

    expect(parseStoredScoreSheet(JSON.stringify(sheet))).toEqual(sheet);
    expect(parseStoredScoreSheet('{broken')).toBeNull();
    expect(parseStoredScoreSheet(JSON.stringify({ ...sheet, rounds: 99 }))).toBeNull();
    expect(parseStoredScoreSheet(JSON.stringify({ ...sheet, players: [sheet.players[0]] }))).toBeNull();
  });
});
