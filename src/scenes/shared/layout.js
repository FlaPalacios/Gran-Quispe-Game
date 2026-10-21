// Distribución responsiva compartida por las tres escenas.
// El breakpoint debe coincidir con la media query de src/ui/styles.css.
export const DESKTOP_MIN_WIDTH = 1024;

export function getLayout(width, height) {
  // El >= iguala a la media query de styles.css, donde "landscape" incluye la ventana cuadrada
  const isDesktop = width >= DESKTOP_MIN_WIDTH && width >= height;

  if (isDesktop) {
    // Escritorio: mesa a la izquierda, HUD (HTML) en una columna a la derecha
    const margin = 32;
    const panelWidth = Math.min(Math.max(width * 0.36, 360), 520);
    return {
      isDesktop,
      table: {
        x: margin,
        y: margin,
        width: width - panelWidth - margin * 3,
        height: height - margin * 2,
      },
    };
  }

  // Celular: una columna, mesa arriba y HUD (jugadores y botones) abajo.
  // El tope de la mesa coincide con --mesa-arriba de styles.css: max(9%, 60px)
  const margin = Math.round(width * 0.04);
  return {
    isDesktop,
    table: {
      x: margin,
      y: Math.max(Math.round(height * 0.09), 60),
      width: width - margin * 2,
      height: Math.round(height * 0.42),
    },
  };
}
