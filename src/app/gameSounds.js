// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo.
import { PHASES, RESULTS } from '../engine/rules.js';
import { playSfx } from './audio.js';
import { roundReaction } from './reaction.js';

// El sonido de sacudir dura más que una sacudida: no se reinicia antes de este tiempo
const SHAKE_SOUND_EVERY_MS = 550;
// El remate del final de ronda entra cuando el cubilete ya se destapó, no encima del golpe
const STING_DELAY_MS = 420;

export function connectGameSounds(store) {
  let previous = null;
  let wasRevealing = false;
  let lastShakeAt = 0;
  let pendingSting = null;
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

    // Terminó de subir el cubilete: recién ahora se ve lo que pasó, y suena
    if (destapando && !revealing && game?.round.result) {
      if (game.round.result.type === RESULTS.CHOLADA) playSfx('cholada');
      const { sound } = roundReaction(game);
      if (sound) for (const key of stingFor(sound, laugh)) playSfx(key);
      return;
    }

    // Si la partida siguió (o se salió al menú), el remate pendiente ya no corresponde
    if (!game || before?.phase !== game.phase) clearTimeout(pendingSting);
    if (!game || !before || before.phase === game.phase) return;

    // Se soltó el botón Tirar: el cubilete golpea la mesa (la sacudida ya sonó mientras tanto)
    if (before.phase === PHASES.ROLL && game.phase === PHASES.CALL) {
      playSfx('thud');
      return;
    }

    // Creyó y le pasan el cubilete para que tire: brindis
    if (before.phase === PHASES.DECIDE && game.phase === PHASES.ROLL) {
      playSfx('believe');
      return;
    }

    if (game.phase !== PHASES.ROUND_OVER && game.phase !== PHASES.GAME_OVER) return;
    const { result } = game.round;
    // Si hay que destapar, ahora solo suena el cubilete levantándose: el resto espera a que
    // termine, que es cuando el store apaga `revealing`.
    if (result.revealed) {
      playSfx('reveal');
      return;
    }
    // La risa de la Cholada es solo para las Choladas: creer un Quispe no es equivocarse,
    // así que ahí solo entra el remate
    if (result.type === RESULTS.CHOLADA) playSfx('cholada');
    const { sound } = roundReaction(game);
    if (sound) pendingSting = setTimeout(() => stingFor(sound, laugh).forEach((key) => playSfx(key)), STING_DELAY_MS);
  });

  return () => {
    clearTimeout(pendingSting);
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
