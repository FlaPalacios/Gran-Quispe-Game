// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo.
import { QUISPE } from '../engine/dice.js';
import { PHASES, RESULTS, getLastCall } from '../engine/rules.js';
import { playSfx, playVoice, preloadVoices } from './audio.js';
import { characterIndexFor } from './characters.js';
import { roundReaction, roundVoice } from './reaction.js';

// El sonido de sacudir dura más que una sacudida: no se reinicia antes de este tiempo
const SHAKE_SOUND_EVERY_MS = 550;
// El remate del final de ronda entra cuando el cubilete ya se destapó, no encima del golpe
const STING_DELAY_MS = 420;
// Los únicos efectos que cierran una ronda: quedar fuera y ganar la partida (el brindis).
// Perder una ronda o hacer Cholada no suena a nada: lo dice la voz del personaje. Las risas
// se quitaron (pedido de Flavio, 2026-11-24).
const STINGS = { eliminated: 'eliminated', win: 'cheer' };

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
    // Si hay que destapar, el remate espera a que termine, que es cuando el store apaga
    // `revealing`. Mientras sube el cubilete solo habla quien desconfió.
    if (result.revealed) {
      if (result.type === RESULTS.DOUBT) say(game, result.doubterId, 'desconfio');
      return;
    }
    finish(game, STING_DELAY_MS);
  });

  // Lo que suena cuando ya se sabe cómo terminó la ronda: el efecto de quedar fuera o de
  // ganar, o si no, la frase del personaje que habla (roundVoice nunca coincide con ellos)
  function finish(game, delay) {
    const sting = STINGS[roundReaction(game).sound];
    const voice = roundVoice(game);
    later(() => {
      if (sting) playSfx(sting);
      if (voice) say(game, voice.playerId, voice.key);
    }, delay);
  }

  return () => {
    cancelPending();
    unsubscribeSignals();
    unsubscribe();
  };
}
