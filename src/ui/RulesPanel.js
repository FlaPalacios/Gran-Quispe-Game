// Paneles de configuración, en dos pantallas para no enredar a quien solo quiere jugar:
// - Nueva partida (botón Jugar): jugadores, modo y escenario.
// - Configuración (desde el menú): variantes de reglas y preferencias de pantalla y sonido.
//   Lo que se elige ahí se guarda y vale para las partidas siguientes.
// Las variantes se generan desde engine/variants.js: agregar una nueva no requiere tocar este archivo,
// solo sus textos en i18n.
import { setMusicOn } from '../app/audio.js';
import { getPreference, setPreference } from '../app/preferences.js';
import { MAX_LIVES, MIN_LIVES, DEFAULT_LIVES, MODES } from '../engine/modes.js';
import { MAX_PLAYERS, MIN_PLAYERS, SCENARIOS } from '../engine/rules.js';
import { VARIANTS, resolveVariants } from '../engine/variants.js';
import { PERSONALITIES } from '../engine/bots.js';
import { t } from '../i18n/index.js';
import { h } from './dom.js';

const DEFAULT_PLAYER_COUNT = 4;
const HUMAN = 'human';

export function defaultDraft() {
  return {
    mode: 'classic',
    scenario: SCENARIOS[0],
    lives: DEFAULT_LIVES,
    penaltyText: '',
    names: Array.from({ length: DEFAULT_PLAYER_COUNT }, () => ''),
    // Quién juega cada asiento: 'human' o la personalidad de un bot
    kinds: Array.from({ length: DEFAULT_PLAYER_COUNT }, () => HUMAN),
    variants: savedVariants(),
  };
}

// Las variantes elegidas en Configuración. Si lo guardado ya no encaja (cambió una variante
// entre versiones del juego), se vuelve a las de por defecto.
function savedVariants() {
  try {
    return resolveVariants(getPreference('variants') ?? {});
  } catch {
    return resolveVariants();
  }
}

// Nombre de un asiento que se dejó vacío
const defaultName = (kind, i) =>
  kind === HUMAN ? t('setup.defaultName', { n: i + 1 }) : t('setup.botName', { name: t(`bot.${kind}.short`), n: i + 1 });

// Convierte el borrador del panel en la entrada de createGame
export function draftToSetup(draft) {
  return {
    config: {
      mode: draft.mode,
      scenario: draft.scenario,
      lives: draft.lives,
      penaltyText: draft.penaltyText.trim(),
      variants: draft.variants,
    },
    players: draft.names.map((name, i) => {
      const kind = draft.kinds[i];
      const isBot = kind !== HUMAN;
      return { id: `p${i + 1}`, name: name.trim() || defaultName(kind, i), isBot, personality: isBot ? kind : null };
    }),
  };
}

// startLabel: el texto del botón final ("Jugar", o "Crear sala" en línea).
// settings: la pantalla de Configuración en vez de la de nueva partida.
export function RulesPanel({ draft, onBack, onStart, startLabel = t('setup.start'), settings = false }) {
  const root = h('main', { class: 'screen setup' });
  const update = (fn) => {
    fn(draft);
    if (settings) setPreference('variants', draft.variants);
    render();
  };

  function render() {
    root.replaceChildren(
      h(
        'header',
        { class: 'setup__header' },
        h('button', { class: 'btn btn--icon btn--light', onClick: onBack, 'aria-label': t('setup.back') }, '‹'),
        h('h1', { class: 'setup__title' }, t(settings ? 'settings.title' : 'setup.title')),
      ),
      settings
        ? h('div', { class: 'setup__body' }, variantsCard(), displayCard())
        : h(
            'div',
            { class: 'setup__body' },
            playersCard(),
            modeCard(),
            draft.mode === 'lives' && livesCard(),
            draft.mode === 'penalty' && penaltyCard(),
            scenarioCard(),
            h('p', { class: 'setup__note' }, t('setup.extras', { list: activeVariants() })),
          ),
      h(
        'footer',
        { class: 'setup__footer' },
        settings
          ? h('button', { class: 'btn btn--primary btn--big', onClick: onBack }, t('settings.done'))
          : h('button', { class: 'btn btn--primary btn--big', onClick: () => onStart(draftToSetup(draft)) }, startLabel),
      ),
    );
  }

  // Las reglas extra no se eligen aquí, pero se nombran para que nadie se sorprenda en la mesa
  function activeVariants() {
    const names = VARIANTS.filter((v) => draft.variants[v.id].enabled).map((v) => t(`variants.${v.id}.name`));
    return names.length ? names.join(', ') : t('setup.extras.none');
  }

  function modeCard() {
    return card(t('setup.mode'), segmented('setup.mode', Object.keys(MODES), 'mode', 'mode'));
  }

  function scenarioCard() {
    return card(t('setup.scenario'), segmented('setup.scenario', SCENARIOS, 'scenario', 'scenario'));
  }

  // Botones de elegir uno solo: `field` es la clave del borrador y `prefix` la de sus textos
  function segmented(label, options, field, prefix) {
    return h(
      'div',
      { class: 'segmented', role: 'radiogroup', 'aria-label': t(label) },
      options.map((option) =>
        h(
          'button',
          {
            class: `segmented__option${draft[field] === option ? ' is-selected' : ''}`,
            role: 'radio',
            'aria-checked': String(draft[field] === option),
            onClick: () => update((d) => (d[field] = option)),
          },
          h('strong', {}, t(`${prefix}.${option}`)),
          h('small', {}, t(`${prefix}.${option}.hint`)),
        ),
      ),
    );
  }

  function playersCard() {
    return card(
      t('setup.players'),
      stepper({
        value: draft.names.length,
        min: MIN_PLAYERS,
        max: MAX_PLAYERS,
        onChange: (n) =>
          update((d) => {
            d.names = n > d.names.length ? [...d.names, ''] : d.names.slice(0, n);
            d.kinds = n > d.kinds.length ? [...d.kinds, HUMAN] : d.kinds.slice(0, n);
          }),
      }),
      h(
        'div',
        { class: 'names' },
        draft.names.map((name, i) =>
          h(
            'div',
            { class: 'seat' },
            h('input', {
              class: 'input',
              type: 'text',
              maxlength: '16',
              value: name,
              placeholder: defaultName(draft.kinds[i], i),
              'aria-label': t('setup.playerName', { n: i + 1 }),
              // Sin volver a dibujar, para no perder el foco al escribir
              onInput: (e) => (draft.names[i] = e.target.value),
            }),
            h(
              'select',
              {
                class: 'input',
                'aria-label': t('setup.playerKind', { n: i + 1 }),
                onChange: (e) => update((d) => (d.kinds[i] = e.target.value)),
              },
              [HUMAN, ...Object.keys(PERSONALITIES)].map((kind) =>
                h('option', { value: kind, selected: draft.kinds[i] === kind }, t(kind === HUMAN ? 'setup.human' : `bot.${kind}`)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  function livesCard() {
    return card(
      t('setup.lives'),
      stepper({ value: draft.lives, min: MIN_LIVES, max: MAX_LIVES, onChange: (n) => update((d) => (d.lives = n)) }),
    );
  }

  function penaltyCard() {
    return card(
      t('setup.penalty'),
      h('input', {
        class: 'input',
        type: 'text',
        maxlength: '80',
        value: draft.penaltyText,
        placeholder: t('setup.penaltyPlaceholder'),
        'aria-label': t('setup.penalty'),
        onInput: (e) => (draft.penaltyText = e.target.value),
      }),
    );
  }

  function variantsCard() {
    return card(
      t('setup.variants'),
      VARIANTS.map((variant) => {
        const state = draft.variants[variant.id];
        const params = Object.entries(variant.params ?? {});
        return h(
          'div',
          { class: 'variant' },
          h(
            'label',
            { class: 'variant__row' },
            h(
              'span',
              { class: 'variant__text' },
              h('strong', {}, t(`variants.${variant.id}.name`)),
              h('small', {}, t(`variants.${variant.id}.description`)),
            ),
            h('input', {
              class: 'switch',
              type: 'checkbox',
              role: 'switch',
              checked: state.enabled,
              onChange: (e) => update((d) => (d.variants[variant.id].enabled = e.target.checked)),
            }),
          ),
          state.enabled &&
            params.map(([name, spec]) =>
              h(
                'div',
                { class: 'variant__param' },
                h('span', {}, t(`variants.${variant.id}.${name}`)),
                stepper({
                  value: state[name],
                  min: spec.min,
                  max: spec.max,
                  step: 5,
                  onChange: (n) => update((d) => (d.variants[variant.id][name] = n)),
                }),
              ),
            ),
        );
      }),
    );
  }

  // Preferencia de presentación, no una regla: se guarda aparte y vale para todas las partidas
  function displayCard() {
    return card(
      t('setup.display'),
      preferenceRow('music', setMusicOn),
      preferenceRow('voices'),
      preferenceRow('simpleKeypad'),
      preferenceRow('silhouettes'),
    );
  }

  function preferenceRow(key, save = (value) => setPreference(key, value)) {
    return h(
      'label',
      { class: 'variant__row' },
      h(
        'span',
        { class: 'variant__text' },
        h('strong', {}, t(`setup.${key}`)),
        h('small', {}, t(`setup.${key}.description`)),
      ),
      h('input', {
        class: 'switch',
        type: 'checkbox',
        role: 'switch',
        checked: getPreference(key),
        onChange: (e) => save(e.target.checked),
      }),
    );
  }

  render();
  return root;
}

// Armado común de las pantallas de menú: cabecera con volver, cuerpo y botón abajo
export function screen({ title, onBack, body, footer }) {
  return h(
    'main',
    { class: 'screen setup' },
    h(
      'header',
      { class: 'setup__header' },
      h('button', { class: 'btn btn--icon btn--light', onClick: onBack, 'aria-label': t('setup.back') }, '‹'),
      h('h1', { class: 'setup__title' }, title),
    ),
    h('div', { class: 'setup__body' }, ...body),
    footer && h('footer', { class: 'setup__footer' }, footer),
  );
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, h('h2', { class: 'card__title' }, title), ...children);
}

function stepper({ value, min, max, step = 1, onChange }) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  return h(
    'div',
    { class: 'stepper' },
    h('button', { class: 'btn btn--icon btn--light', disabled: value <= min, 'aria-label': t('setup.decrease'), onClick: () => onChange(clamp(value - step)) }, '−'),
    h('output', { class: 'stepper__value', 'aria-live': 'polite' }, String(value)),
    h('button', { class: 'btn btn--icon btn--accent', disabled: value >= max, 'aria-label': t('setup.increase'), onClick: () => onChange(clamp(value + step)) }, '+'),
  );
}
