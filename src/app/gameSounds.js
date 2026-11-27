// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo: lo de la
// mesa, con connectGameSounds, y lo del final de ronda, con momentSounds, al ritmo de los
// mensajes de src/ui/RoundMoment.js.
import { QUISPE } from '../engine/dice.js';
import { PHASES, RESULTS, getLastCall } from '../engine/rules.js';
import { hushMusic, playSfx, playVoice, preloadVoices, setMusicOverride, sfxDuration, voiceDuration } from './audio.js';
import { characterIndexFor } from './characters.js';
import { roundSounds, roundVoice } from './reaction.js';

// El sonido de sacudir dura más que una sacudida: no se reinicia antes de este tiempo
const SHAKE_SOUND_EVERY_MS = 550;
// Entre el efecto del título y la frase del personaje, para que no se pisen
const VOICE_GAP_MS = 150;
// Lo que se espera de un sonido que todavía no terminó de bajar
const UNKNOWN_SOUND_MS = 1200;
// Al ganar, la cumbia arranca y enseguida se destapa la cerveza
const CHEER_DELAY_MS = 700;
// "Te equivocaste" tiene dos grabaciones: se van turnando
const WRONG_DOUBT = ['wrongDoubt', 'wrongDoubtSlap'];
let wrongDoubts = 0;

// El personaje de cada jugador, el mismo que muestran la tarjeta y la escena
const characterOf = (game, playerId) => characterIndexFor(game.players.findIndex((p) => p.id === playerId));
const callKey = (value) => (value === QUISPE ? 'quispe' : String(value));

export function connectGameSounds(store) {
  let previous = null;
  let lastShakeAt = 0;
  // En el modo castigo los personajes solo cantan sus jugadas (pedido de Flavio, 2026-11-26)
  const say = (game, playerId, key, always = false) =>
    (always || game.config.mode !== 'penalty') && playVoice(characterOf(game, playerId), key);

  const unsubscribeSignals = store.onSignal((name) => {
    if (name === 'gameStart') {
      playSfx('start');
      return;
    }
    if (name !== 'cupShake' || Date.now() - lastShakeAt < SHAKE_SOUND_EVERY_MS) return;
    lastShakeAt = Date.now();
    playSfx('shake');
  });

  const unsubscribe = store.subscribe(({ game }) => {
    const before = previous;
    previous = game;

    // Empieza (o se retoma) una partida: se preparan las voces de quienes juegan
    if (game && !before) preloadVoices(game.players.map((_, i) => characterIndexFor(i)));
    // La cumbia del ganador dura hasta que se sale de la partida terminada
    if (game?.phase !== PHASES.GAME_OVER) setMusicOverride(null);
    if (!game || !before || before.phase === game.phase) return;

    // Se soltó el botón Tirar: el cubilete golpea la mesa (la sacudida ya sonó mientras tanto)
    if (before.phase === PHASES.ROLL && game.phase === PHASES.CALL) {
      playSfx('thud');
      return;
    }

    // Cantó: su personaje dice la jugada
    if (before.phase === PHASES.CALL && game.phase === PHASES.DECIDE) {
      const last = getLastCall(game);
      say(game, last.playerId, callKey(last.value), true);
      return;
    }

    // Creyó y le pasan el cubilete para que tire: brindis, y lo dice quien creyó (es quien tira)
    if (before.phase === PHASES.DECIDE && game.phase === PHASES.ROLL) {
      playSfx('believe');
      say(game, game.currentPlayerId, 'creo');
      return;
    }

    // Mientras sube el cubilete habla quien desconfió. Lo demás del final de ronda suena con
    // los mensajes (momentSounds), cuando el resultado ya se ve.
    const { result } = game.round;
    if (result?.revealed && result.type === RESULTS.DOUBT) say(game, result.doubterId, 'desconfio');
  });

  return () => {
    unsubscribeSignals();
    unsubscribe();
  };
}

/**
 * Lo que suena con cada mensaje del final de ronda. RoundMoment llama a `headline()`,
 * `loss(hitMs)` y `win()` al mostrar cada uno, y cada llamada devuelve cuánto tardan sus
 * sonidos, para no pasar al mensaje siguiente encima de ellos. El efecto entra con su texto y
 * la frase del personaje espera a que termine. `stop()` cancela lo que aún no sonó.
 */
export function momentSounds(game) {
  const sounds = roundSounds(game);
  const voice = roundVoice(game);
  let timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const stop = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const lengthOf = (key) => sfxDuration(key) ?? UNKNOWN_SOUND_MS;

  return {
    stop,
    headline() {
      stop();
      let key = sounds.headline;
      if (key === 'wrongDoubt') key = WRONG_DOUBT[wrongDoubts++ % WRONG_DOUBT.length];
      if (key) playSfx(key);
      if (!voice) return key ? lengthOf(key) : 0;
      const voiceAt = key ? lengthOf(key) + VOICE_GAP_MS : 0;
      const character = characterOf(game, voice.playerId);
      at(voiceAt, () => playVoice(character, voice.key));
      return voiceAt + (voiceDuration(character, voice.key) ?? UNKNOWN_SOUND_MS);
    },
    // Suena cuando el golpe cae sobre el corazón o la letra, `hitMs` después de aparecer
    loss(hitMs) {
      stop();
      at(hitMs, () => {
        playSfx(sounds.hit);
        if (sounds.hit === 'penalty') hushMusic(lengthOf('penalty'));
      });
      return hitMs + lengthOf(sounds.hit);
    },
    win() {
      stop();
      setMusicOverride('winner');
      // Sin cancelar: si se toca para cerrar, la cerveza igual se destapa
      setTimeout(() => playSfx('cheer'), CHEER_DELAY_MS);
      return CHEER_DELAY_MS + lengthOf('cheer');
    },
  };
}
