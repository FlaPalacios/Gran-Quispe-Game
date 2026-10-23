import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine/rules.js';
import { roundReaction } from './reaction.js';

// rng que devuelve los valores en orden; para un dado d se usa (d - 1) / 6
const dieValue = (d) => (d - 1) / 6;
const rngFrom = (...values) => () => values.shift() ?? 0;

const PLAYERS = [
  { id: 'ana', name: 'Ana' },
  { id: 'beto', name: 'Beto' },
  { id: 'cata', name: 'Cata' },
];

// Abre siempre 'ana'
function newGame(config = {}, players = PLAYERS) {
  return createGame({ config: { mode: 'classic', ...config }, players }, { rng: rngFrom(0) });
}

const roll = (state, playerId, dice) =>
  applyAction(state, { type: 'ROLL', playerId }, { rng: rngFrom(dieValue(dice[0]), dieValue(dice[1])) });
const act = (state, type, playerId, value) => applyAction(state, { type, playerId, value });

describe('roundReaction', () => {
  it('no hay reacción mientras la ronda sigue en juego', () => {
    expect(roundReaction(null)).toBe(null);
    const game = newGame();
    expect(roundReaction(game)).toBe(null);
    expect(roundReaction(act(roll(game, 'ana', [4, 2]), 'CALL', 'ana', 42))).toBe(null);
  });

  it('al pillar a un mentiroso se queda él, avergonzado', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    expect(roundReaction(act(called, 'DOUBT', 'beto'))).toEqual({
      playerId: 'ana',
      pose: 'caught',
      sound: 'caught',
    });
  });

  it('si quien desconfió se equivocó, se queda quien cantó, riéndose', () => {
    const called = act(roll(newGame(), 'ana', [6, 5]), 'CALL', 'ana', 42);
    expect(roundReaction(act(called, 'DOUBT', 'beto'))).toEqual({
      playerId: 'ana',
      pose: 'gloating',
      sound: 'loss',
    });
  });

  it('en una Cholada se queda el perdedor y no hay remate: ya sonó la Cholada', () => {
    const called = act(roll(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 62);
    const cholada = act(roll(act(called, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 54);
    expect(roundReaction(cholada)).toEqual({ playerId: 'beto', pose: 'caught', sound: null });
  });

  it('quedar eliminado manda sobre el resultado de la ronda', () => {
    const start = newGame({ mode: 'lives', lives: 1 });
    const called = act(roll(start, 'ana', [3, 1]), 'CALL', 'ana', 65);
    const out = act(called, 'DOUBT', 'beto');
    expect(roundReaction(out)).toEqual({ playerId: 'ana', pose: 'caught', sound: 'eliminated' });
  });

  it('ganar la partida manda sobre todo: se queda el ganador, riéndose', () => {
    const start = newGame({ mode: 'lives', lives: 1 }, PLAYERS.slice(0, 2));
    const called = act(roll(start, 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    expect(over.winnerId).toBe('beto');
    expect(roundReaction(over)).toEqual({ playerId: 'beto', pose: 'gloating', sound: 'win' });
  });
});
