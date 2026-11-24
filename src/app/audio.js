// Efectos de sonido de la interfaz y de la mesa.
// Vive fuera del motor de reglas y fuera de Phaser, porque lo usan tanto la UI (HTML) como
// las escenas.
//
// Suena por Web Audio: un elemento <audio> tarda hasta medio segundo en arrancar en el
// celular, y aquí el sonido tiene que caer junto con el golpe del cubilete. Los archivos se
// decodifican una vez y cada toque es un nodo nuevo, que arranca al instante. Si el navegador
// no trae Web Audio, se usan elementos <audio> como antes.
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
  eliminated: { file: 'sfx-eliminado', volume: 0.7 },
  win: { file: 'sfx-gana-partida', volume: 0.8 },
  // El brindis acompaña al remate de ganar: va por debajo
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
// Si falta la versión preferida se usa el MP3, que lee cualquier navegador
const urlOf = (file) => files[`../assets/audio/${file}.${extension}`] ?? files[`../assets/audio/${file}.mp3`];

const WebAudio = typeof window === 'undefined' ? null : (window.AudioContext ?? window.webkitAudioContext);
let context = null;
let loaded = false;
const buffers = new Map(); // archivo → sonido ya decodificado
const elements = new Map(); // archivo → <audio> de respaldo

// Se llama en el primer toque del usuario: hasta entonces el navegador no deja sonar nada,
// ni siquiera crear el contexto de audio con permiso para arrancar.
export function preloadSfx() {
  if (!extension || loaded) return;
  loaded = true;
  if (WebAudio) decodeAll();
  else for (const { file } of Object.values(SFX)) element(file);
}

function decodeAll() {
  try {
    context = new WebAudio();
  } catch {
    // Sin contexto se usan los <audio>, pero preparados desde ya y no en mitad de la partida
    for (const { file } of Object.values(SFX)) element(file);
    return;
  }
  for (const { file } of Object.values(SFX)) {
    const url = urlOf(file);
    if (!url || buffers.has(file)) continue;
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => buffers.set(file, buffer))
      .catch(() => {}); // sin ese efecto, el juego sigue igual
  }
}

// Plantilla por sonido: al reproducir se clona, así se pueden solapar
function element(file) {
  if (elements.has(file)) return elements.get(file);
  const url = urlOf(file);
  if (!url) return null;
  const audio = new Audio(url);
  audio.preload = 'auto';
  elements.set(file, audio);
  return audio;
}

export function playSfx(key) {
  const sfx = SFX[key];
  if (!sfx || isMuted() || !extension) return;
  preloadSfx();

  const buffer = buffers.get(sfx.file);
  if (context && buffer) {
    // El contexto se suspende solo al pasar la pestaña a segundo plano
    if (context.state === 'suspended') context.resume().catch(() => {});
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = sfx.volume;
    source.connect(gain).connect(context.destination);
    // Al terminar, el nodo se suelta: en una partida larga son cientos de toques
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return;
  }
  // Todavía sin decodificar (los primeros segundos) o sin Web Audio
  playElement(sfx);
}

function playElement({ file, volume }) {
  const template = element(file);
  if (!template) return;
  try {
    const sound = template.cloneNode();
    sound.volume = volume;
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

// Cuánto dura un efecto, en milisegundos, para que la interfaz pueda esperar a que termine.
// Devuelve null si todavía no se sabe: quien pregunte debe tener su propio plazo de respaldo.
export function sfxDuration(key) {
  const sfx = SFX[key];
  if (!sfx) return null;
  const buffer = buffers.get(sfx.file);
  if (buffer) return buffer.duration * 1000;
  const seconds = elements.get(sfx.file)?.duration;
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

export const isMuted = () => getPreference('muted');

export function setMuted(value) {
  setPreference('muted', value);
  syncMusic();
}

// Música de fondo: un solo <audio> en bucle que cambia de pista. No pasa por Web Audio porque
// decodificar minutos de música ocuparía decenas de MB de memoria en el celular, y aquí no
// importa que tarde medio segundo en arrancar. Las pistas ya vienen recortadas sin silencios
// al principio ni al final (recursos-fv/scripts/convertir-musica.sh), para que el bucle no
// tenga hueco. Va bajita: los efectos y las voces van por encima.
export const MUSIC = Object.freeze({
  menu: { file: 'musica-menu', volume: 0.3 },
  game: { file: 'musica-partida', volume: 0.22 },
});

let music = null;
let musicFile = null;
let track = null;

// La pista que corresponde a la pantalla: 'menu', 'game' o null para ninguna
export function setMusic(key) {
  track = key;
  syncMusic();
}

export function setMusicOn(value) {
  setPreference('music', value);
  syncMusic();
}

// Suena si hay pista, ni el sonido ni la música están apagados y la pestaña está a la vista
// (en el celular, un <audio> sigue sonando con la pantalla en otra app si no se pausa)
function syncMusic() {
  const wanted = MUSIC[track];
  const audible = wanted && extension && !isMuted() && getPreference('music') && document.visibilityState !== 'hidden';
  if (!audible) {
    music?.pause();
    return;
  }
  const url = urlOf(wanted.file);
  if (!url) return;
  music ??= Object.assign(new Audio(), { loop: true, preload: 'auto' });
  if (musicFile !== wanted.file) {
    music.src = url;
    musicFile = wanted.file;
  }
  music.volume = wanted.volume;
  // Antes del primer toque el navegador no deja sonar: se reintenta en cada toque
  if (music.paused) music.play().catch(() => {});
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', syncMusic);
  addEventListener('pointerdown', syncMusic);
  addEventListener('keydown', syncMusic);
}
