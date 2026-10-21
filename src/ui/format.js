// Formatos de presentación compartidos por las pantallas.
import { QUISPE } from '../engine/dice.js';
import { t } from '../i18n/index.js';

export const formatCall = (value) => (value === QUISPE ? t('call.quispe') : String(value));

export const modeName = (mode) => t(`mode.${mode}`);

export function lossUnit(mode, cost) {
  if (mode === 'lives') return t(cost === 1 ? 'unit.life' : 'unit.lives');
  return t(cost === 1 ? 'unit.letter' : 'unit.letters');
}

export const playerName = (game, id) => game.players.find((p) => p.id === id)?.name ?? '';
