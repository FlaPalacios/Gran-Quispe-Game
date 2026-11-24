// Preferencias del jugador que valen para todas las partidas: silencio, música, siluetas, cómo
// se canta y las variantes de reglas elegidas en Configuración.
// Se guardan en localStorage y se leen desde memoria, para no ir al disco en cada redibujo.
import { loadSettings, saveSettings } from '../storage/localSave.js';

const DEFAULTS = Object.freeze({
  muted: false, // todo el sonido
  music: true, // solo la música de fondo
  voices: true, // los personajes dicen lo que se canta y sus frases
  silhouettes: false, // personajes de la mesa en sombra, sin detalle
  simpleKeypad: true, // cantar escribiendo el número, en vez de elegir de la lista completa
  variants: null, // variantes elegidas en Configuración; null usa las de por defecto
});

let cache = { ...DEFAULTS, ...loadSettings() };

export function getPreference(key) {
  return cache[key] ?? DEFAULTS[key];
}

export function setPreference(key, value) {
  cache = { ...cache, [key]: value };
  saveSettings(cache);
}
