// "Acerca del juego": el banner con el logo, quién lo hizo, cómo contactarlo y los créditos.
// El detalle de cada asset (archivo por archivo y su licencia) está en recursos-fv/creditos.md;
// aquí va lo que hay que nombrar en pantalla.
import bannerUrl from '../assets/images/shared/banner.webp';
import logoUrl from '../assets/images/shared/logo.webp';
import { t } from '../i18n/index.js';
import { card, screen } from './RulesPanel.js';
import { h } from './dom.js';

// Redes y contacto de Flavio: { label, url }. La tarjeta no se muestra mientras esté vacía.
const CONTACT_LINKS = [];

// Créditos en pantalla: clave de i18n de qué se hizo y con qué
const CREDITS = ['art', 'music', 'voices', 'sounds', 'fonts', 'code'];

export function AboutScreen({ onBack }) {
  return screen({
    title: t('about.title'),
    onBack,
    body: [
      h(
        'figure',
        { class: 'about__banner' },
        h('img', { class: 'about__banner-art', src: bannerUrl, alt: '', width: '1600', height: '837' }),
        h('img', { class: 'about__banner-logo', src: logoUrl, alt: t('app.title'), width: '1100', height: '1061' }),
      ),
      card(t('about.game'), h('p', {}, t('about.game.text'))),
      card(
        t('about.author'),
        h('p', {}, t('about.author.text')),
        CONTACT_LINKS.length > 0 &&
          h(
            'ul',
            { class: 'about__links' },
            CONTACT_LINKS.map(({ label, url }) =>
              h('li', {}, h('a', { class: 'btn btn--light btn--small', href: url, target: '_blank', rel: 'noopener' }, label)),
            ),
          ),
      ),
      card(
        t('about.credits'),
        h(
          'dl',
          { class: 'about__credits' },
          CREDITS.flatMap((key) => [h('dt', {}, t(`about.credits.${key}`)), h('dd', {}, t(`about.credits.${key}.text`))]),
        ),
      ),
    ],
  });
}
