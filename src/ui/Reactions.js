// Reacciones rápidas del modo online: un sticker que ven todos en la sala.
// Las que hay salen de los archivos reaccion-*.webp; el servidor acepta las mismas (REACTIONS
// en server/rooms.js), así que un sticker nuevo se suma en los dos lados.
import { t } from '../i18n/index.js';
import { h } from './dom.js';

const files = import.meta.glob('../assets/images/shared/reaccion-*.webp', { eager: true, query: '?url', import: 'default' });
const STICKERS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.match(/reaccion-(\w+)\.webp$/)[1], url]));
// Lo que dura un sticker en pantalla (la animación de styles.css dura lo mismo)
const SHOW_MS = 2600;

// El botón de la barra superior y, abierto, la fila de stickers para elegir.
// `open` vive fuera (en app.js): si no, cada aviso del store lo cerraría.
export function ReactionPicker({ open, onToggle, onPick }) {
  return h(
    'details',
    { class: 'reactions', open, onToggle: (e) => onToggle(e.target.open) },
    h('summary', { class: 'btn btn--light btn--icon', 'aria-label': t('reaction.open') }, h('img', { src: STICKERS.risa, alt: '', width: '28', height: '28' })),
    h(
      'div',
      { class: 'reactions__list' },
      Object.entries(STICKERS).map(([name, url]) =>
        h('button', { class: 'reactions__pick', 'aria-label': t(`reaction.${name}`), onClick: () => onPick(name) }, h('img', { src: url, alt: '', width: '56', height: '56' })),
      ),
    ),
  );
}

// Un sticker que llega: aparece sobre la escena con el nombre de quien lo mandó y se va solo.
// Va fuera del HUD, porque cada redibujo lo borraría a media animación.
export function showReaction({ name, reaction }) {
  if (!STICKERS[reaction]) return;
  let feed = document.querySelector('.reaction-feed');
  if (!feed) {
    feed = h('div', { class: 'reaction-feed', role: 'status' });
    document.body.append(feed);
  }
  const toast = h(
    'div',
    { class: 'reaction-toast' },
    h('img', { src: STICKERS[reaction], alt: t(`reaction.${reaction}`), width: '84', height: '84' }),
    h('span', {}, name),
  );
  feed.append(toast);
  setTimeout(() => toast.remove(), SHOW_MS);
}
