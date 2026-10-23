// HUD de la partida (HTML sobre el canvas): panel de turno, tarjetas de jugadores y acciones.
// Solo lee el estado y envía acciones al store; las reglas las decide el motor.
import { avatarFor } from '../app/characters.js';
import { CALL_SCALE, QUISPE, readDice } from '../engine/dice.js';
import { LETTERS } from '../engine/modes.js';
import { PHASES, RESULTS, canSeeDice, getLastCall } from '../engine/rules.js';
import { t } from '../i18n/index.js';
import { RollButton } from './RollButton.js';
import { SoundToggle } from './SoundToggle.js';
import { h } from './dom.js';
import { formatCall, lossUnit, modeName, playerName } from './format.js';

// Intervalo del reloj de presión. El plazo no se guarda aquí: sale de turnStartedAt del store,
// así nunca se arrastra de una partida o un turno anterior.
let clockInterval = null;

// Se llama antes de cada redibujo; pressureClock lo vuelve a crear si sigue haciendo falta
export function stopClock() {
  clearInterval(clockInterval);
  clockInterval = null;
}

export function GameHud({ snapshot, store, onExit, onOpenCalls, onPlayAgain, onMenu, onRefresh }) {
  const { game } = snapshot;
  const current = game.players.find((p) => p.id === game.currentPlayerId);
  // Tres zonas independientes: cada una se coloca con las medidas de src/app/stage.js
  return h(
    'div',
    { class: 'hud' },
    h(
      'div',
      { class: 'zona hud__top' },
      h('span', { class: 'pill' }, t('game.round', { n: game.round.number, mode: modeName(game.config.mode) })),
      h(
        'span',
        { class: 'hud__top-actions' },
        SoundToggle({ onChange: onRefresh }),
        h('button', { class: 'btn btn--light btn--small', onClick: onExit }, t('game.exit')),
      ),
    ),
    h(
      'div',
      { class: 'zona hud__players' },
      h('div', { class: 'players' }, game.players.map((p, i) => playerCard(game, p, i))),
    ),
    h(
      'section',
      { class: 'zona hud__play' },
      turnCard(snapshot, current, store),
      actions(game, current, { store, onOpenCalls, onPlayAgain, onMenu }),
    ),
  );
}

function turnCard(snapshot, current, store) {
  const { game, viewerId } = snapshot;
  const last = getLastCall(game);
  switch (game.phase) {
    case PHASES.ROLL:
      return panel(
        t('game.turnOf', { name: current.name }),
        last ? t('game.roll.believedHint', { call: formatCall(last.value) }) : t('game.roll.hint'),
      );
    case PHASES.CALL:
      return panel(
        t('game.call.title'),
        last ? t('game.call.raiseHint', { call: formatCall(last.value) }) : t('game.call.openHint'),
        // Los dados solo están dibujados en el canvas: se repiten en texto para lectores de pantalla
        canSeeDice(game, viewerId) && h('span', { class: 'sr-only' }, diceText(game.round.dice)),
      );
    case PHASES.DECIDE:
      return h(
        'div',
        { class: 'turn-card' },
        h('h2', { class: 'turn-card__title' }, t('game.turnOf', { name: current.name })),
        h(
          'p',
          { class: 'turn-card__text' },
          t('game.called', { name: playerName(game, last.playerId) }),
          ' ',
          h('span', { class: 'call-chip' }, formatCall(last.value)),
        ),
        pressureClock(snapshot, store),
      );
    case PHASES.ROUND_OVER:
    case PHASES.GAME_OVER:
      return resultCard(game);
    default:
      return null;
  }
}

function resultCard(game) {
  const { result } = game.round;
  const loser = game.players.find((p) => p.id === result.loserId);
  const isCholada = result.type === RESULTS.CHOLADA;
  const lines = [];

  if (result.type === RESULTS.DOUBT) {
    lines.push(
      t('result.doubt.detail', {
        caller: playerName(game, result.callerId),
        call: formatCall(result.call),
        actual: formatCall(result.actual),
      }),
    );
  } else if (result.revealed) {
    lines.push(t('result.revealed', { actual: formatCall(result.actual) }));
  }
  lines.push(t('result.loses', { name: loser.name, cost: result.cost, unit: lossUnit(game.config.mode, result.cost) }));
  if (loser.eliminated) lines.push(t('result.eliminated', { name: loser.name }));

  return h(
    'div',
    { class: `turn-card result${isCholada ? ' result--cholada' : ''}`, role: 'status' },
    h('h2', { class: 'result__title' }, t(isCholada ? 'result.cholada.title' : 'result.doubt.title')),
    isCholada && h('p', { class: 'result__subtitle' }, t(`result.cholada.${result.reason}`)),
    lines.map((line) => h('p', { class: 'turn-card__text' }, line)),
    result.penaltyText && h('p', { class: 'result__penalty' }, t('result.penalty', { text: result.penaltyText })),
    game.phase === PHASES.GAME_OVER && h('p', { class: 'result__winner' }, t('gameover.title', { name: playerName(game, game.winnerId) })),
  );
}

function actions(game, current, { store, onOpenCalls, onPlayAgain, onMenu }) {
  const send = (type) => () => store.dispatch({ type, playerId: current?.id });
  switch (game.phase) {
    case PHASES.ROLL: {
      // Solo si sigue siendo la misma tirada: el turno pudo cambiar mientras se sacudía
      const stillRolling = () => {
        const { game: now } = store.get();
        return now?.phase === PHASES.ROLL && now.currentPlayerId === current.id;
      };
      return h(
        'div',
        { class: 'actions' },
        RollButton({
          onShake: () => stillRolling() && store.signal('cupShake'),
          onThrow: () => stillRolling() && send('ROLL')(),
        }),
      );
    }
    case PHASES.CALL:
      return h('div', { class: 'actions' }, h('button', { class: 'btn btn--primary btn--big', onClick: onOpenCalls }, t('game.call')));
    case PHASES.DECIDE:
      return h(
        'div',
        { class: 'actions actions--two' },
        h('button', { class: 'btn btn--secondary btn--big', onClick: send('BELIEVE') }, h('span', { 'aria-hidden': 'true' }, '✓ '), t('game.believe')),
        h('button', { class: 'btn btn--primary btn--big', onClick: send('DOUBT') }, h('span', { 'aria-hidden': 'true' }, '✕ '), t('game.doubt')),
      );
    case PHASES.ROUND_OVER:
      return h('div', { class: 'actions' }, h('button', { class: 'btn btn--primary btn--big', onClick: () => store.dispatch({ type: 'NEXT_ROUND' }) }, t('result.next')));
    case PHASES.GAME_OVER:
      return h(
        'div',
        { class: 'actions actions--two' },
        h('button', { class: 'btn btn--light btn--big', onClick: onMenu }, t('gameover.menu')),
        h('button', { class: 'btn btn--primary btn--big', onClick: onPlayAgain }, t('gameover.again')),
      );
    default:
      return null;
  }
}

function playerCard(game, player, index) {
  const isTurn = player.id === game.currentPlayerId;
  const classes = ['player', isTurn && 'is-turn', player.eliminated && 'is-out'].filter(Boolean).join(' ');
  const avatar = avatarFor(index);
  return h(
    'article',
    { class: classes, 'aria-current': isTurn ? 'true' : null },
    avatar
      ? h('img', { class: 'player__avatar', src: avatar, alt: '', width: '192', height: '192' })
      : h('span', { class: 'player__avatar player__avatar--initial', 'aria-hidden': 'true' }, player.name.charAt(0).toUpperCase()),
    h('span', { class: 'player__name' }, player.name),
    player.eliminated
      ? h('span', { class: 'player__out' }, t('player.out'))
      : game.config.mode === 'lives'
        ? h('span', { class: 'player__lives' }, t(player.lives === 1 ? 'player.life' : 'player.lives', { n: player.lives }))
        : h(
            'span',
            { class: 'letters', role: 'img', 'aria-label': t('player.letters', { n: player.letters, total: LETTERS.length }) },
            [...LETTERS].map((letter, i) =>
              h('span', { class: `letter${i < player.letters ? ' is-lost' : ''}`, 'aria-hidden': 'true' }, letter),
            ),
          ),
  );
}

function pressureClock({ game, turnStartedAt }, store) {
  const { pressureClock: variant } = game.config.variants;
  if (!variant.enabled || turnStartedAt == null) return null;

  const total = variant.seconds * 1000;
  const deadline = turnStartedAt + total;
  const label = h('span', { class: 'timer__label' });
  const bar = h('span', { class: 'timer__bar' });
  const tick = () => {
    const remaining = Math.max(0, deadline - Date.now());
    label.textContent = t('game.timeLeft', { s: Math.ceil(remaining / 1000) });
    bar.style.width = `${(remaining / total) * 100}%`;
    return remaining;
  };
  tick();
  stopClock();
  const playerId = game.currentPlayerId;
  clockInterval = setInterval(() => {
    if (tick() > 0) return;
    stopClock();
    // Solo si sigue siendo la misma decisión (el motor también lo valida)
    const { game: now } = store.get();
    if (now?.phase === PHASES.DECIDE && now.currentPlayerId === playerId) store.dispatch({ type: 'TIMEOUT', playerId });
  }, 200);
  return h('div', { class: 'timer', role: 'timer' }, h('span', { class: 'timer__track' }, bar), label);
}

// Hoja inferior para elegir la jugada. Se ofrecen todas, incluso las más bajas:
// cantar igual o menos que la anterior es una Cholada y forma parte del juego.
export function CallSheet({ onPick, onCancel }) {
  const numbers = CALL_SCALE.filter((v) => v !== QUISPE);
  const option = (value, extra = '') =>
    h('button', { class: `btn btn--light call-option${extra}`, onClick: () => onPick(value) }, formatCall(value));
  return h(
    'div',
    {
      class: 'sheet-backdrop',
      onClick: (e) => e.target === e.currentTarget && onCancel(),
      onKeydown: (e) => e.key === 'Escape' && onCancel(),
    },
    h(
      'div',
      { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
      h('h2', { class: 'sheet__title', id: 'sheet-title', tabindex: '-1', 'data-autofocus': true }, t('game.pickCall')),
      h('div', { class: 'call-grid' }, numbers.map((v) => option(v)), option(QUISPE, ' call-option--quispe')),
      h('button', { class: 'btn btn--light', onClick: onCancel }, t('game.cancel')),
    ),
  );
}

function diceText(dice) {
  return t('game.yourDice', { a: dice[0], b: dice[1], value: formatCall(readDice(dice)) });
}

function panel(title, text, ...extra) {
  return h('div', { class: 'turn-card' }, h('h2', { class: 'turn-card__title' }, title), h('p', { class: 'turn-card__text' }, text), ...extra);
}
