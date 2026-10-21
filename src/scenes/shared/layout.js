// Distribución responsiva compartida por las tres escenas.
// El breakpoint debe coincidir con la media query de src/ui/styles.css.
export const DESKTOP_MIN_WIDTH = 1024;

// En monitores anchos el escenario no se estira de lado a lado: se queda en una caja centrada
// y los costados quedan en penumbra. El límite es doble, y ambos deben coincidir
// con --escenario-ancho de styles.css:
//  - un ancho máximo en píxeles, para monitores muy grandes;
//  - una proporción máxima, para no recortar de más el fondo, que es cuadrado.
export const MAX_STAGE_WIDTH = 1500;
export const MAX_STAGE_RATIO = 1.8;

export function getLayout(width, height) {
  // El >= iguala a la media query de styles.css, donde "landscape" incluye la ventana cuadrada
  const isDesktop = width >= DESKTOP_MIN_WIDTH && width >= height;

  const stageWidth = Math.min(width, MAX_STAGE_WIDTH, Math.max(height * MAX_STAGE_RATIO, DESKTOP_MIN_WIDTH));
  const stage = { x: Math.round((width - stageWidth) / 2), y: 0, width: stageWidth, height };

  if (isDesktop) {
    // Escritorio: mesa a la izquierda, HUD (HTML) en una columna a la derecha
    const margin = 32;
    const panelWidth = Math.min(Math.max(stage.width * 0.36, 360), 520);
    return {
      stage,
      isDesktop,
      table: {
        x: stage.x + margin,
        y: margin,
        width: stage.width - panelWidth - margin * 3,
        height: height - margin * 2,
      },
    };
  }

  // Celular: una columna, mesa arriba y HUD (jugadores y botones) abajo.
  // El tope de la mesa coincide con --mesa-arriba de styles.css: max(9%, 60px)
  const margin = Math.round(stage.width * 0.04);
  return {
    stage,
    isDesktop,
    table: {
      x: stage.x + margin,
      y: Math.max(Math.round(height * 0.09), 60),
      width: stage.width - margin * 2,
      height: Math.round(height * 0.42),
    },
  };
}
