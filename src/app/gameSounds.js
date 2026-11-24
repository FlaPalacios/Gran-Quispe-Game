// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo.
import { QUISPE } from '../engine/dice.js';
import { PHASES, RESULTS, getLastCall } from '../engine/rules.js';
import { hasVoice, playSfx, playVoice, preloadVoices, sfxDuration } from './audio.js';
import { characterIndexFor } from './characters.js';
import { roundReaction, roundVoice } from './reaction.js';

// El sonido de sacudir dura más que una sacudida: no se reinicia antes de este tiempo
const SHAKE_SOUND_EVERY_MS = 550;
// El remate del final de ronda entra cuando el cubilete ya se destapó, no encima del golpe
const STING_DELAY_MS = 420;
// La frase del personaje entra cuando termina el remate, pero sin esperar más que esto:
// el de ganar dura más de 3 s y la frase llegaría tarde
const VOICE_WAIT_MAX_MS = 1200;

// El personaje de cada jugador, el mismo que muestran la tarjeta y la escena
const characterOf = (game, playerId) => characterIndexFor(game.players.findIndex((p) => p.id === playerId));
const callKey = (value) => (value === QUISPE ? 'quispe' : String(value));

export function connectGameSounds(store) {
  let previous = null;
  let wasRevealing = false;
  let lastShakeAt = 0;
  // Remates y frases que esperan su turno: se cancelan si la partida sigue antes de que suenen
  let pending = [];
  const later = (fn, ms) => (ms > 0 ? pending.push(setTimeout(fn, ms)) : fn());
  const cancelPending = () => {
    pending.forEach(clearTimeout);
    pending = [];
  };
  const say = (game, playerId, key) => playVoice(characterOf(game, playerId), key);
  // Las tres risas se turnan, en vez de salir al azar, para que no toque dos veces seguidas
  // la misma. El turno es de esta partida: empieza de nuevo con cada conexión.
  let nextLaugh = 0;
  const laugh = () => LAUGHS[nextLaugh++ % LAUGHS.length];

  const unsubscribeSignals = store.onSignal((name) => {
    if (name === 'gameStart') {
      playSfx('start');
      return;
    }
    if (name !== 'cupShake' || Date.now() - lastShakeAt < SHAKE_SOUND_EVERY_MS) return;
    lastShakeAt = Date.now();
    playSfx('shake');
  });

  const unsubscribe = store.subscribe(({ game, revealing }) => {
    const before = previous;
    const destapando = wasRevealing;
    previous = game;
    wasRevealing = revealing;

    // Empieza (o se retoma) una partida: se preparan las voces de quienes juegan
    if (game && !before) preloadVoices(game.players.map((_, i) => characterIndexFor(i)));

    // Terminó de subir el cubilete: recién ahora se ve lo que pasó, y suena
    if (destapando && !revealing && game?.round.result) {
      finish(game, 0);
      return;
    }

    // Si la partida siguió (o se salió al menú), el remate pendiente ya no corresponde
    if (!game || before?.phase !== game.phase) cancelPending();
    if (!game || !before || before.phase === game.phase) return;

    // Se soltó el botón Tirar: el cubilete golpea la mesa (la sacudida ya sonó mientras tanto)
    if (before.phase === PHASES.ROLL && game.phase === PHASES.CALL) {
      playSfx('thud');
      return;
    }

    // Cantó: su personaje dice la jugada
    if (before.phase === PHASES.CALL && game.phase === PHASES.DECIDE) {
      const last = getLastCall(game);
      say(game, last.playerId, callKey(last.value));
      return;
    }

    // Creyó y le pasan el cubilete para que tire: brindis, y lo dice quien creyó (es quien tira)
    if (before.phase === PHASES.DECIDE && game.phase === PHASES.ROLL) {
      playSfx('believe');
      say(game, game.currentPlayerId, 'creo');
      return;
    }

    if (game.phase !== PHASES.ROUND_OVER && game.phase !== PHASES.GAME_OVER) return;
    const { result } = game.round;
    // Si hay que destapar, ahora solo suena el cubilete levantándose: el resto espera a que
    // termine, que es cuando el store apaga `revealing`.
    if (result.revealed) {
      // Quien desconfía lo dice mientras se levanta el cubilete
      if (result.type === RESULTS.DOUBT) say(game, result.doubterId, 'desconfio');
      playSfx('reveal');
      return;
    }
    finish(game, STING_DELAY_MS);
  });

  // Lo que suena cuando ya se sabe cómo terminó la ronda. La risa de la Cholada es solo para
  // las Choladas: creer un Quispe no es equivocarse. Si el personaje que habla tiene grabada su
  // frase, la frase reemplaza a la risa del remate y entra cuando termina lo demás.
  function finish(game, stingDelay) {
    const cholada = game.round.result.type === RESULTS.CHOLADA;
    if (cholada) playSfx('cholada');
    const { sound } = roundReaction(game);
    const voice = roundVoice(game);
    const spoken = hasVoice(characterOf(game, voice.playerId), voice.key);
    const sting = sound ? stingFor(sound, laugh).filter((key) => !(spoken && LAUGHS.includes(key))) : [];
    if (sting.length) later(() => sting.forEach((key) => playSfx(key)), stingDelay);
    if (!spoken) return;
    const longest = (keys) => Math.max(0, ...keys.map((key) => Math.min(sfxDuration(key) ?? VOICE_WAIT_MAX_MS, VOICE_WAIT_MAX_MS)));
    later(() => say(game, voice.playerId, voice.key), Math.max(cholada ? longest(['cholada']) : 0, sting.length ? stingDelay + longest(sting) : 0));
  }

  return () => {
    cancelPending();
    unsubscribeSignals();
    unsubscribe();
  };
}

// Las tres risas de la mesa
const LAUGHS = ['laughMan', 'laughMan2', 'laughGranny'];

// Qué efectos rematan cada desenlace. Perder la ronda se celebra con una risa, la pillen a
// uno mintiendo o no. Al ganar la partida suenan dos a la vez: el remate con el brindis.
function stingFor(outcome, laugh) {
  switch (outcome) {
    case 'caught':
    case 'loss':
      return [laugh()];
    case 'win':
      return ['win', 'cheer'];
    default:
      return [outcome];
  }
}
