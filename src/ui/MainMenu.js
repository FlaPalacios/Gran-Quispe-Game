// Menú principal (capa HTML/CSS sobre el canvas).
import logoUrl from '../assets/images/shared/logo.webp';
import { t } from '../i18n/index.js';
import { SoundToggle } from './SoundToggle.js';
import { h } from './dom.js';

export function MainMenu({ canContinue, onContinue, onPlay, onRefresh }) {
  return h(
    'main',
    { class: 'screen menu' },
    h('div', { class: 'menu__corner' }, SoundToggle({ onChange: onRefresh })),
    // El logo ya viene recortado con transparencia; no se usa mix-blend-mode porque
    // el canvas de Phaser es otra capa de composición y el navegador no puede fundirse con él
    h('img', { class: 'logo', src: logoUrl, alt: t('app.title'), width: '1100', height: '733' }),
    h(
      'div',
      { class: 'menu__actions' },
      h(
        'button',
        { class: 'btn btn--primary btn--big', onClick: onPlay, 'data-autofocus': true },
        h('span', { 'aria-hidden': 'true' }, '▶ '),
        t('menu.play'),
      ),
      canContinue && h('button', { class: 'btn btn--secondary', onClick: onContinue }, t('menu.continue')),
    ),
  );
}
