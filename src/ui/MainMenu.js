// Menú principal (capa HTML/CSS sobre el canvas).
import { t } from '../i18n/index.js';
import { h } from './dom.js';

export function MainMenu({ canContinue, onContinue, onPlay }) {
  const [first, ...rest] = t('app.title').split(' ');
  return h(
    'main',
    { class: 'screen menu' },
    h(
      'div',
      { class: 'menu__brand' },
      h('span', { class: 'tag' }, t('app.tagline')),
      h('h1', { class: 'logo' }, h('span', { class: 'logo__small' }, first), h('span', { class: 'logo__big' }, rest.join(' '))),
    ),
    h(
      'div',
      { class: 'menu__actions' },
      h('button', { class: 'btn btn--primary btn--big', onClick: onPlay }, h('span', { 'aria-hidden': 'true' }, '▶ '), t('menu.play')),
      canContinue && h('button', { class: 'btn btn--secondary', onClick: onContinue }, t('menu.continue')),
    ),
  );
}
