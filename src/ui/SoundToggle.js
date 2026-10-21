// Botón de silencio, compartido por el menú y la mesa.
import { isMuted, setMuted } from '../app/audio.js';
import { t } from '../i18n/index.js';
import { h } from './dom.js';

export function SoundToggle({ onChange }) {
  const muted = isMuted();
  return h(
    'button',
    {
      class: 'btn btn--light btn--icon',
      // La etiqueta nombra siempre la misma acción y aria-pressed dice si está activa,
      // para que un lector de pantalla no anuncie lo contrario del estado real
      'aria-pressed': String(muted),
      'aria-label': t('sound.mute'),
      title: t(muted ? 'sound.unmute' : 'sound.mute'),
      onClick: () => {
        setMuted(!muted);
        onChange(); // al reactivarlo, el clic lo reproduce el delegado de src/ui/app.js
      },
    },
    h('span', { 'aria-hidden': 'true' }, muted ? '🔇' : '🔊'),
  );
}
