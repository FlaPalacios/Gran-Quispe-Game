import { describe, expect, it } from 'vitest';
import { SAVE_TTL_MS, clearSave, loadGame, saveGame } from './localSave.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    size: () => data.size,
  };
}

const STATE = {
  phase: 'ROLL',
  players: [{ id: 'ana', letters: 2 }],
  config: { mode: 'classic', variants: {} },
  round: { number: 1, calls: [] },
};

describe('localSave', () => {
  it('guarda y recupera la partida', () => {
    const storage = memoryStorage();
    saveGame(STATE, { storage, now: 1000 });
    expect(loadGame({ storage, now: 2000 })).toEqual(STATE);
  });

  it('la partida expira pasada una hora y se borra', () => {
    const storage = memoryStorage();
    saveGame(STATE, { storage, now: 0 });
    expect(loadGame({ storage, now: SAVE_TTL_MS })).toEqual(STATE);
    expect(loadGame({ storage, now: SAVE_TTL_MS + 1 })).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it('cada guardado renueva la hora', () => {
    const storage = memoryStorage();
    saveGame(STATE, { storage, now: 0 });
    saveGame(STATE, { storage, now: SAVE_TTL_MS });
    expect(loadGame({ storage, now: SAVE_TTL_MS * 1.5 })).toEqual(STATE);
  });

  it('devuelve null si no hay nada, si el JSON está roto o si la versión cambió', () => {
    const storage = memoryStorage();
    expect(loadGame({ storage, now: 0 })).toBeNull();
    storage.setItem('gran-quispe:partida', '{roto');
    expect(loadGame({ storage, now: 0 })).toBeNull();
    storage.setItem('gran-quispe:partida', JSON.stringify({ version: 0, savedAt: 0, state: STATE }));
    expect(loadGame({ storage, now: 0 })).toBeNull();
  });

  it('descarta y borra un guardado con forma inválida', () => {
    const storage = memoryStorage();
    saveGame({ phase: 'ROLL', players: [] }, { storage, now: 0 }); // le falta config.variants y round
    expect(loadGame({ storage, now: 0 })).toBeNull();
    expect(storage.size()).toBe(0);
  });

  it('no falla si el almacenamiento no está disponible', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(() => saveGame(STATE, { storage: broken })).not.toThrow();
    expect(loadGame({ storage: broken })).toBeNull();
    expect(() => clearSave({ storage: broken })).not.toThrow();
    expect(loadGame({ storage: null })).toBeNull();
  });

  it('clearSave borra la partida', () => {
    const storage = memoryStorage();
    saveGame(STATE, { storage, now: 0 });
    clearSave({ storage });
    expect(loadGame({ storage, now: 0 })).toBeNull();
  });
});
