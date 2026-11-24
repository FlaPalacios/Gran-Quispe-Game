// HUD de la partida (HTML sobre el canvas): panel de turno, tarjetas de jugadores y acciones.
// Solo lee el estado y envía acciones al store; las reglas las decide el motor.
import { avatarFor } from '../app/characters.js';
import { onlyBotsLeft } from '../app/botPlayer.js';
import { viewerCanSeeDice } from '../app/gameStore.js';
import { CALL_SCALE, QUISPE, readDice } from '../engine/dice.js';
import { LETTERS } from '../engine/modes.js';
import { CHOLADA_REASONS, PHASES, RESULTS, canSpy, getLastCall, getSpiedDie, isFinalDuel } from '../engine/rules.js';
import { hasText, t } from '../i18n/index.js';
import { PressureClock } from './PressureClock.js';
import { RollButton } from './RollButton.js';
import { SoundToggle } from './SoundToggle.js';
import { h } from './dom.js';
import { formatCall, lossUnit, modeName, playerName } from './format.js';

// callSheetOpen: con el teclado (o la hoja) abierto, el reloj se dibuja dentro de él,
// que tapa el panel de turno. Solo puede haber uno a la vez, porque el intervalo es único.
export function GameHud({
  snapshot,
  store,
  callSheetOpen,
  foldPlayers,
  playersOpen,
  onTogglePlayers,
  onExit,
  onOpenCalls,
  onPlayAgain,
  onMenu,
  onRefresh,
}) {
  const { game } = snapshot;
  const current = game.players.find((p) => p.id === game.currentPlayerId);
  // Mientras se destapa, todo lo que se dibuja de los jugadores es como estaban antes de la ronda
  const playersBefore = snapshot.playersBefore ?? game.players;
  // Tres zonas independientes: cada una se coloca con las medidas de src/app/stage.js
  return h(
    'div',
    { class: 'hud' },
    h(
      'div',
      { class: 'zona hud__top' },
      // En el duelo final, el aviso ocupa el sitio del modo: en celular no caben los dos
      h('span', { class: 'pill' }, t('game.round', { n: game.round.number, mode: isFinalDuel({ ...game, players: playersBefore }) ? t('game.finalDuel') : modeName(game.config.mode) })),
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
      // Mientras se destapa se dibujan los jugadores como estaban antes de la ronda
      playerList(game, playersBefore, { foldPlayers, playersOpen, onTogglePlayers }),
    ),
    h(
      'section',
      { class: 'zona hud__play' },
      presenceNotice(snapshot),
      turnCard(snapshot, current, store, !callSheetOpen),
      actions(snapshot, current, { store, onOpenCalls, onPlayAgain, onMenu }),
    ),
  );
}

function turnCard(snapshot, current, store, withClock) {
  const { game } = snapshot;
  const last = getLastCall(game);
  // El turno de un bot, o en línea el de otro jugador: el panel cuenta qué está haciendo
  if (watching(snapshot, current)) {
    const caller = last && playerName(game, last.playerId);
    const card = panel(t('game.turnOf', { name: current.name }), t(`game.watch.${game.phase}`, { name: caller, call: last && formatCall(last.value) }));
    card.setAttribute('role', 'status'); // para que un lector de pantalla cuente qué hace el otro
    return card;
  }
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
        viewerCanSeeDice(snapshot) && h('span', { class: 'sr-only' }, diceText(game.round.dice)),
        withClock && PressureClock(snapshot, store),
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
        spyLine(game, current, store),
        withClock && PressureClock(snapshot, store),
      );
    case PHASES.ROUND_OVER:
    case PHASES.GAME_OVER:
      // Mientras sube el cubilete no se adelanta nada de lo que pasó
      return snapshot.revealing ? panel(t('game.revealing'), t('game.revealing.hint')) : resultCard(game);
    default:
      return null;
  }
}

// Cada forma de perder la ronda tiene su propio título. Creer un Quispe no es equivocarse,
// así que no lleva el cartel de Cholada ni su sonido: simplemente se pierde.
const RESULT_TITLES = {
  [RESULTS.DOUBT]: 'result.doubt.title',
  [RESULTS.CHOLADA]: 'result.cholada.title',
  [RESULTS.BELIEVED_QUISPE]: 'result.believedQuispe.title',
};

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
  // En la Cholada por un número que no existe, lo que se escribió no se ve en ningún otro
  // sitio: sin esto el jugador no sabe en qué se equivocó
  if (result.reason === CHOLADA_REASONS.INVALID_NUMBER) {
    lines.unshift(t('result.cholada.called', { call: result.call }));
  }
  lines.push(t('result.loses', { name: loser.name, cost: result.cost, unit: lossUnit(game.config.mode, result.cost) }));
  if (loser.eliminated) lines.push(t(result.duel ? 'result.eliminatedDuel' : 'result.eliminated', { name: loser.name }));

  return h(
    'div',
    { class: `turn-card result${isCholada ? ' result--cholada' : ''}`, role: 'status' },
    h('h2', { class: 'result__title' }, t(RESULT_TITLES[result.type])),
    isCholada && hasText(`result.cholada.${result.reason}`) && h('p', { class: 'result__subtitle' }, t(`result.cholada.${result.reason}`)),
    lines.map((line) => h('p', { class: 'turn-card__text' }, line)),
    result.penaltyText && h('p', { class: 'result__penalty' }, t('result.penalty', { text: result.penaltyText })),
    game.phase === PHASES.GAME_OVER && h('p', { class: 'result__winner' }, t('gameover.title', { name: playerName(game, game.winnerId) })),
  );
}

function actions(snapshot, current, { store, onOpenCalls, onPlayAgain, onMenu }) {
  const { game } = snapshot;
  // Destapando no hay nada que hacer todavía: ni seguir a la ronda siguiente
  if (snapshot.revealing || watching(snapshot, current)) return null;
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
      if (onlyBotsLeft(game)) return null;
      return h('div', { class: 'actions' }, h('button', { class: 'btn btn--primary btn--big', onClick: () => store.dispatch({ type: 'NEXT_ROUND' }) }, t('result.next')));
    case PHASES.GAME_OVER:
      // En línea, volver a jugar lo decide solo quien creó la sala (a los demás no les llega onPlayAgain)
      return h(
        'div',
        { class: onPlayAgain ? 'actions actions--two' : 'actions' },
        h('button', { class: 'btn btn--light btn--big', onClick: onMenu }, t('gameover.menu')),
        onPlayAgain && h('button', { class: 'btn btn--primary btn--big', onClick: onPlayAgain }, t('gameover.again')),
      );
    default:
      return null;
  }
}

// En pantallas bajas las tarjetas se pliegan en una barra: la mesa y el panel de cantar
// pesan más que ver las letras de todos a la vez.
function playerList(game, players, { foldPlayers, playersOpen, onTogglePlayers }) {
  const cards = h('div', { class: 'players' }, players.map((p, i) => playerCard(game, p, i)));
  if (!foldPlayers) return cards;
  return h(
    'details',
    { class: 'players-fold', open: playersOpen, onToggle: (e) => onTogglePlayers(e.target.open) },
    h('summary', { class: 'players-fold__summary' }, t('game.players', { n: players.length })),
    cards,
  );
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

// Hoja inferior para elegir la jugada. Se ofrecen todas, incluso las más bajas:
// cantar igual o menos que la anterior es una Cholada y forma parte del juego.
export function CallSheet({ snapshot, store, onPick, onCancel }) {
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
      // La hoja tapa el panel de turno: el reloj se sigue viendo aquí
      PressureClock(snapshot, store),
      h('div', { class: 'call-grid' }, numbers.map((v) => option(v)), option(QUISPE, ' call-option--quispe')),
      h('button', { class: 'btn btn--light', onClick: onCancel }, t('game.cancel')),
    ),
  );
}

// En línea: quién se desconectó, y si ya juega un bot por él
function presenceNotice({ presence, viewerId }) {
  const gone = presence?.filter((p) => !p.connected && p.id !== viewerId) ?? [];
  if (!gone.length) return null;
  return h(
    'div',
    { class: 'presence', role: 'status' },
    gone.map((p) => h('p', {}, t(p.autopilot ? 'online.gone.bot' : 'online.gone.wait', { name: p.name }))),
  );
}

// Mirar sin jugar: el turno es de un bot, o en línea es de otro celular
function watching(snapshot, current) {
  return Boolean(current?.isBot || (snapshot.online && current && current.id !== snapshot.viewerId));
}

// Comodín de espía: el botón mientras le quede, y lo que vio una vez usado
function spyLine(game, player, store) {
  const die = getSpiedDie(game, player.id);
  if (die != null) return h('p', { class: 'turn-card__text' }, t('game.spied', { n: die }));
  if (!canSpy(game, player.id)) return null;
  return h('button', { class: 'btn btn--light btn--small', onClick: () => store.dispatch({ type: 'SPY', playerId: player.id }) }, t('game.spy'));
}

function diceText(dice) {
  return t('game.yourDice', { a: dice[0], b: dice[1], value: formatCall(readDice(dice)) });
}

function panel(title, text, ...extra) {
  return h('div', { class: 'turn-card' }, h('h2', { class: 'turn-card__title' }, title), h('p', { class: 'turn-card__text' }, text), ...extra);
}
