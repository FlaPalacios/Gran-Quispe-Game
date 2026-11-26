import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine/rules.js';
import { momentViewer, roundMoment } from './moment.js';

const dieValue = (d) => (d - 1) / 6;
const rngFrom = (...values) => () => values.shift() ?? 0;
const PLAYERS = [
  { id: 'ana', name: 'Ana' },
  { id: 'beto', name: 'Beto' },
  { id: 'cata', name: 'Cata' },
];
// Abre siempre 'ana'
const newGame = (config = {}, players = PLAYERS) =>
  createGame({ config: { mode: 'classic', ...config }, players }, { rng: rngFrom(0) });
const roll = (state, playerId, dice) =>
  applyAction(state, { type: 'ROLL', playerId }, { rng: rngFrom(dieValue(dice[0]), dieValue(dice[1])) });
const act = (state, type, playerId, value) => applyAction(state, { type, playerId, value });

// Ana canta 65 con 3 y 1 (miente) y Beto desconfía
const caught = (config) => act(act(roll(newGame(config), 'ana', [3, 1]), 'CALL', 'ana', 65), 'DOUBT', 'beto');

describe('roundMoment', () => {
  it('sin ronda resuelta no hay momento', () => {
    expect(roundMoment(newGame(), 'ana')).toBe(null);
  });

  it('pillar a un mentiroso se cuenta distinto a cada uno', () => {
    const game = caught();
    expect(roundMoment(game, 'beto').headline).toMatchObject({ key: 'moment.caught.you', params: { name: 'Ana' } });
    expect(roundMoment(game, 'ana').headline).toMatchObject({ key: 'moment.caught.self', params: { name: 'Beto' } });
    expect(roundMoment(game, 'cata').headline).toMatchObject({ key: 'moment.caught.other', params: { name: 'Ana', by: 'Beto' } });
    expect(roundMoment(game, null).headline.key).toBe('moment.caught.other');
  });

  it('si decía la verdad, el que desconfió se equivocó', () => {
    const game = act(act(roll(newGame(), 'ana', [6, 5]), 'CALL', 'ana', 65), 'DOUBT', 'beto');
    expect(roundMoment(game, 'beto').headline).toMatchObject({ key: 'moment.truth.self', params: { name: 'Ana' } });
    expect(roundMoment(game, 'ana').headline).toMatchObject({ key: 'moment.truth.you', params: { by: 'Beto' } });
    expect(roundMoment(game, 'cata').headline.key).toBe('moment.truth.other');
  });

  it('la tarjeta de quien perdió lleva lo que tenía antes y lo que le queda', () => {
    const letters = roundMoment(caught(), null).loss;
    expect(letters).toMatchObject({ playerId: 'ana', lives: false, before: 0, after: 1, eliminated: false });
    const lives = roundMoment(caught({ mode: 'lives', lives: 3 }), 'ana').loss;
    expect(lives).toMatchObject({ lives: true, before: 3, after: 2, self: true });
  });

  it('si el costo choca con el tope, solo se anima lo que de verdad perdió', () => {
    // Con 1 vida, desconfía de un Quispe verdadero: pierde 2 pero solo le quedaba 1
    const start = newGame({ mode: 'lives', lives: 1 });
    const quispe = act(act(roll(start, 'ana', [2, 1]), 'CALL', 'ana', 21), 'DOUBT', 'beto');
    expect(roundMoment(quispe, null).loss).toMatchObject({ playerId: 'beto', before: 1, after: 0 });
  });

  it('quedar fuera y ganar la partida se cuentan después', () => {
    const out = roundMoment(caught({ mode: 'lives', lives: 1 }), 'cata');
    expect(out.loss).toMatchObject({ eliminated: true, before: 1, after: 0 });
    expect(out.win).toBe(null);
    const duel = act(act(roll(newGame({ mode: 'lives', lives: 1 }, PLAYERS.slice(0, 2)), 'ana', [3, 1]), 'CALL', 'ana', 65), 'DOUBT', 'beto');
    expect(roundMoment(duel, 'beto').win).toMatchObject({ name: 'Beto', self: true });
    expect(roundMoment(duel, 'ana').win).toMatchObject({ name: 'Beto', self: false });
  });

  it('Cholada y creer un Quispe', () => {
    let s = act(roll(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 62);
    s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31);
    expect(roundMoment(s, 'beto').headline.key).toBe('moment.cholada.self');
    expect(roundMoment(s, 'ana').headline).toMatchObject({ key: 'moment.cholada.other', params: { name: 'Beto' } });
    const quispe = act(act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 21), 'BELIEVE', 'beto');
    expect(roundMoment(quispe, 'cata').headline.key).toBe('moment.believedQuispe.other');
  });
});

describe('momentViewer', () => {
  const game = newGame();
  it('en línea mira el dueño del celular; en un celular compartido, todos', () => {
    expect(momentViewer({ game, viewerId: 'beto', online: true })).toBe('beto');
    expect(momentViewer({ game, viewerId: 'beto', online: false })).toBe(null);
  });

  it('con una sola persona y bots, esa persona', () => {
    const solo = newGame({}, [PLAYERS[0], { id: 'b1', name: 'Bot', isBot: true, personality: 'honest' }]);
    expect(momentViewer({ game: solo, viewerId: null, online: false })).toBe('ana');
  });
});
