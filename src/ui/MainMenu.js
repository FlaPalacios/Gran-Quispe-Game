// Menú principal (capa HTML/CSS sobre el canvas).
import logoUrl from '../assets/images/shared/logo.webp';
import { t } from '../i18n/index.js';
import { SoundToggle } from './SoundToggle.js';
import { h } from './dom.js';

// Formulario de Google para dejar una reseña (las respuestas le llegan a Flavio)
const REVIEW_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfBtfj6YqjdaPO_xjqGo15DyvepB0FS6tb7b5lQBKF_QoxndA/viewform';

export function MainMenu({ canContinue, onContinue, onPlay, onOnline, onHowTo, onSettings, onAbout, onRefresh }) {
  return h(
    'main',
    { class: 'screen menu' },
    h('div', { class: 'menu__corner' }, SoundToggle({ onChange: onRefresh })),
    // El logo ya viene recortado con transparencia; no se usa mix-blend-mode porque
    // el canvas de Phaser es otra capa de composición y el navegador no puede fundirse con él
    h('img', { class: 'logo', src: logoUrl, alt: t('app.title'), width: '1100', height: '1061' }),
    h(
      'div',
      { class: 'menu__actions' },
      h(
        'button',
        { class: 'btn btn--primary btn--big', onClick: onPlay, 'data-autofocus': true },
        h('span', { 'aria-hidden': 'true' }, '▶ '),
        t('menu.play'),
      ),
      h('button', { class: 'btn btn--secondary', onClick: onOnline }, t('menu.online')),
      canContinue && h('button', { class: 'btn btn--light', onClick: onContinue }, t('menu.continue')),
      h(
        'div',
        { class: 'menu__more' },
        h('button', { class: 'btn btn--light btn--small', onClick: onHowTo }, t('menu.howto')),
        h('button', { class: 'btn btn--light btn--small', onClick: onSettings }, t('menu.settings')),
      ),
      // Dos enlaces discretos al pie: quién lo hizo y dejar una reseña (en otra pestaña)
      h(
        'div',
        { class: 'menu__links' },
        h('button', { class: 'menu__link', onClick: onAbout }, t('menu.about')),
        h('a', { class: 'menu__link', href: REVIEW_FORM_URL, target: '_blank', rel: 'noopener' }, t('menu.review')),
      ),
    ),
  );
}
