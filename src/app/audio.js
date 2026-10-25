// Efectos de sonido de la interfaz y de la mesa.
// Vive fuera del motor de reglas y fuera de Phaser, porque lo usan tanto la UI (HTML) como las escenas.
import { getPreference, setPreference } from './preferences.js';

// Claves en inglés (código), archivos en español (convención de src/assets/).
// Los archivos vienen con volúmenes muy distintos de origen: aquí se emparejan de oído.
// Lo frecuente suena bajo (el clic, el brindis) y lo que cierra una ronda, fuerte.
export const SFX = Object.freeze({
  shake: { file: 'sfx-agitar-cubilete', volume: 0.8 },
  thud: { file: 'sfx-golpe-cubilete', volume: 0.7 },
  reveal: { file: 'sfx-destapar', volume: 0.9 },
  cholada: { file: 'sfx-cholada', volume: 1 },
  click: { file: 'sfx-boton', volume: 0.35 },
  start: { file: 'sfx-empezar', volume: 1 },
  believe: { file: 'sfx-creo', volume: 0.5 },
  loss: { file: 'sfx-pierde-ronda', volume: 0.8 },
  eliminated: { file: 'sfx-eliminado', volume: 0.7 },
  win: { file: 'sfx-gana-partida', volume: 0.8 },
  // El brindis acompaña a otro sonido (la risa o el remate de ganar): va por debajo
  cheer: { file: 'sfx-cerveza-ganar', volume: 0.55 },
  laughMan: { file: 'sfx-risa-hombre', volume: 0.8 },
  laughMan2: { file: 'sfx-risa-hombre-2', volume: 0.9 },
  laughGranny: { file: 'sfx-risa-abuela', volume: 1 },
});

const files = import.meta.glob('../assets/audio/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' });

// Safari no reproduce OGG; el resto sí y pesa menos. Los archivos son Vorbis u Opus
// según de dónde salieron, así que se pregunta por el contenedor y no por un codec.
function preferredExtension() {
  if (typeof Audio !== 'function') return null;
  try {
    return new Audio().canPlayType('audio/ogg') ? 'ogg' : 'mp3';
  } catch {
    return 'mp3';
  }
}

const extension = preferredExtension();
const sources = new Map();

// Un elemento por sonido que sirve de plantilla: al reproducir se clona, así se pueden solapar
export function preloadSfx() {
  if (!extension || sources.size) return;
  for (const { file } of Object.values(SFX)) {
    // Si falta la versión preferida se usa el MP3, que lee cualquier navegador
    const url = files[`../assets/audio/${file}.${extension}`] ?? files[`../assets/audio/${file}.mp3`];
    if (!url) continue;
    const audio = new Audio(url);
    audio.preload = 'auto';
    sources.set(file, audio);
  }
}

export function playSfx(key) {
  if (isMuted() || !extension) return;
  preloadSfx();
  const sfx = SFX[key];
  const template = sfx && sources.get(sfx.file);
  if (!template) return;
  try {
    const sound = template.cloneNode();
    sound.volume = sfx.volume;
    // Los móviles permiten pocos decodificadores a la vez: al terminar, el clon suelta el suyo
    sound.addEventListener(
      'ended',
      () => {
        sound.removeAttribute('src');
        sound.load();
      },
      { once: true },
    );
    // El navegador puede rechazar el audio hasta el primer toque del usuario: no es un error
    sound.play().catch(() => {});
  } catch {
    // Sin audio disponible, el juego sigue igual
  }
}

export const isMuted = () => getPreference('muted');

export const setMuted = (value) => setPreference('muted', value);
