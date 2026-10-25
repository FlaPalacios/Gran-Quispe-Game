// Reloj de la variante "Reloj de presión": corre al cantar y al decidir, que son las dos
// fases en las que el motor acepta TIMEOUT.
//
// El plazo no se guarda aquí: sale de turnStartedAt del store, así nunca se arrastra de una
// partida o un turno anterior. El intervalo es único en el módulo, así que el reloj se
// dibuja en un solo sitio a la vez (el panel de turno, o la hoja o el teclado que lo tapan).
import { PHASES } from '../engine/rules.js';
import { t } from '../i18n/index.js';
import { h } from './dom.js';

let clockInterval = null;

// Se llama antes de cada redibujo; PressureClock lo vuelve a crear si sigue haciendo falta
export function stopClock() {
  clearInterval(clockInterval);
  clockInterval = null;
}

export function PressureClock({ game, turnStartedAt }, store) {
  const { pressureClock: variant } = game.config.variants;
  if (!variant.enabled || turnStartedAt == null) return null;
  if (game.phase !== PHASES.CALL && game.phase !== PHASES.DECIDE) return null;

  const total = variant.seconds * 1000;
  const deadline = turnStartedAt + total;
  const label = h('span', { class: 'timer__label' });
  const bar = h('span', { class: 'timer__bar' });
  const tick = () => {
    const remaining = Math.max(0, deadline - Date.now());
    label.textContent = t('game.timeLeft', { s: Math.ceil(remaining / 1000) });
    bar.style.width = `${(remaining / total) * 100}%`;
    return remaining;
  };
  tick();
  stopClock();
  const { currentPlayerId: playerId, phase } = game;
  clockInterval = setInterval(() => {
    if (tick() > 0) return;
    stopClock();
    // Solo si sigue siendo el mismo momento (el motor también lo valida)
    const { game: now } = store.get();
    if (now?.phase === phase && now.currentPlayerId === playerId) store.dispatch({ type: 'TIMEOUT', playerId });
  }, 200);
  return h('div', { class: 'timer', role: 'timer' }, h('span', { class: 'timer__track' }, bar), label);
}
