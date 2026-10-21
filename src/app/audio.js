// Efectos de sonido de la interfaz y de la mesa.
// Vive fuera del motor de reglas y fuera de Phaser, porque lo usan tanto la UI (HTML) como las escenas.
import { getPreference, setPreference } from './preferences.js';

// Claves en inglés (código), archivos en español (convención de src/assets/)
export const SFX = Object.freeze({
  shake: 'sfx-agitar-cubilete',
  thud: 'sfx-golpe-cubilete',
  reveal: 'sfx-destapar',
  cholada: 'sfx-cholada',
  click: 'sfx-boton',
});

const VOLUME = { shake: 0.8, thud: 0.7, reveal: 0.8, cholada: 0.9, click: 0.35 };

const files = import.meta.glob('../assets/audio/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' });

// Safari no reproduce OGG; el resto sí y pesa menos
function preferredExtension() {
  if (typeof Audio !== 'function') return null;
  try {
    return new Audio().canPlayType('audio/ogg; codecs=vorbis') ? 'ogg' : 'mp3';
  } catch {
    return 'mp3';
  }
}

const extension = preferredExtension();
const sources = new Map();

// Un elemento por sonido que sirve de plantilla: al reproducir se clona, así se pueden solapar
export function preloadSfx() {
  if (!extension || sources.size) return;
  for (const name of Object.values(SFX)) {
    const url = files[`../assets/audio/${name}.${extension}`];
    if (!url) continue;
    const audio = new Audio(url);
    audio.preload = 'auto';
    sources.set(name, audio);
  }
}

export function playSfx(key) {
  if (isMuted() || !extension) return;
  preloadSfx();
  const template = sources.get(SFX[key]);
  if (!template) return;
  try {
    const sound = template.cloneNode();
    sound.volume = VOLUME[key] ?? 1;
    // Los móviles permiten pocos decodificadores a la vez: cada clon se suelta al terminar
    sound.addEventListener('ended', () => sound.remove(), { once: true });
    // El navegador puede rechazar el audio hasta el primer toque del usuario: no es un error
    sound.play().catch(() => {});
  } catch {
    // Sin audio disponible, el juego sigue igual
  }
}

export const isMuted = () => getPreference('muted');

export const setMuted = (value) => setPreference('muted', value);
