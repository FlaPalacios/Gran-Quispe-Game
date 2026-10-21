# Fondos: cómo hacerlos para que la mesa cuadre

Guía para generar el fondo nuevo de la cantina (y después los del bar universitario y el paisaje andino). Resuelve lo que se ve mal hoy: la mesa y el personaje parecen pegados encima del fondo en vez de estar dentro de la escena.

## Por qué hoy no cuadra

El fondo actual está tomado **de pie**, mirando hacia abajo: se ve mucho piso y las mesas de la cantina quedan lejos y chiquitas. La mesa del juego, en cambio, se dibuja **a la altura de tus ojos sentado**. Son dos puntos de vista distintos en la misma imagen, y el ojo lo nota enseguida.

No es culpa de la ilustración, que está muy bien: es que fue pensada como "foto del local" y necesitamos "lo que ves desde tu silla".

## La regla principal

**El fondo no lleva la mesa de juego.** La mesa la dibuja el juego y se adapta al tamaño de la pantalla, así que si el fondo trae su propia mesa, en unas pantallas calzarán y en otras se verán dos mesas corridas. El fondo es el telón: pared, barra, estantes, ventana, banderines.

## Las cuatro cosas que hacen que cuadre

1. **Punto de vista sentado.** La cámara va a la altura de alguien sentado a la mesa, mirando al frente, no hacia abajo. Como referencia: la barra y las sillas se ven de costado, no desde arriba.

2. **El tercio de abajo, en penumbra y sin detalle.** Ahí va la mesa del juego (y en celular, el panel de botones). Si pones muebles, cajas o baldosas con mucho dibujo, van a chocar con la mesa. Lo ideal es que esa franja sea piso y pared en sombra, apenas sugeridos.

3. **El centro de abajo, despejado.** Nada de mesas, sillas ni macetas justo al centro. Ahí se sienta el personaje y se apoya la mesa.

4. **Lo interesante, en la franja del medio.** Barra, estantes con botellas, ventana, banderines, cuadros: todo entre el 25 % y el 70 % de la altura. Lo de más arriba (techo, vigas) se recorta en pantallas anchas, y lo de más abajo queda tapado por la mesa.

## Formato

| Qué | Valor |
| --- | --- |
| Tamaño | 2560 × 2560 px (cuadrado) |
| Archivo | `src/assets/images/cantina/cantina-fondo.webp` |
| Zona que siempre se ve | el 60 % central del ancho |
| Anclaje | el juego apoya el fondo **por abajo**: el borde inferior de la imagen siempre se ve |

Es cuadrado porque en celular se ve una franja vertical y en PC una horizontal. Lo que está en los bordes izquierdo y derecho se pierde en celular, así que no pongas nada importante ahí.

## Prompt sugerido

```
Flat 2D cartoon illustration with painted lighting, bold black outlines on foreground objects,
limited palette: warm black #120d0a, dark wood brown #6b3f24, amber #ffc46e, toasted orange #f2a33a,
cream #f4ead7, burnt red #c23a2b, colonial blue #2f5d9e, dull gold #f2c230.

Interior of a cozy night cantina in Cusco, Peru, seen from the eye level of someone SITTING at a
table — a straight-on view, not looking down at the floor. Adobe walls with an andean textile,
a wooden bar counter with bottles on shelves to one side, an arched window with a deep blue night
sky, colorful paper bunting overhead, a warm hanging lamp.

The bottom third of the image is dark and almost empty: floor and wall in deep shadow, no furniture,
no tables, no chairs, no detail. The center of the lower half is completely clear.
All the interesting detail sits in the middle band of the image.

Square 1:1 composition. No text. No people. No table in the foreground.
```

Si la IA insiste en poner una mesa adelante, agrega: `empty foreground, nothing between the viewer and the back wall`.

## Para probar sin rehacer el juego

Guarda la imagen con el nombre de arriba y abre `http://localhost:5173/galeria.html`: ahí la ves sobre los colores del juego y con su tamaño real. Después abre el juego y empieza una partida para verla con la mesa encima. Si no cuadra, lo que hay que mover casi siempre es la altura del horizonte, no la mesa.

## Si además quieres hacer la mesa y el cubilete

Hoy se dibujan por código y por eso se ven planos al lado del fondo pintado. Hacerlos como imagen los integraría mucho mejor. Si los haces:

| Asset | Archivo | Tamaño | Cómo |
| --- | --- | --- | --- |
| Mesa | `images/shared/mesa.webp` | 1600 × 900 px | Vista desde la altura de alguien sentado, ligeramente desde arriba. Madera y paño ya pintados, con su sombra. Fondo transparente. El paño centrado, ocupando el 80 % del ancho de la imagen |
| Cubilete | `images/shared/cubilete.webp` | 400 × 500 px | De frente, boca abajo, con su sombra propia. Fondo transparente |
| Dados | `images/shared/dado-1.webp` … `dado-6.webp` | 200 × 200 px | De frente, mismo ángulo que el cubilete |

Lo importante es que la mesa, el cubilete y los dados estén **iluminados desde el mismo lado** que el fondo (en la cantina actual, la luz viene de arriba a la derecha).

Avísame cuando tengas la mesa y conecto el juego para que use la imagen en vez del dibujo por código.
