// Pantalla "pásale el celular": obligatoria antes de mostrar el turno de cada jugador.
// Es opaca para que no se vea nada de la mesa mientras se pasa el teléfono.
import { t } from '../i18n/index.js';
import { h } from './dom.js';

export function PassDeviceScreen({ name, onReady }) {
  return h(
    'div',
    { class: 'pass', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pass-name' },
    h('p', { class: 'pass__title' }, t('pass.title')),
    h('p', { class: 'pass__name', id: 'pass-name' }, name),
    h('p', { class: 'pass__hint' }, t('pass.hint')),
    h('button', { class: 'btn btn--primary btn--big', onClick: onReady, 'data-autofocus': true }, t('pass.ready', { name })),
  );
}
