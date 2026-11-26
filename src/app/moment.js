// El "momento" del final de ronda: el mensaje grande que se ve cuando pillan a alguien, hay
// Cholada, alguien queda fuera o gana la partida, y la tarjeta de quien perdió con lo que le
// costó. Lo que dice depende de quién mira: en primera persona para quien pilló ("¡Lo
// pillaste!"), en segunda para el pillado ("¡Te pillaron mintiendo!") y en tercera para los
// demás ("¡Pillaron a Beto!"). Aquí solo se decide qué contar; el dibujo es de
// src/ui/RoundMoment.js y los textos, de i18n.
import { LETTERS } from '../engine/modes.js';
import { PHASES, RESULTS } from '../engine/rules.js';

/**
 * @param game estado de la partida, con la ronda ya resuelta
 * @param viewerId quién mira la pantalla, o null si la miran todos (un celular entre varios)
 * @returns {{headline: {key, params, tone}, loss: object, win: object|null}|null}
 */
export function roundMoment(game, viewerId) {
  const result = game?.round?.result;
  if (!result) return null;
  const nameOf = (id) => game.players.find((p) => p.id === id)?.name ?? '';
  // 'self' si le pasó a quien mira, 'you' si fue obra suya, 'other' si es de otros
  const person = (subjectId, actorId) => (viewerId === subjectId ? 'self' : viewerId === actorId ? 'you' : 'other');

  let headline;
  if (result.type === RESULTS.DOUBT) {
    // Pillado: quien cantó mentía. Si no, quien desconfió se equivocó: decía la verdad.
    const caught = result.loserId === result.callerId;
    const kind = caught ? 'caught' : 'truth';
    const p = caught ? person(result.callerId, result.doubterId) : person(result.doubterId, result.callerId);
    // En "self" se nombra al otro; en "you" y "other", a quien cantó
    const name = p === 'self' ? nameOf(caught ? result.doubterId : result.callerId) : nameOf(result.callerId);
    headline = { key: `moment.${kind}.${p}`, params: { name, by: nameOf(result.doubterId) }, tone: kind };
  } else {
    const kind = result.type === RESULTS.CHOLADA ? 'cholada' : 'believedQuispe';
    const p = viewerId === result.loserId ? 'self' : 'other';
    headline = { key: `moment.${kind}.${p}`, params: { name: nameOf(result.loserId) }, tone: 'cholada', reason: result.reason ?? null };
  }

  const loser = game.players.find((p) => p.id === result.loserId);
  const index = game.players.indexOf(loser);
  const lives = game.config.mode === 'lives';
  const after = lives ? loser.lives : loser.letters;
  // Lo que tenía antes de perder la ronda, para animar solo lo que se le acaba de ir. Las
  // partidas guardadas antes de que el motor lo anotara se calculan restando el costo.
  const before =
    result.scoreBefore ?? (lives ? Math.min(after + result.cost, game.config.lives) : Math.max(after - result.cost, 0));
  const loss = {
    playerId: loser.id,
    playerIndex: index,
    name: loser.name,
    self: viewerId === loser.id,
    lives,
    // Cuántos corazones o letras se dibujan
    max: lives ? game.config.lives : LETTERS.length,
    before,
    after,
    // En el duelo final se queda fuera con vidas o letras de sobra
    eliminated: Boolean(loser.eliminated),
    duel: Boolean(result.duel),
    penaltyText: result.penaltyText || null,
  };

  const win =
    game.phase === PHASES.GAME_OVER
      ? { name: nameOf(game.winnerId), self: viewerId === game.winnerId, playerIndex: game.players.findIndex((p) => p.id === game.winnerId) }
      : null;

  return { headline, loss, win };
}

// Quién mira la pantalla: en línea, el dueño de este celular. En un celular con una sola
// persona (el resto, bots), esa persona. En un celular que se pasan varios, la miran todos:
// nadie es "tú" y todo se cuenta en tercera persona.
export function momentViewer({ game, viewerId, online }) {
  if (online) return viewerId;
  const humans = game?.players.filter((p) => !p.isBot) ?? [];
  return humans.length === 1 ? humans[0].id : null;
}
