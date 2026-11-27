// El momento del final de ronda, a pantalla completa: el fondo se oscurece y difumina, entra el
// mensaje con un golpe ("¡Lo pillaste!") y después la tarjeta de quien perdió, con el corazón
// que se le rompe o la letra de QUISPE que se le marca. Si quedó fuera o terminó la partida,
// un mensaje más. Qué se cuenta lo decide src/app/moment.js; aquí solo se dibuja y se anima.
// Va fuera del HUD (en el body), porque cada redibujo lo borraría a media animación. Un toque
// pasa al siguiente mensaje; el último, lo cierra. Cada mensaje dura al menos lo que tardan sus
// sonidos (momentSounds de src/app/gameSounds.js), para que no se pisen con los del siguiente.
import { avatarFor } from '../app/characters.js';
import { LETTERS } from '../engine/modes.js';
import { hasText, t } from '../i18n/index.js';
import { h } from './dom.js';
import { lossUnit } from './format.js';

// Lo que dura cada mensaje en pantalla si nadie toca y sus sonidos no piden más
const BEAT_MS = { headline: 1900, loss: 2100, win: 2600 };
// Respiro entre el último sonido de un mensaje y el siguiente mensaje
const AFTER_SOUND_MS = 250;
const LEAVE_MS = 250;
// Cuándo cae el golpe sobre el corazón o la letra recién perdida: lo usan la animación (CSS,
// variable --golpe) y el sonido, para que caigan juntos
const HIT_MS = 720;

// Corazón en SVG partido en dos mitades, para que al perderlo cada una caiga por su lado.
// shortcut: dibujado en código; si Flavio hace sus imágenes del corazón, van aquí.
const HEART_PATH =
  'M12 21s-7.6-4.7-10-9.4C.4 8.3 2.3 4 6.3 4c2.3 0 3.8 1.3 5.7 3.4C13.9 5.3 15.4 4 17.7 4c4 0 5.9 4.3 4.3 7.6C19.6 16.3 12 21 12 21z';
const heartSvg = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', HEART_PATH);
  svg.append(path);
  return svg;
};
// state: 'full' (lo conserva), 'breaking' (se le acaba de ir) o 'gone' (ya lo había perdido)
const heart = (state) =>
  h('span', { class: `heart is-${state}` }, h('span', { class: 'heart__half heart__half--l' }, heartSvg()), h('span', { class: 'heart__half heart__half--r' }, heartSvg()));

// Corazones (por vidas) o letras de QUISPE (clásico y castigo), con lo recién perdido animado
function lossMarks({ lives, max, before, after, eliminated }) {
  if (lives) {
    // En el duelo final se rompen todos los que le quedaban
    const kept = eliminated ? 0 : after;
    return h(
      'div',
      { class: 'moment__hearts' },
      Array.from({ length: max }, (_, i) => heart(i < kept ? 'full' : i < before ? 'breaking' : 'gone')),
    );
  }
  const lost = eliminated ? LETTERS.length : after;
  return h(
    'div',
    { class: 'moment__letters' },
    [...LETTERS].map((letter, i) =>
      h('span', { class: `moment__letter${i < before ? ' is-lost' : i < lost ? ' is-lost is-new' : ''}` }, letter),
    ),
  );
}

function headlineBeat({ key, params, tone, reason }) {
  // En la Cholada, el porqué ("Se le acabó el tiempo") cuenta más que el subtítulo de siempre,
  // y va en la misma persona que el título
  const subKey = reason && hasText(`${key}.${reason}`) ? `${key}.${reason}` : `${key}.sub`;
  return h(
    'div',
    { class: `moment__beat moment--${tone}` },
    h('p', { class: 'moment__title' }, t(key, params)),
    hasText(subKey) && h('p', { class: 'moment__sub' }, t(subKey, params)),
  );
}

function lossBeat(loss, mode) {
  const cost = loss.lives ? loss.before - loss.after : loss.after - loss.before;
  const line = loss.eliminated
    ? t(`moment.out.${loss.self ? 'self' : 'other'}`, { name: loss.name })
    : t(`moment.loss.${loss.self ? 'self' : 'other'}`, { name: loss.name, n: cost, unit: lossUnit(mode, cost) });
  const avatar = avatarFor(loss.playerIndex);
  return h(
    'div',
    { class: `moment__beat moment__loss${loss.eliminated ? ' is-out' : ''}`, style: `--golpe: ${HIT_MS}ms` },
    avatar && h('img', { class: 'moment__avatar', src: avatar, alt: '', width: '96', height: '96' }),
    h('p', { class: 'moment__name' }, loss.name),
    lossMarks(loss),
    h('p', { class: 'moment__sub' }, line),
    loss.eliminated && loss.duel && h('p', { class: 'moment__note' }, t('moment.out.duel')),
    loss.penaltyText && h('p', { class: 'moment__note' }, t('result.penalty', { text: loss.penaltyText })),
  );
}

function winBeat(win) {
  const avatar = avatarFor(win.playerIndex);
  const key = `moment.win.${win.self ? 'self' : 'other'}`;
  return h(
    'div',
    { class: 'moment__beat moment--win' },
    avatar && h('img', { class: 'moment__avatar', src: avatar, alt: '', width: '96', height: '96' }),
    h('p', { class: 'moment__title' }, t(key, { name: win.name })),
    h('p', { class: 'moment__sub' }, t(`${key}.sub`)),
  );
}

// Muestra el momento y devuelve { close } para cerrarlo si la partida sigue antes de tiempo.
// `sounds` (opcional) es el de momentSounds: se le avisa cada mensaje y dice cuánto suena.
export function showRoundMoment(moment, mode, sounds = null) {
  const beats = [
    ['headline', headlineBeat(moment.headline)],
    ['loss', lossBeat(moment.loss, mode)],
    moment.win && ['win', winBeat(moment.win)],
  ].filter(Boolean);

  const overlay = h('div', { class: 'moment', role: 'status', 'aria-live': 'assertive' });
  let index = -1;
  let timer = null;
  let closed = false;

  function next() {
    clearTimeout(timer);
    index += 1;
    if (index >= beats.length) return close();
    const [name, beat] = beats[index];
    overlay.replaceChildren(beat);
    const soundMs = sounds?.[name](HIT_MS) ?? 0;
    timer = setTimeout(next, Math.max(BEAT_MS[name], soundMs + AFTER_SOUND_MS));
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    sounds?.stop();
    overlay.classList.add('is-leaving');
    setTimeout(() => overlay.remove(), LEAVE_MS);
  }

  overlay.addEventListener('click', next);
  document.body.append(overlay);
  next();
  return { close };
}
