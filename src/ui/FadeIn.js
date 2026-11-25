// Fundido desde negro: la pantalla aparece desde el fondo oscuro. Lento al empezar la partida
// (mientras suena la cerveza) y rápido cada vez que se pasa el celular o se vuelve a la mesa.
// Es un velo encima de todo que no tapa nada interactivo y se quita solo al terminar.
import { h } from './dom.js';

// Por si el navegador no dispara la animación: no queremos un velo negro pegado para siempre
const SAFETY_MS = 2000;

export function FadeIn({ slow = false } = {}) {
  const veil = h('div', { class: `fade-in${slow ? ' fade-in--slow' : ''}`, 'aria-hidden': 'true' });
  const safety = setTimeout(() => veil.remove(), SAFETY_MS);
  veil.addEventListener('animationend', () => {
    clearTimeout(safety);
    veil.remove();
  });
  return veil;
}
