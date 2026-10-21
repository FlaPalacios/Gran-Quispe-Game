---
name: codigo-limpio-quispe
description: Reglas de arquitectura y convenciones de código de Gran Quispe (separación motor/vista, nombres, cómo agregar una variante de reglas). Usar siempre que se escriba, modifique o revise cualquier código del proyecto.
---

# Código limpio en Gran Quispe

## Regla de oro: el motor de reglas es la única fuente de verdad

```
Capa de UI ──acciones──▶ Motor de reglas ◀──jugadas── Gestor de bots
                              │
              ┌─── estado ────┴──── guarda y carga ───┐
              ▼                                       ▼
     Motor visual (Phaser) ◀── assets ── Gestor de assets     Guardado local
```

- `src/engine/` no importa Phaser, no toca el DOM, no usa `localStorage`, `setTimeout` ni `Math.random`. Es código puro que también correrá en un servidor Node en el modo online.
- La UI (`src/ui/`), las escenas (`src/scenes/`) y los bots (`src/engine/bots.js`) solo **leen el estado** o **envían acciones**. Ninguno modifica el estado ni decide reglas.
- `src/storage/localSave.js` es el único archivo que toca `localStorage`.
- El azar (`rng`) y el tiempo (`now`) se inyectan al motor como datos.
- El estado de la partida es JSON plano y serializable.

## Información oculta

En modo "un solo celular", los dados de un jugador solo se muestran después de que ese jugador confirma la pantalla "pásale el celular". Cualquier atajo que lo salte es un bug.

## Convenciones de nombres

- Código (variables, funciones, archivos JS): inglés, `camelCase` para funciones y variables, `PascalCase` para clases y escenas (`CantinaScene`), `UPPER_SNAKE_CASE` para constantes.
- Términos del dominio con nombre fijo en código: `call` (jugada cantada), `roll` (jugada real), `believe` / `doubt` (creer / desconfiar), `quispe` (jugada 2-1), `penalty` (castigo), `lives` (vidas), `letters` (letras QUISPE acumuladas).
- Acciones del motor: objetos `{ type: 'DOUBT', playerId, now }` con `type` en `UPPER_SNAKE_CASE`.
- Comentarios y textos de commit: español.
- Textos visibles al jugador: nunca en el código; siempre claves de `src/i18n/{es,en,qu}.json` (formato `seccion.clave`).
- Tests junto al archivo: `rules.js` → `rules.test.js`.

## Cómo agregar una nueva variante al panel de reglas

Una variante nueva no debe obligar a tocar el motor visual.

1. Registrarla en `src/engine/variants.js` con: `id`, `default` (on/off), parámetros configurables con su valor por defecto y rango, y los hooks del motor que modifica (por ejemplo, cuántas letras o vidas cuesta perder).
2. Escribir sus tests en `src/engine/variants.test.js`.
3. Agregar sus textos (`variants.<id>.name`, `variants.<id>.description`) en los tres archivos de `src/i18n/`.
4. `src/ui/RulesPanel.js` genera los controles leyendo el registro de variantes, así que no requiere cambios.
5. Si la variante necesita un elemento visual nuevo (por ejemplo, el reloj de presión), la escena lo dibuja leyendo el estado; nunca calcula la regla.

## Antes de cerrar una tarea

- `npm test` pasa.
- `npm run build` compila.
- Delegar una revisión al subagente `code-reviewer`.
