// Teclado para cantar la jugada, como el bloque numérico del celular: se escribe el número
// y se confirma con Cantar. Es lo que sale por defecto; con la preferencia apagada sale la
// hoja con todas las jugadas (CallSheet).
//
// Nada canta de un toque: ni el Quispe, ni el atajo de la jugada que salió. Los tres botones
// de abajo (Quispe, lo que salió y Cantar) van en una sola fila para que el panel entre
// entero en la pantalla, sin tener que deslizarlo.
import { viewerCanSeeDice } from '../app/gameStore.js';
import { QUISPE, readDice } from '../engine/dice.js';
import { getLastCall } from '../engine/rules.js';
import { t } from '../i18n/index.js';
import { PressureClock } from './PressureClock.js';
import { h } from './dom.js';
import { formatCall } from './format.js';

// Tres dígitos: los pares se cantan completos (110 a 160)
const MAX_DIGITS = 3;
const DIGITS = [1, 2, 3, 4, 5, 6, 0];

export function CallKeypad({ snapshot, store, onPick, onCancel }) {
  // Quien canta ya vio sus dados, así que tiene a mano la jugada que le salió
  const dice = viewerCanSeeDice(snapshot) ? snapshot.game.round.dice : null;
  const actual = dice ? readDice(dice) : null;
  // Si lo que salió es Quispe no hay número que ofrecer: su botón se queda con el sitio
  const rolledQuispe = actual === QUISPE;
  const showShortcut = Boolean(actual) && !rolledQuispe;
  // El panel de turno queda tapado por la hoja: la jugada a superar se repite aquí
  const last = getLastCall(snapshot.game);

  let typed = '';
  let quispe = false;

  // Vacío queda vacío: los puntos de "todavía no escribiste nada" los pone el CSS, para que
  // un lector de pantalla no los lea como contenido
  const display = h('output', { class: 'keypad__display', 'aria-live': 'polite' });
  const quispeButton = h(
    'button',
    {
      class: `btn keypad__quispe${rolledQuispe ? ' is-now' : ''}${showShortcut ? '' : ' is-wide'}`,
      'aria-label': rolledQuispe ? t('game.keypad.quispeIsNow') : null,
      onClick: () => chooseQuispe(),
    },
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
  const chooseQuispe = () => {
    quispe = true;
    typed = '';
    refresh();
  };
  // El atajo no canta: escribe el número en la pantallita, como si lo hubieras tecleado
  const chooseActual = () => {
    quispe = false;
    typed = String(actual);
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
    else if (e.key === 'Enter') {
      // Con el foco en un botón manda el botón: si no, Enter cantaría lo de antes
      if (e.target.closest('button') || callButton.disabled) return;
      confirm();
    } else if (e.key === 'Backspace') erase();
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
        { class: 'keypad__value' },
        h(
          'span',
          { class: 'keypad__label' },
          last ? t('game.call.raiseHint', { call: formatCall(last.value) }) : t('game.pickCall'),
        ),
        display,
      ),
      h(
        'div',
        { class: 'keypad__grid' },
        DIGITS.slice(0, 3).map(digitKey),
        h('button', { class: 'btn btn--light keypad__key', onClick: erase, 'aria-label': t('game.keypad.erase') }, '⌫'),
        DIGITS.slice(3).map(digitKey),
      ),
      h(
        'div',
        { class: 'keypad__actions' },
        quispeButton,
        showShortcut &&
          h(
            'button',
            { class: 'btn keypad__actual', onClick: chooseActual, 'aria-label': t('game.keypad.actual', { call: actual }) },
            String(actual),
          ),
        callButton,
      ),
    ),
  );
}
