// Guardado local de la partida en curso, con marca de tiempo y expiración.
// Única pieza del proyecto que toca localStorage.

const KEY = 'gran-quispe:partida';
// Preferencias del jugador (silencio). No expiran, a diferencia de la partida.
const SETTINGS_KEY = 'gran-quispe:ajustes';
// Subir si cambia la forma del estado: las partidas viejas se descartan en vez de romper el juego
const VERSION = 2;
export const SAVE_TTL_MS = 60 * 60 * 1000;

// localStorage puede no existir o lanzar (modo privado, almacenamiento bloqueado)
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveGame(state, { storage = defaultStorage(), now = Date.now() } = {}) {
  try {
    storage?.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: now, state }));
  } catch {
    // Sin guardado no se pierde la partida en curso; solo no sobrevive a una recarga
  }
}

export function loadGame({ storage = defaultStorage(), now = Date.now() } = {}) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const { version, savedAt, state } = JSON.parse(raw);
    if (version !== VERSION || !(now - savedAt <= SAVE_TTL_MS) || !looksLikeGame(state)) {
      storage.removeItem(KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function loadSettings({ storage = defaultStorage() } = {}) {
  try {
    const parsed = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings, { storage = defaultStorage() } = {}) {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sin guardado, la preferencia dura solo esta sesión
  }
}

// Revisión mínima de forma: un guardado corrupto se descarta en vez de trabar el juego
function looksLikeGame(state) {
  return (
    typeof state?.phase === 'string' &&
    Array.isArray(state.players) &&
    typeof state.config?.variants === 'object' &&
    typeof state.round === 'object'
  );
}

export function clearSave({ storage = defaultStorage() } = {}) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // nada que limpiar
  }
}
