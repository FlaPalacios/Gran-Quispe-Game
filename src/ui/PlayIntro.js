// Entrada al empezar una partida: la pantalla arranca en negro y se abre como un túnel
// mientras suena la cerveza. No tapa nada interactivo y se quita sola al terminar.
import { h } from './dom.js';

// Por si el navegador no dispara la animación (o está desactivada): no queremos una pantalla
// negra pegada para siempre
const SAFETY_MS = 3000;

export function PlayIntro() {
  const intro = h('div', { class: 'intro', 'aria-hidden': 'true' }, h('span', { class: 'intro__hole' }));
  const safety = setTimeout(() => intro.remove(), SAFETY_MS);
  // El túnel lo anima el agujero y el fundido el velo: vale cualquiera de las dos
  intro.addEventListener('animationend', () => {
    clearTimeout(safety);
    intro.remove();
  });
  return intro;
}
