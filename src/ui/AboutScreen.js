// "Acerca del juego": el banner con el logo, quién lo hizo, cómo contactarlo y los créditos.
// El detalle de cada asset (archivo por archivo y su licencia) está en recursos-fv/creditos.md;
// aquí va lo que hay que nombrar en pantalla.
import bannerUrl from '../assets/images/shared/banner.webp';
import gmailIcon from '../assets/images/shared/icono-gmail.webp';
import instagramIcon from '../assets/images/shared/icono-instagram.webp';
import logoUrl from '../assets/images/shared/logo.webp';
import { t } from '../i18n/index.js';
import { card, screen } from './RulesPanel.js';
import { h } from './dom.js';

// Contacto de Flavio: el correo sirve también para avisar de errores (llega con el asunto puesto)
const CONTACT_LINKS = [
  { icon: gmailIcon, label: 'flavioalejandro99@gmail.com', url: 'mailto:flavioalejandro99@gmail.com?subject=Gran%20Quispe' },
  { icon: instagramIcon, label: '@flaviopr_', url: 'https://www.instagram.com/flaviopr_/' },
];

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
        h('p', { class: 'about__hint' }, t('about.contact')),
        h(
          'ul',
          { class: 'about__links' },
          CONTACT_LINKS.map(({ icon, label, url }) =>
            h(
              'li',
              {},
              h(
                'a',
                { class: 'about__link', href: url, target: '_blank', rel: 'noopener' },
                h('img', { src: icon, alt: '', width: '22', height: '22' }),
                label,
              ),
            ),
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
