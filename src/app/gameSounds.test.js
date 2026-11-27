import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../engine/rules.js';
import { connectGameSounds, momentSounds } from './gameSounds.js';
import { hushMusic, playSfx, playVoice, setMusicOverride } from './audio.js';

// El audio de verdad necesita navegador: aquí solo interesa qué se pide y cuándo. Todo efecto
// dura 500 ms y toda frase, 1 s.
vi.mock('./audio.js', () => ({
  playSfx: vi.fn(),
  playVoice: vi.fn(),
  preloadVoices: vi.fn(),
  setMusicOverride: vi.fn(),
  hushMusic: vi.fn(),
  sfxDuration: () => 500,
  voiceDuration: () => 1000,
}));

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

  it('el final de ronda no suena aquí: suena con los mensajes (momentSounds)', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    store.emit({ game: called });
    playSfx.mockClear();
    playVoice.mockClear();
    store.emit({ game: over, revealing: true });
    store.emit({ game: over, revealing: false });
    expect(sounds()).toEqual([]);
    expect(voices()).toEqual([[1, 'desconfio']]);
  });

  it('la cumbia del ganador se apaga al salir de la partida terminada', () => {
    store.emit({ game: newGame() });
    expect(setMusicOverride).toHaveBeenLastCalledWith(null);
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

    it('en el modo castigo solo cantan las jugadas', () => {
      const called = act(roll(newGame({ mode: 'penalty', penaltyText: 'Un trago' }), 'ana', [3, 1]), 'CALL', 'ana', 65);
      store.emit({ game: roll(newGame({ mode: 'penalty', penaltyText: 'Un trago' }), 'ana', [3, 1]) });
      store.emit({ game: called });
      store.emit({ game: act(called, 'BELIEVE', 'beto') });
      store.emit({ game: called });
      store.emit({ game: act(called, 'DOUBT', 'beto'), revealing: true });
      expect(voices()).toEqual([[0, '65']]);
    });
  });
});

describe('momentSounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  const doubted = (dice, config) => act(act(roll(newGame(config), 'ana', dice), 'CALL', 'ana', 65), 'DOUBT', 'beto');

  it('el efecto entra con el título y la frase espera a que termine', () => {
    const moment = momentSounds(doubted([3, 1]));
    // 500 del efecto + 150 de respiro + 1000 de la frase
    expect(moment.headline()).toBe(1650);
    expect(sounds()).toEqual(['caught']);
    vi.advanceTimersByTime(649);
    expect(voices()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(voices()).toEqual([[1, 'pille']]);
  });

  it('"te equivocaste" va turnando sus dos grabaciones', () => {
    momentSounds(doubted([6, 5])).headline();
    momentSounds(doubted([6, 5])).headline();
    expect(new Set(sounds())).toEqual(new Set(['wrongDoubt', 'wrongDoubtSlap']));
  });

  it('el golpe suena cuando cae sobre el corazón, y pasar de mensaje cancela lo pendiente', () => {
    const moment = momentSounds(doubted([3, 1], { mode: 'lives', lives: 3 }));
    moment.headline();
    expect(moment.loss(700)).toBe(1200);
    vi.advanceTimersByTime(2000);
    expect(sounds()).toEqual(['caught', 'lossHit']);
    expect(voices()).toEqual([]); // la frase se canceló al pasar al mensaje del golpe
  });

  it('en el modo castigo suena "¡Tomaaas!" con la música callada, y nadie dice su frase', () => {
    const moment = momentSounds(doubted([3, 1], { mode: 'penalty', penaltyText: 'Un trago' }));
    expect(moment.headline()).toBe(500);
    moment.loss(700);
    vi.advanceTimersByTime(700);
    expect(sounds()).toEqual(['caught', 'penalty']);
    expect(hushMusic).toHaveBeenCalledWith(500);
    vi.advanceTimersByTime(2000);
    expect(voices()).toEqual([]);
  });

  it('al ganar entra la cumbia y después la cerveza, aunque se cierre el mensaje', () => {
    const start = createGame({ config: { mode: 'lives', lives: 1 }, players: PLAYERS.slice(0, 2) }, { rng: rngFrom(0) });
    const won = act(act(roll(start, 'ana', [3, 1]), 'CALL', 'ana', 65), 'DOUBT', 'beto');
    const moment = momentSounds(won);
    moment.loss(0);
    vi.advanceTimersByTime(0);
    expect(sounds()).toEqual(['eliminated']);
    moment.win();
    moment.stop();
    expect(setMusicOverride).toHaveBeenCalledWith('winner');
    vi.advanceTimersByTime(1000);
    expect(sounds()).toEqual(['eliminated', 'cheer']);
  });
});
