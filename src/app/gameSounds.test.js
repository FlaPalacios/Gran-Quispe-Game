import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../engine/rules.js';
import { connectGameSounds } from './gameSounds.js';
import { playSfx } from './audio.js';

// El audio de verdad necesita navegador: aquí solo interesa qué se pide y cuándo
vi.mock('./audio.js', () => ({ playSfx: vi.fn() }));

const LAUGHS = ['laughMan', 'laughMan2', 'laughGranny'];
const dieValue = (d) => (d - 1) / 6;
const rngFrom = (...values) => () => values.shift() ?? 0;

const PLAYERS = [
  { id: 'ana', name: 'Ana' },
  { id: 'beto', name: 'Beto' },
  { id: 'cata', name: 'Cata' },
];

// Abre siempre 'ana'
const newGame = (config = {}) => createGame({ config: { mode: 'classic', ...config }, players: PLAYERS }, { rng: rngFrom(0) });
const roll = (state, playerId, dice) =>
  applyAction(state, { type: 'ROLL', playerId }, { rng: rngFrom(dieValue(dice[0]), dieValue(dice[1])) });
const act = (state, type, playerId, value) => applyAction(state, { type, playerId, value });

// Store de mentira: solo hace falta que avise a quien escucha
function fakeStore() {
  const listeners = new Set();
  const signalListeners = new Set();
  let snapshot = { game: null, revealing: false };
  return {
    get: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onSignal(fn) {
      signalListeners.add(fn);
      return () => signalListeners.delete(fn);
    },
    signal: (name) => signalListeners.forEach((fn) => fn(name)),
    emit(next) {
      snapshot = { revealing: false, ...next };
      listeners.forEach((fn) => fn(snapshot));
    },
  };
}

const sounds = () => playSfx.mock.calls.map(([key]) => key);

describe('connectGameSounds', () => {
  let store;
  let disconnect;

  beforeEach(() => {
    playSfx.mockClear();
    store = fakeStore();
    disconnect = connectGameSounds(store);
  });

  afterEach(() => disconnect());

  it('la cerveza suena al empezar una partida, no al continuar una guardada', () => {
    store.signal('gameStart');
    expect(sounds()).toEqual(['start']);
  });

  it('mientras se destapa solo suena el cubilete levantándose', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    store.emit({ game: called });
    playSfx.mockClear();
    store.emit({ game: act(called, 'DOUBT', 'beto'), revealing: true });
    expect(sounds()).toEqual(['reveal']);
  });

  it('el remate entra recién cuando termina el destape', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    store.emit({ game: called });
    store.emit({ game: over, revealing: true });
    playSfx.mockClear();
    store.emit({ game: over, revealing: false });
    // Pillaron mintiendo a ana: una risa al azar, y nada más
    expect(sounds()).toHaveLength(1);
    expect(LAUGHS).toContain(sounds()[0]);
  });

  it('una Cholada sin destape suena al momento, sin esperar', () => {
    vi.useFakeTimers();
    try {
      let s = act(roll(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 62);
      store.emit({ game: s });
      playSfx.mockClear();
      s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31); // más bajo
      store.emit({ game: s });
      // La Cholada es su propio remate: no espera nada ni suma otro sonido
      expect(sounds()).toEqual(['cholada']);
      vi.advanceTimersByTime(1000);
      expect(sounds()).toEqual(['cholada']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('si la Cholada deja a alguien fuera, el remate entra después del golpe', () => {
    vi.useFakeTimers();
    try {
      const start = createGame(
        { config: { mode: 'lives', lives: 1 }, players: PLAYERS },
        { rng: rngFrom(0) },
      );
      let s = act(roll(start, 'ana', [4, 2]), 'CALL', 'ana', 62);
      store.emit({ game: s });
      playSfx.mockClear();
      s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31);
      store.emit({ game: s });
      expect(sounds()).toEqual(['cholada']);
      vi.advanceTimersByTime(500);
      expect(sounds()).toEqual(['cholada', 'eliminated']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creer un Quispe no suena a Cholada: solo la risa', () => {
    vi.useFakeTimers();
    try {
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 21);
      store.emit({ game: called });
      playSfx.mockClear();
      store.emit({ game: act(called, 'BELIEVE', 'beto') });
      expect(sounds()).toEqual([]);
      vi.advanceTimersByTime(500);
      expect(sounds()).toHaveLength(1);
      expect(LAUGHS).toContain(sounds()[0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('las risas se van turnando: dos derrotas seguidas no repiten', () => {
    const perder = (dice, call) => {
      const called = act(roll(newGame(), 'ana', dice), 'CALL', 'ana', call);
      const over = act(called, 'DOUBT', 'beto');
      store.emit({ game: called });
      store.emit({ game: over, revealing: true });
      store.emit({ game: over, revealing: false });
    };
    playSfx.mockClear();
    perder([3, 1], 65); // pillan a ana mintiendo
    perder([6, 5], 65); // ana cantó lo que tenía: pierde beto
    // Entre medias suena el destape: aquí solo interesan las risas
    const risas = sounds().filter((key) => LAUGHS.includes(key));
    expect(risas).toHaveLength(2);
    expect(risas[1]).not.toBe(risas[0]);
  });

  it('al ganar la partida suenan el remate y el brindis a la vez', () => {
    const start = createGame(
      { config: { mode: 'lives', lives: 1 }, players: PLAYERS.slice(0, 2) },
      { rng: rngFrom(0) },
    );
    const called = act(roll(start, 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    store.emit({ game: called });
    store.emit({ game: over, revealing: true });
    playSfx.mockClear();
    store.emit({ game: over, revealing: false });
    expect(sounds()).toEqual(['win', 'cheer']);
  });

  it('cada sacudida suena, pero no más rápido que el propio sonido', () => {
    vi.useFakeTimers();
    try {
      store.signal('cupShake');
      store.signal('cupShake'); // encima de la anterior: no se reinicia
      expect(sounds()).toEqual(['shake']);
      vi.advanceTimersByTime(600);
      store.signal('cupShake');
      expect(sounds()).toEqual(['shake', 'shake']);
    } finally {
      vi.useRealTimers();
    }
  });
});
