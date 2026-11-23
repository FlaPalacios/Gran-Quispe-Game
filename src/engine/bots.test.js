import { describe, expect, it } from 'vitest';
import { PERSONALITIES, botAction } from './bots.js';
import { QUISPE, compareCalls, readDice } from './dice.js';
import { PHASES, applyAction, createGame } from './rules.js';

// rng con semilla (mulberry32): mismas partidas en cada corrida
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fixed = (value) => () => value;

const bots = (...personalities) =>
  personalities.map((personality, i) => ({ id: `b${i}`, name: `Bot ${i}`, isBot: true, personality }));

function newGame(players, config = {}) {
  return createGame({ config: { mode: 'classic', ...config }, players }, { rng: fixed(0) });
}
const roll = (state, dice) =>
  applyAction(state, { type: 'ROLL', playerId: state.currentPlayerId }, { rng: (() => { const v = dice.map((d) => (d - 1) / 6); return () => v.shift(); })() });

describe('botAction', () => {
  it('tira cuando le toca tirar, y no hace nada si no es un bot', () => {
    const s = newGame(bots('honest', 'bluffer'));
    expect(botAction(s, { rng: fixed(0.5) })).toEqual({ type: 'ROLL', playerId: 'b0' });
    const human = newGame([{ id: 'h', name: 'Ana' }, ...bots('honest')]);
    expect(botAction(human, { rng: fixed(0.5) })).toBeNull();
    // Con personalidad, juega por la persona (en línea, si se desconectó)
    expect(botAction(human, { rng: fixed(0.5), personality: 'honest' })).toEqual({ type: 'ROLL', playerId: 'h' });
  });

  it('sin ganas de mentir canta lo que sacó', () => {
    const s = roll(newGame(bots('honest', 'honest')), [5, 3]);
    expect(botAction(s, { rng: fixed(0.99) })).toEqual({ type: 'CALL', playerId: 'b0', value: 53 });
  });

  it('si lo que sacó no alcanza, miente por encima de la jugada anterior', () => {
    let s = roll(newGame(bots('honest', 'honest')), [6, 6]);
    s = applyAction(s, { type: 'CALL', playerId: 'b0', value: 160 });
    s = applyAction(s, { type: 'BELIEVE', playerId: 'b1' });
    s = roll(s, [3, 1]);
    const action = botAction(s, { rng: fixed(0) });
    expect(compareCalls(action.value, 160)).toBeGreaterThan(0);
    expect(action.value).toBe(QUISPE);
  });

  it('casi siempre desconfía de un Quispe', () => {
    let s = roll(newGame(bots('bluffer', 'bluffer')), [2, 1]);
    s = applyAction(s, { type: 'CALL', playerId: 'b0', value: QUISPE });
    expect(botAction(s, { rng: fixed(0.9) }).type).toBe('DOUBT');
  });

  it('el desconfiado desconfía más que el farolero ante la misma jugada', () => {
    const doubts = (personality) => {
      let s = roll(newGame([...bots('honest'), { id: 'x', name: 'X', isBot: true, personality }]), [5, 2]);
      s = applyAction(s, { type: 'CALL', playerId: 'b0', value: 52 });
      return [0.2, 0.4, 0.6].filter((r) => botAction(s, { rng: fixed(r) }).type === 'DOUBT').length;
    };
    expect(doubts('suspicious')).toBeGreaterThan(doubts('bluffer'));
  });

  it('partidas enteras solo de bots terminan siempre, sin acciones inválidas', () => {
    const names = Object.keys(PERSONALITIES);
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed);
      const players = bots(...Array.from({ length: 2 + (seed % 7) }, (_, i) => names[(seed + i) % names.length]));
      let s = createGame({ config: { mode: seed % 2 ? 'classic' : 'lives', lives: 2 }, players }, { rng });
      let steps = 0;
      while (s.phase !== PHASES.GAME_OVER) {
        const action = s.phase === PHASES.ROUND_OVER ? { type: 'NEXT_ROUND' } : botAction(s, { rng });
        s = applyAction(s, action, { rng });
        if (s.phase === PHASES.CALL) readDice(s.round.dice); // los dados siempre son válidos
        expect(++steps).toBeLessThan(5000);
      }
      expect(s.winnerId).toBeTruthy();
    }
  });
});
