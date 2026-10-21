// Constantes compartidas del motor de reglas.

export const PHASES = Object.freeze({
  ROLL: 'ROLL', // quien abre la ronda agita el cubilete
  CALL: 'CALL', // el jugador en turno canta una jugada
  DECIDE: 'DECIDE', // el siguiente cree o desconfía
  ROUND_OVER: 'ROUND_OVER', // se muestra el resultado; falta NEXT_ROUND
  GAME_OVER: 'GAME_OVER',
});

export const RESULTS = Object.freeze({
  DOUBT: 'DOUBT', // alguien desconfió y se destapó el cubilete
  CHOLADA: 'CHOLADA', // perdió por equivocarse (ver CHOLADA_REASONS); se destapa solo con la variante revealOnCholada
});

export const CHOLADA_REASONS = Object.freeze({
  LOWER_CALL: 'LOWER_CALL', // cantó igual o más bajo que la jugada anterior
  BELIEVED_QUISPE: 'BELIEVED_QUISPE', // creyó un Quispe: no hay nada más alto que cantar
  TIMEOUT: 'TIMEOUT', // se acabó el reloj de presión sin decidir
});
