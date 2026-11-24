// "Cómo se juega": lo esencial para quien nunca jugó, en pocas líneas y con los dados a la vista.
// Lo que dice sale de las reglas de CLAUDE.md; los textos, de i18n.
import { t } from '../i18n/index.js';
import { card, screen } from './RulesPanel.js';
import { h } from './dom.js';

const diceFiles = import.meta.glob('../assets/images/shared/dado-*.webp', { eager: true, query: '?url', import: 'default' });
const die = (n) => h('img', { class: 'howto__die', src: diceFiles[`../assets/images/shared/dado-${n}.webp`], alt: '', width: '40', height: '40' });

// Una jugada dibujada: los dos dados y lo que se canta
const play = (a, b, label) =>
  h('span', { class: 'howto__play', role: 'img', 'aria-label': t('howto.diceLabel', { a, b, label }) }, die(a), die(b), h('strong', { 'aria-hidden': 'true' }, `= ${label}`));

const step = (n, title, ...body) =>
  h('li', { class: 'howto__step' }, h('span', { class: 'howto__n', 'aria-hidden': 'true' }, n), h('div', {}, h('strong', {}, title), ...body));

const text = (key) => h('p', {}, t(key));
// "Creo: …" con la palabra del botón resaltada, para que se reconozca en la mesa
const option = (button, key) => h('p', {}, h('b', { class: 'howto__option' }, `${t(button)}: `), t(key));

export function HowToPlay({ onBack, onPlay }) {
  return screen({
    title: t('howto.title'),
    onBack,
    body: [
      card(
        t('howto.round'),
        h(
          'ol',
          { class: 'howto__steps' },
          step('1', t('howto.roll'), text('howto.roll.text')),
          step('2', t('howto.call'), text('howto.call.text'), play(4, 2, '42')),
          step('3', t('howto.decide'), option('game.believe', 'howto.believe'), option('game.doubt', 'howto.doubt')),
        ),
      ),
      card(
        t('howto.scale'),
        h(
          'ol',
          { class: 'howto__scale' },
          h('li', {}, h('strong', {}, t('howto.scale.common')), h('span', {}, '31 · 32 · 41 … 64 · 65')),
          h('li', {}, h('strong', {}, t('howto.scale.pairs')), h('span', {}, '11 · 22 · 33 · 44 · 55 · 66')),
          h('li', {}, h('strong', {}, t('call.quispe')), play(2, 1, t('call.quispe')), h('span', {}, t('howto.scale.quispe'))),
        ),
      ),
      card(t('howto.cholada'), text('howto.cholada.text'), text('howto.believedQuispe')),
      card(t('howto.win'), text('howto.win.text')),
    ],
    footer: h('button', { class: 'btn btn--primary btn--big', onClick: onPlay }, t('howto.play')),
  });
}
