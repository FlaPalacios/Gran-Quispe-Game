import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../engine/rules.js';
import { connectGameSounds } from './gameSounds.js';
import { playSfx, playVoice } from './audio.js';

// El audio de verdad necesita navegador: aquí solo interesa qué se pide y cuándo
vi.mock('./audio.js', () => ({ playSfx: vi.fn(), playVoice: vi.fn(), preloadVoices: vi.fn() }));

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
// Las voces: [personaje, clave]. Ana, Beto y Cata son los personajes 0, 1 y 2
const voices = () => playVoice.mock.calls;

describe('connectGameSounds', () => {
  let store;
  let disconnect;

  beforeEach(() => {
    playSfx.mockClear();
    playVoice.mockClear();
    store = fakeStore();
    disconnect = connectGameSounds(store);
  });

  afterEach(() => disconnect());

  it('la cerveza suena al empezar una partida, no al continuar una guardada', () => {
    store.signal('gameStart');
    expect(sounds()).toEqual(['start']);
  });

  it('mientras se destapa no suena nada: el remate espera', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    store.emit({ game: called });
    playSfx.mockClear();
    store.emit({ game: act(called, 'DOUBT', 'beto'), revealing: true });
    expect(sounds()).toEqual([]);
  });

  it('al terminar el destape no suena ninguna risa: habla quien pilló al mentiroso', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    store.emit({ game: called });
    store.emit({ game: over, revealing: true });
    playSfx.mockClear();
    playVoice.mockClear();
    store.emit({ game: over, revealing: false });
    expect(sounds()).toEqual([]);
    expect(voices()).toEqual([[1, 'pille']]);
  });

  it('una Cholada no tiene efecto: la dice el personaje, y se cancela si la partida sigue', () => {
    vi.useFakeTimers();
    try {
      let s = act(roll(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 62);
      store.emit({ game: s });
      s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31); // más bajo
      playSfx.mockClear();
      playVoice.mockClear();
      store.emit({ game: s });
      vi.advanceTimersByTime(500);
      expect(sounds()).toEqual([]);
      expect(voices()).toEqual([[1, 'cholada']]);

      playVoice.mockClear();
      store.emit({ game: s });
      store.emit({ game: act(s, 'NEXT_ROUND') });
      vi.advanceTimersByTime(1000);
      expect(voices()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('si la Cholada deja a alguien fuera, suena solo el de quedar fuera', () => {
    vi.useFakeTimers();
    try {
      const start = createGame({ config: { mode: 'lives', lives: 1 }, players: PLAYERS }, { rng: rngFrom(0) });
      let s = act(roll(start, 'ana', [4, 2]), 'CALL', 'ana', 62);
      store.emit({ game: s });
      playSfx.mockClear();
      playVoice.mockClear();
      s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31);
      store.emit({ game: s });
      vi.advanceTimersByTime(500);
      expect(sounds()).toEqual(['eliminated']);
      expect(voices().filter(([, key]) => key !== '62' && key !== 'creo')).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creer un Quispe no suena a Cholada: lo lamenta quien creyó', () => {
    vi.useFakeTimers();
    try {
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 21);
      store.emit({ game: called });
      playSfx.mockClear();
      playVoice.mockClear();
      store.emit({ game: act(called, 'BELIEVE', 'beto') });
      vi.advanceTimersByTime(500);
      expect(sounds()).toEqual([]);
      expect(voices()).toEqual([[1, 'pierdo']]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('al ganar la partida suena solo el brindis', () => {
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
    expect(sounds()).toEqual(['cheer']);
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

  describe('voces de los personajes', () => {
    it('al cantar, el personaje dice la jugada; el Quispe, con su nombre', () => {
      const rolled = roll(newGame(), 'ana', [4, 2]);
      store.emit({ game: rolled });
      store.emit({ game: act(rolled, 'CALL', 'ana', 42) });
      const quispe = roll(newGame(), 'ana', [2, 1]);
      store.emit({ game: quispe });
      store.emit({ game: act(quispe, 'CALL', 'ana', 21) });
      expect(voices()).toEqual([
        [0, '42'],
        [0, 'quispe'],
      ]);
    });

    it('quien cree y quien desconfía lo dicen', () => {
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
      store.emit({ game: called });
      playVoice.mockClear();
      store.emit({ game: act(called, 'BELIEVE', 'beto') });
      store.emit({ game: called });
      store.emit({ game: act(called, 'DOUBT', 'beto'), revealing: true });
      expect(voices()).toEqual([
        [1, 'creo'],
        [1, 'desconfio'],
      ]);
    });
  });
});
