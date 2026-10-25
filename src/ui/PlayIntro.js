// Entrada al empezar una partida: la pantalla arranca en negro y se abre como un túnel
// mientras suena la cerveza. No tapa nada interactivo y se quita sola al terminar.
import { h } from './dom.js';

// Por si el navegador no dispara la animación (o está desactivada): no queremos una pantalla
// negra pegada para siempre
const SAFETY_MS = 3000;

export function PlayIntro() {
  const hole = h('span', { class: 'intro__hole' });
  const intro = h('div', { class: 'intro', 'aria-hidden': 'true' }, hole);
  const safety = setTimeout(() => intro.remove(), SAFETY_MS);
  const done = () => {
    clearTimeout(safety);
    intro.remove();
  };
  // Cada forma de abrir tiene su animación: el túnel en el agujero, el fundido en el marco
  hole.addEventListener('animationend', done);
  intro.addEventListener('animationend', (e) => e.target === intro && done());
  return intro;
}
