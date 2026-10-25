// Preferencias del jugador que no son reglas del juego: silencio, siluetas y cómo se canta.
// Se guardan en localStorage y se leen desde memoria, para no ir al disco en cada redibujo.
import { loadSettings, saveSettings } from '../storage/localSave.js';

const DEFAULTS = Object.freeze({
  muted: false,
  silhouettes: false, // personajes de la mesa en sombra, sin detalle
  simpleKeypad: true, // cantar escribiendo el número, en vez de elegir de la lista completa
});

let cache = { ...DEFAULTS, ...loadSettings() };

export function getPreference(key) {
  return cache[key] ?? DEFAULTS[key];
}

export function setPreference(key, value) {
  cache = { ...cache, [key]: value };
  saveSettings(cache);
}
