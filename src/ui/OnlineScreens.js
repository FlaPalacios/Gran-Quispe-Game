// Pantallas del modo online: entrar a una sala (o ir a crearla) y la sala de espera.
// Usan el mismo armado que la configuración: cabecera, tarjetas y botón abajo.
import { t } from '../i18n/index.js';
import { card } from './RulesPanel.js';
import { h } from './dom.js';

function screen({ title, onBack, body, footer }) {
  return h(
    'main',
    { class: 'screen setup' },
    h(
      'header',
      { class: 'setup__header' },
      h('button', { class: 'btn btn--icon btn--light', onClick: onBack, 'aria-label': t('setup.back') }, '‹'),
      h('h1', { class: 'setup__title' }, title),
    ),
    h('div', { class: 'setup__body' }, ...body),
    footer && h('footer', { class: 'setup__footer' }, footer),
  );
}

const errorLine = (code) => code && h('p', { class: 'online__error', role: 'alert' }, t(`online.error.${code}`));

// `form` guarda lo escrito entre redibujos: { name, code, error }
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
      card(
        t('online.join'),
        h('p', { class: 'online__hint' }, t('online.join.hint')),
        input('code', t('online.code'), { maxlength: '4', autocapitalize: 'characters', class: 'input online__code-input' }),
        input('name', t('online.name'), { maxlength: '16' }),
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

export function Lobby({ lobby, error, onLeave, onStart }) {
  const me = lobby.seats.find((s) => s.id === lobby.you);
  const host = lobby.seats.find((s) => s.host);
  const ready = lobby.seats.every((s) => s.taken);
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
        t('setup.players'),
        h(
          'ul',
          { class: 'online__seats' },
          lobby.seats.map((seat) =>
            h(
              'li',
              { class: `online__seat${seat.taken ? '' : ' is-free'}` },
              seat.taken ? seat.name : t('online.freeSeat'),
              seat.isBot && h('small', {}, ` · ${t(`bot.${seat.personality}`)}`),
              seat.host && h('small', {}, ` · ${t('online.host')}`),
              seat.id === lobby.you && h('small', {}, ` · ${t('online.you')}`),
              seat.taken && !seat.connected && h('small', {}, ` · ${t('online.offline')}`),
            ),
          ),
        ),
      ),
    ],
    footer: me?.host
      ? h('button', { class: 'btn btn--primary btn--big', disabled: !ready, onClick: onStart }, t(ready ? 'online.start' : 'online.waitingPlayers'))
      : h('p', { class: 'online__hint' }, t('online.waitHost', { name: host?.name ?? '' })),
  });
}
