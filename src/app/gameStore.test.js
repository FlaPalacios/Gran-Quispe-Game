import { describe, expect, it, vi } from 'vitest';
import { createGameStore, needsPassScreen, viewerCanSeeDice } from './gameStore.js';

const SETUP = {
  config: { mode: 'classic' },
  players: [
    { id: 'ana', name: 'Ana' },
    { id: 'beto', name: 'Beto' },
  ],
};

// Primer valor: abre 'ana'; luego los dados. Agotada la lista, devuelve 0
const sequence = (...values) => () => values.shift() ?? 0;

function newStore(...rngValues) {
  const save = vi.fn();
  const clear = vi.fn();
  const store = createGameStore({ rng: sequence(0, ...rngValues), save, clear });
  return { store, save, clear };
}

describe('gameStore', () => {
  it('crea la partida, la guarda y avisa a los suscritos', () => {
    const { store, save } = newStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.start(SETUP);
    expect(store.get().game.currentPlayerId).toBe('ana');
    expect(save).toHaveBeenCalledWith(store.get().game);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('pide pasar el celular cada vez que cambia el jugador en turno', () => {
    const { store } = newStore(0.5, 0.2);
    store.start(SETUP);
    expect(needsPassScreen(store.get())).toBe(true);
    store.confirmViewer('ana');
    expect(needsPassScreen(store.get())).toBe(false);

    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    expect(store.get().game.round.dice).toEqual([4, 2]);
    expect(needsPassScreen(store.get())).toBe(false); // sigue siendo el turno de Ana

    store.dispatch({ type: 'CALL', playerId: 'ana', value: 42 });
    expect(store.get().viewerId).toBeNull();
    expect(needsPassScreen(store.get())).toBe(true);

    store.confirmViewer('beto');
    store.dispatch({ type: 'BELIEVE', playerId: 'beto' });
    expect(needsPassScreen(store.get())).toBe(false); // vuelve a tirar sin pasar el celular
  });

  it('los dados se ven solo con el celular en manos de quien acaba de tirar', () => {
    const { store } = newStore(0.5, 0.2);
    store.start(SETUP);
    store.confirmViewer('ana');
    expect(viewerCanSeeDice(store.get())).toBe(false); // todavía no tira
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    expect(viewerCanSeeDice(store.get())).toBe(true);
    store.leave();
    expect(viewerCanSeeDice(store.get())).toBe(false);
  });

  it('jugando una sola persona contra bots no hay pantalla de pase', () => {
    const { store } = newStore();
    store.start({ config: { mode: 'classic' }, players: [{ id: 'ana', name: 'Ana' }, { id: 'b', name: 'Bot', isBot: true, personality: 'honest' }] });
    expect(store.get()).toMatchObject({ viewerId: 'ana' });
    expect(store.get().turnStartedAt).not.toBeNull();
    expect(needsPassScreen(store.get())).toBe(false);
  });

  it('las señales de la interfaz llegan a quien escucha y no tocan el estado', () => {
    const { store } = newStore();
    store.start(SETUP);
    const before = store.get();
    const heard = vi.fn();
    const stop = store.onSignal(heard);
    store.signal('cupShake');
    expect(heard).toHaveBeenCalledWith('cupShake');
    expect(store.get()).toEqual(before);
    stop();
    store.signal('cupShake');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('el turno empieza al confirmar el pase y se reinicia al cambiar de jugador o de partida', () => {
    let clock = 1000;
    const store = createGameStore({ rng: sequence(0, 0.5, 0.2), save: vi.fn(), clear: vi.fn(), now: () => clock });
    store.start(SETUP);
    expect(store.get().turnStartedAt).toBeNull();
    store.confirmViewer('ana');
    expect(store.get().turnStartedAt).toBe(1000);
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    store.dispatch({ type: 'CALL', playerId: 'ana', value: 42 });
    expect(store.get().turnStartedAt).toBeNull();
    clock = 5000;
    store.confirmViewer('beto');
    expect(store.get().turnStartedAt).toBe(5000);
    store.leave();
    expect(store.get().turnStartedAt).toBeNull();
  });

  it('el plazo para cantar empieza cuando caen los dados, no al recibir el celular', () => {
    let clock = 1000;
    const store = createGameStore({ rng: sequence(0, 0.5, 0.2), save: vi.fn(), clear: vi.fn(), now: () => clock });
    store.start(SETUP);
    store.confirmViewer('ana');
    expect(store.get().turnStartedAt).toBe(1000);
    // Lo que tarde en sacudir el cubilete no le come tiempo para cantar
    clock = 9000;
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    expect(store.get().turnStartedAt).toBe(9000);
  });

  describe('el suspenso del destape', () => {
    // Deja la partida con ana cantando 65 y beto a punto de decidir
    const aboutToDoubt = (revealMs) => {
      const store = createGameStore({ rng: sequence(0, 0.5, 0.2), save: vi.fn(), clear: vi.fn(), revealMs });
      store.start(SETUP);
      store.dispatch({ type: 'ROLL', playerId: 'ana' });
      store.dispatch({ type: 'CALL', playerId: 'ana', value: 65 });
      store.confirmViewer('beto');
      return store;
    };

    it('al desconfiar no se ve nada hasta que el cubilete termina de subir', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => 2000);
        store.dispatch({ type: 'DOUBT', playerId: 'beto' });
        expect(store.get().revealing).toBe(true);
        expect(viewerCanSeeDice(store.get())).toBe(false); // destapado para el motor, pero todavía no en pantalla
        vi.advanceTimersByTime(1999);
        expect(store.get().revealing).toBe(true);
        vi.advanceTimersByTime(1);
        expect(store.get().revealing).toBe(false);
        expect(viewerCanSeeDice(store.get())).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('avisa a los suscritos al empezar y al terminar el destape', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => 1000);
        const heard = [];
        store.subscribe(({ revealing }) => heard.push(revealing));
        store.dispatch({ type: 'DOUBT', playerId: 'beto' });
        expect(heard).toEqual([true]);
        vi.advanceTimersByTime(1000);
        expect(heard).toEqual([true, false]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('sin saber cuánto dura el sonido, espera su plazo de respaldo', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => null);
        store.dispatch({ type: 'DOUBT', playerId: 'beto' });
        vi.advanceTimersByTime(2199);
        expect(store.get().revealing).toBe(true);
        vi.advanceTimersByTime(1);
        expect(store.get().revealing).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('una Cholada sin destape no hace esperar a nadie', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => 2000);
        store.dispatch({ type: 'BELIEVE', playerId: 'beto' });
        store.dispatch({ type: 'ROLL', playerId: 'beto' });
        store.dispatch({ type: 'CALL', playerId: 'beto', value: 31 }); // más bajo: Cholada
        expect(store.get().game.round.result.revealed).toBe(false);
        expect(store.get().revealing).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('las tarjetas se publican como estaban antes de la ronda, sin tocar la aritmética', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => 2000);
        const antes = store.get().game.players;
        store.dispatch({ type: 'DOUBT', playerId: 'beto' });
        expect(store.get().playersBefore).toEqual(antes);
        expect(store.get().game.players).not.toEqual(antes); // el motor ya cobró el castigo
        vi.advanceTimersByTime(2000);
        expect(store.get().playersBefore).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('empezar otra partida corta el destape a medias', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => 2000);
        store.dispatch({ type: 'DOUBT', playerId: 'beto' });
        store.start(SETUP);
        expect(store.get().revealing).toBe(false);
        expect(store.get().playersBefore).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('salir al menú corta el destape a medias', () => {
      vi.useFakeTimers();
      try {
        const store = aboutToDoubt(() => 2000);
        store.dispatch({ type: 'DOUBT', playerId: 'beto' });
        store.leave();
        expect(store.get().revealing).toBe(false);
        // El aviso pendiente ya no dice nada de una partida que no existe
        const heard = vi.fn();
        store.subscribe(heard);
        vi.advanceTimersByTime(3000);
        expect(heard).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('no pide pase al terminar la ronda y borra el guardado al terminar la partida', () => {
    const { store, clear } = newStore(0.5, 0.2);
    store.start({ ...SETUP, config: { mode: 'lives', lives: 1 } });
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    store.dispatch({ type: 'CALL', playerId: 'ana', value: 65 });
    store.dispatch({ type: 'DOUBT', playerId: 'beto' });
    expect(store.get().game.phase).toBe('GAME_OVER');
    expect(needsPassScreen(store.get())).toBe(false);
    expect(clear).toHaveBeenCalled();
  });

  it('salir al menú conserva el guardado; abandonar lo borra', () => {
    const { store, clear } = newStore();
    store.start(SETUP);
    store.leave();
    expect(store.get().game).toBeNull();
    expect(clear).not.toHaveBeenCalled();
    store.start(SETUP);
    store.abandon();
    expect(clear).toHaveBeenCalled();
  });
});
