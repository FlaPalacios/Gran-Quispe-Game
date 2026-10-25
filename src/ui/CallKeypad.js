// Teclado para cantar la jugada, como el bloque numérico del celular: se escribe el número
// y se confirma con Cantar. Es lo que sale por defecto; con la preferencia apagada sale la
// hoja con todas las jugadas (CallSheet).
//
// El Quispe tiene su propio botón porque en la mesa se canta por su nombre: escribir 21 es
// una jugada que no existe, y eso lo resuelve el motor (Cholada), no este teclado. Elegirlo
// tampoco canta de un toque: se escribe en la pantallita y se confirma como cualquier otra,
// porque cantar Quispe no tiene vuelta atrás.
import { viewerCanSeeDice } from '../app/gameStore.js';
import { QUISPE, readDice } from '../engine/dice.js';
import { t } from '../i18n/index.js';
import { PressureClock } from './PressureClock.js';
import { h } from './dom.js';
import { formatCall } from './format.js';

// Tres dígitos: los pares se cantan completos (110 a 160)
const MAX_DIGITS = 3;
const DIGITS = [1, 2, 3, 4, 5, 6, 0];

export function CallKeypad({ snapshot, store, onPick, onCancel }) {
  // Quien canta ya vio sus dados, así que puede cantar lo que salió sin volver a escribirlo
  const dice = viewerCanSeeDice(snapshot) ? snapshot.game.round.dice : null;
  const actual = dice ? readDice(dice) : null;

  let typed = '';
  let quispe = false;

  // Vacío queda vacío: los puntos de "todavía no escribiste nada" los pone el CSS, para que
  // un lector de pantalla no los lea como contenido
  const display = h('output', { class: 'keypad__display', 'aria-live': 'polite' });
  const quispeButton = h(
    'button',
    { class: `btn keypad__quispe${actual === QUISPE ? ' is-now' : ''}`, onClick: () => choose() },
    t('call.quispe'),
  );
  const callButton = h('button', { class: 'btn btn--primary keypad__call', onClick: () => confirm() }, t('game.call'));

  const refresh = () => {
    display.textContent = quispe ? t('call.quispe') : typed;
    quispeButton.classList.toggle('is-picked', quispe);
    callButton.disabled = !quispe && typed === '';
  };
  const press = (digit) => {
    if (typed.length >= MAX_DIGITS) return;
    quispe = false;
    typed += digit;
    refresh();
  };
  const erase = () => {
    if (quispe) quispe = false;
    else typed = typed.slice(0, -1);
    refresh();
  };
  const choose = () => {
    quispe = true;
    typed = '';
    refresh();
  };
  const confirm = () => {
    if (quispe) onPick(QUISPE);
    else if (typed !== '') onPick(Number(typed), { asNumber: true });
  };
  refresh();

  // En PC se espera poder escribir con el teclado de verdad
  const onKeydown = (e) => {
    if (e.key === 'Escape') onCancel();
    else if (e.key === 'Enter' && !callButton.disabled) confirm();
    else if (e.key === 'Backspace') erase();
    else if (/^[0-6]$/.test(e.key)) press(Number(e.key));
    else return;
    e.preventDefault();
  };

  const digitKey = (digit) =>
    h('button', { class: 'btn btn--light keypad__key', onClick: () => press(digit) }, String(digit));

  return h(
    'div',
    {
      class: 'sheet-backdrop',
      onClick: (e) => e.target === e.currentTarget && onCancel(),
      onKeydown,
    },
    h(
      'div',
      {
        class: 'sheet keypad',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('game.pickCall'),
        tabindex: '-1',
        'data-autofocus': true,
      },
      PressureClock(snapshot, store),
      h(
        'div',
        { class: 'keypad__screen' },
        h('button', { class: 'btn btn--light btn--icon', onClick: onCancel, 'aria-label': t('game.cancel') }, '✕'),
        h('div', { class: 'keypad__value' }, h('span', { class: 'keypad__label' }, t('game.pickCall')), display),
      ),
      // Los dígitos arriba y, bien separados de ellos, los dos botones que cierran la jugada
      h(
        'div',
        { class: 'keypad__grid' },
        DIGITS.slice(0, 3).map(digitKey),
        h('button', { class: 'btn btn--light keypad__key', onClick: erase, 'aria-label': t('game.keypad.erase') }, '⌫'),
        DIGITS.slice(3).map(digitKey),
        quispeButton,
        callButton,
      ),
      actual &&
        h(
          'button',
          { class: 'btn btn--light keypad__actual', onClick: () => onPick(actual) },
          t('game.keypad.actual', { call: formatCall(actual) }),
        ),
    ),
  );
}
