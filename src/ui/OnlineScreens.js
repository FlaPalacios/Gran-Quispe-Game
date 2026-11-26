// Pantallas del modo online: entrar a una sala (o crearla) y la sala de espera.
// Usan el mismo armado que la configuración: cabecera, tarjetas y botón abajo.
import { DEFAULT_LIVES, MAX_LIVES, MIN_LIVES, MODES } from '../engine/modes.js';
import { PERSONALITIES } from '../engine/bots.js';
import { MIN_PLAYERS, SCENARIOS } from '../engine/rules.js';
import { t } from '../i18n/index.js';
import { card, extrasNote, screen, segmented, stepper } from './RulesPanel.js';
import { h } from './dom.js';

const errorLine = (code) => code && h('p', { class: 'online__error', role: 'alert' }, t(`online.error.${code}`));

// `form` guarda lo escrito entre redibujos: { name, code, error, busy }
export function OnlineMenu({ form, onBack, onCreate, onJoin }) {
  const input = (field, label, extra) =>
    h('input', {
      class: 'input',
      type: 'text',
      value: form[field],
      'aria-label': label,
      placeholder: label,
      onInput: (e) => (form[field] = e.target.value),
      ...extra,
    });

  return screen({
    title: t('online.title'),
    onBack,
    body: [
      errorLine(form.error),
      // El nombre va arriba: sirve tanto para entrar como para crear
      card(t('online.name'), input('name', t('online.name'), { maxlength: '16' })),
      card(
        t('online.join'),
        h('p', { class: 'online__hint' }, t('online.join.hint')),
        input('code', t('online.code'), { maxlength: '4', autocapitalize: 'characters', class: 'input online__code-input' }),
        h('button', { class: 'btn btn--secondary btn--big', disabled: form.busy, onClick: onJoin }, t('online.join')),
      ),
      card(
        t('online.create'),
        h('p', { class: 'online__hint' }, t('online.create.hint')),
        h('button', { class: 'btn btn--primary btn--big', disabled: form.busy, onClick: onCreate }, t('online.create')),
      ),
    ],
  });
}

// Nombre de un bot nuevo que no choque con nadie de la sala: "Honesto 3", "Honesto 4"…
function botName(personality, seats) {
  const taken = new Set(seats.map((s) => s.name.toLowerCase()));
  for (let n = seats.length + 1; ; n++) {
    const name = t('setup.botName', { name: t(`bot.${personality}.short`), n });
    if (!taken.has(name.toLowerCase())) return name;
  }
}

// `draft` guarda el castigo a medio escribir entre redibujos (lo manda app.js al empezar)
export function Lobby({ lobby, draft, busy, error, onLeave, onStart, onConfigure, onAddBot, onRemove }) {
  const me = lobby.seats.find((s) => s.id === lobby.you);
  const host = lobby.seats.find((s) => s.host);
  const isHost = Boolean(me?.host);
  const { config } = lobby;
  const full = lobby.seats.length >= lobby.maxPlayers;
  const someoneAway = lobby.seats.some((s) => !s.connected);
  const ready = lobby.seats.length >= MIN_PLAYERS && !someoneAway;
  const change = (fields) => onConfigure({ ...config, ...fields });

  const seatRow = (seat) =>
    h(
      'li',
      { class: `online__seat${seat.connected ? '' : ' is-free'}` },
      h(
        'span',
        {},
        seat.name,
        seat.isBot && h('small', {}, ` · ${t(`bot.${seat.personality}`)}`),
        seat.host && h('small', {}, ` · ${t('online.host')}`),
        seat.id === lobby.you && h('small', {}, ` · ${t('online.you')}`),
        !seat.connected && h('small', {}, ` · ${t('online.offline')}`),
      ),
      isHost &&
        !seat.host &&
        h(
          'button',
          { class: 'btn btn--icon btn--light online__remove', disabled: busy, 'aria-label': t('online.remove', { name: seat.name }), onClick: () => onRemove(seat.id) },
          '✕',
        ),
    );

  // Quien creó la sala elige las reglas; los demás las ven
  const rulesCards = isHost
    ? [
        card(t('setup.mode'), segmented('setup.mode', Object.keys(MODES), config.mode, 'mode', (mode) => change({ mode }))),
        config.mode === 'lives' &&
          card(
            t('setup.lives'),
            stepper({ value: config.lives ?? DEFAULT_LIVES, min: MIN_LIVES, max: MAX_LIVES, onChange: (lives) => change({ lives }) }),
          ),
        config.mode === 'penalty' &&
          card(
            t('setup.penalty'),
            h('input', {
              class: 'input',
              type: 'text',
              maxlength: '80',
              value: draft.penaltyText ?? config.penaltyText ?? '',
              placeholder: t('setup.penaltyPlaceholder'),
              'aria-label': t('setup.penalty'),
              // Sin volver a dibujar: se manda al tocar Empezar
              onInput: (e) => (draft.penaltyText = e.target.value),
            }),
          ),
        card(t('setup.scenario'), segmented('setup.scenario', SCENARIOS, config.scenario ?? SCENARIOS[0], 'scenario', (scenario) => change({ scenario }))),
      ]
    : [
        card(
          t('online.rules'),
          h('p', {}, t(`mode.${config.mode}`), ' · ', t(`scenario.${config.scenario ?? SCENARIOS[0]}`)),
        ),
      ];

  return screen({
    title: t('online.lobby'),
    onBack: onLeave,
    body: [
      errorLine(error),
      card(
        t('online.lobby.code'),
        h('p', { class: 'online__code', 'aria-label': lobby.code.split('').join(' ') }, lobby.code),
        h('p', { class: 'online__hint' }, t('online.lobby.hint')),
      ),
      card(
        t('online.players', { n: lobby.seats.length, max: lobby.maxPlayers }),
        h('ul', { class: 'online__seats' }, lobby.seats.map(seatRow)),
        isHost &&
          h(
            'div',
            { class: 'online__bots' },
            h('p', { class: 'online__hint' }, t(full ? 'online.full' : 'online.addBot')),
            !full &&
              Object.keys(PERSONALITIES).map((personality) =>
                h(
                  'button',
                  { class: 'btn btn--light btn--small', disabled: busy, onClick: () => onAddBot(personality, botName(personality, lobby.seats)) },
                  `+ ${t(`bot.${personality}.short`)}`,
                ),
              ),
          ),
      ),
      ...rulesCards,
      h('p', { class: 'setup__note' }, extrasNote(config.variants ?? {})),
    ],
    footer: isHost
      ? h(
          'button',
          { class: 'btn btn--primary btn--big', disabled: !ready || busy, onClick: onStart },
          t(ready ? 'online.start' : someoneAway ? 'online.waitingBack' : 'online.waitingPlayers'),
        )
      : h('p', { class: 'online__hint' }, t('online.waitHost', { name: host?.name ?? '' })),
  });
}
