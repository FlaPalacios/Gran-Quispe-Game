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
  click: { file: 'sfx-boton', volume: 0.35 },
  start: { file: 'sfx-empezar', volume: 1 },
  believe: { file: 'sfx-creo', volume: 0.5 },
  eliminated: { file: 'sfx-eliminado', volume: 0.7 },
  // El brindis es el remate de ganar la partida
  cheer: { file: 'sfx-cerveza-ganar', volume: 0.8 },
  // Los del momento de fin de ronda ya vienen nivelados al volumen de las voces
  // (recursos-fv/scripts/convertir-momentos.py)
  caught: { file: 'sfx-mentiste-mal', volume: 1 },
  wrongDoubt: { file: 'sfx-te-equivocaste', volume: 1 },
  wrongDoubtSlap: { file: 'sfx-te-equivocaste-golpe', volume: 1 },
  cholada: { file: 'sfx-cholada', volume: 1 },
  lossHit: { file: 'sfx-perder-vida', volume: 1 },
  penalty: { file: 'sfx-tomaaas', volume: 1 },
});

// Efectos y música en audio/; las voces de los personajes, en audio/voces/
const files = import.meta.glob('../assets/audio/**/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' });

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
  for (const { file } of Object.values(SFX)) decode(file);
  decodeVoices(); // las de una partida que empezó antes del primer toque
}

const requested = new Set(); // archivos ya pedidos, para no bajarlos dos veces

function decode(file) {
  const url = urlOf(file);
  if (!context || !url || requested.has(file)) return;
  requested.add(file);
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => buffers.set(file, buffer))
    .catch(() => requested.delete(file)); // sin ese sonido, el juego sigue igual
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
  if (sfx) play(sfx);
}

function play(sfx) {
  if (isMuted() || !extension) return;
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

// Voces de los personajes (recursos-fv/scripts/cortar-voces.py): las jugadas cantadas ('31',
// '110', 'quispe') y las frases ('creo', 'desconfio', 'pille', 'pierdo', 'cholada', 'gano',
// 'fuera'). Archivo voces/voz-<personaje desde 1>-<clave>. Un personaje sin grabar, o una
// frase que no grabó, simplemente no suena.
const VOICE_VOLUME = 1;
const voiceFile = (characterIndex, key) => `voces/voz-${characterIndex + 1}-${key}`;

// Con las voces apagadas en Configuración nadie habla
const hasVoice = (characterIndex, key) =>
  getPreference('voices') && characterIndex >= 0 && Boolean(urlOf(voiceFile(characterIndex, key)));

export function playVoice(characterIndex, key) {
  if (hasVoice(characterIndex, key)) play({ file: voiceFile(characterIndex, key), volume: VOICE_VOLUME });
}

// Al empezar una partida se preparan las voces de los personajes que juegan, no las de todos.
// Si todavía no hubo un toque (se recargó en medio de una partida online), solo se anotan: crear
// el contexto de audio antes del gesto lo deja dormido en iPhone, y el toque ya no lo despertaría.
const wantedVoices = new Set();

export function preloadVoices(characterIndexes) {
  for (const index of characterIndexes) wantedVoices.add(index);
  decodeVoices();
}

function decodeVoices() {
  if (!context || !extension) return;
  const all = Object.keys(files);
  for (const index of wantedVoices) {
    const prefix = `../assets/audio/${voiceFile(index, '')}`;
    for (const path of all) {
      if (path.startsWith(prefix) && path.endsWith(`.${extension}`)) decode(path.slice('../assets/audio/'.length, -extension.length - 1));
    }
  }
}

// Cuánto dura un efecto o una voz, en milisegundos, para esperar a que termine antes del
// siguiente. Devuelve null si todavía no se sabe: quien pregunte pone su propio plazo.
function durationOf(file) {
  const buffer = buffers.get(file);
  if (buffer) return buffer.duration * 1000;
  const seconds = elements.get(file)?.duration;
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

export const sfxDuration = (key) => (SFX[key] ? durationOf(SFX[key].file) : null);
// Una voz que no va a sonar (voces apagadas o sin grabar) dura 0: nadie la espera
export const voiceDuration = (characterIndex, key) =>
  hasVoice(characterIndex, key) ? durationOf(voiceFile(characterIndex, key)) : 0;

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
  // La cumbia del ganador suena más fuerte: ya no hay voces ni efectos que tapar
  winner: { file: 'musica-ganador', volume: 0.3 },
});

let music = null;
let musicFile = null;
let track = null;
// La pista que pide un momento del juego (la cumbia del ganador) manda sobre la de la pantalla
let override = null;
let hushTimer = null;

// La pista que corresponde a la pantalla: 'menu', 'game' o null para ninguna
export function setMusic(key) {
  track = key;
  syncMusic();
}

export function setMusicOverride(key) {
  if (override === key) return;
  override = key;
  syncMusic();
}

// Calla la música mientras suena algo que la necesita sola ("¡Tomaaas!") y la retoma donde iba
export function hushMusic(ms) {
  clearTimeout(hushTimer);
  hushTimer = setTimeout(() => {
    hushTimer = null;
    syncMusic();
  }, ms);
  syncMusic();
}

export function setMusicOn(value) {
  setPreference('music', value);
  syncMusic();
}

// Suena si hay pista, ni el sonido ni la música están apagados y la pestaña está a la vista
// (en el celular, un <audio> sigue sonando con la pantalla en otra app si no se pausa)
function syncMusic() {
  const wanted = MUSIC[override ?? track];
  const audible = wanted && !hushTimer && extension && !isMuted() && getPreference('music') && document.visibilityState !== 'hidden';
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
