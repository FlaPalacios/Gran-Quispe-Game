// Botón "Tirar": se mantiene presionado (o se toca varias veces) para sacudir el cubilete,
// y al soltarlo y dejarlo un momento quieto se tiran los dados. Con teclado, lector de
// pantalla o control por voz, cada activación es una sacudida.
import { t } from '../i18n/index.js';
import { h } from './dom.js';

// Cada cuánto se sacude mientras se mantiene presionado
const SHAKE_EVERY_MS = 280;
// Pausa sin tocar después de soltar: si vuelve a tocar antes, sigue sacudiendo
const THROW_AFTER_MS = 650;

// onThrow debe comprobar por su cuenta que la tirada sigue vigente: puede llegar después
// de que el HUD se redibuje (por ejemplo, al silenciar el sonido)
export function RollButton({ onShake, onThrow }) {
  let shaking = null;
  let throwing = null;
  let pointerId = null;
  // El click que llega después de soltar el dedo ya se atendió con los eventos de puntero
  let handledByPointer = false;

  const stopShaking = () => {
    clearInterval(shaking);
    shaking = null;
  };

  const shake = () => {
    clearTimeout(throwing);
    onShake();
  };
  const scheduleThrow = () => {
    clearTimeout(throwing);
    throwing = setTimeout(onThrow, THROW_AFTER_MS);
  };

  const press = (e) => {
    // Solo el dedo o el botón principal: un clic derecho o un segundo dedo no sacuden
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    pointerId = e.pointerId;
    handledByPointer = true;
    stopShaking();
    shake();
    // Si el botón deja de estar en pantalla (cambió el turno o se salió), deja de sacudir
    shaking = setInterval(() => (button.isConnected ? onShake() : stopShaking()), SHAKE_EVERY_MS);
  };
  const release = (e) => {
    if (shaking === null || e.pointerId !== pointerId) return;
    stopShaking();
    scheduleThrow();
  };
  const activate = () => {
    shake();
    scheduleThrow();
  };

  const button = h(
    'button',
    {
      class: 'btn btn--primary btn--big btn--hold',
      onPointerdown: press,
      onPointerup: release,
      onPointerleave: release,
      onPointercancel: release,
      onContextmenu: (e) => e.preventDefault(), // mantener presionado en el celular no abre el menú
      onKeydown: (e) => {
        if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
        e.preventDefault(); // evita además el click que generaría la tecla
        activate();
      },
      onClick: () => {
        if (handledByPointer) handledByPointer = false;
        else activate();
      },
    },
    t('game.roll'),
  );
  return button;
}
