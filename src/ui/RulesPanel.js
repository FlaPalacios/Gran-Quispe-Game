// Panel de configuración de partida: modo, jugadores (2 a 8), vidas, texto de castigo y variantes.
// Las variantes se generan desde engine/variants.js: agregar una nueva no requiere tocar este archivo,
// solo sus textos en i18n.
import { getPreference, setPreference } from '../app/preferences.js';
import { MAX_LIVES, MIN_LIVES, DEFAULT_LIVES, MODES } from '../engine/modes.js';
import { MAX_PLAYERS, MIN_PLAYERS } from '../engine/rules.js';
import { VARIANTS, resolveVariants } from '../engine/variants.js';
import { t } from '../i18n/index.js';
import { h } from './dom.js';

const DEFAULT_PLAYER_COUNT = 4;

export function defaultDraft() {
  return {
    mode: 'classic',
    lives: DEFAULT_LIVES,
    penaltyText: '',
    names: Array.from({ length: DEFAULT_PLAYER_COUNT }, () => ''),
    variants: resolveVariants(),
  };
}

// Convierte el borrador del panel en la entrada de createGame
export function draftToSetup(draft) {
  return {
    config: { mode: draft.mode, lives: draft.lives, penaltyText: draft.penaltyText.trim(), variants: draft.variants },
    players: draft.names.map((name, i) => ({
      id: `p${i + 1}`,
      name: name.trim() || t('setup.defaultName', { n: i + 1 }),
    })),
  };
}

export function RulesPanel({ draft, onBack, onStart }) {
  const root = h('main', { class: 'screen setup' });
  const update = (fn) => {
    fn(draft);
    render();
  };

  function render() {
    root.replaceChildren(
      h(
        'header',
        { class: 'setup__header' },
        h('button', { class: 'btn btn--icon btn--light', onClick: onBack, 'aria-label': t('setup.back') }, '‹'),
        h('h1', { class: 'setup__title' }, t('setup.title')),
      ),
      h(
        'div',
        { class: 'setup__body' },
        modeCard(),
        playersCard(),
        draft.mode === 'lives' && livesCard(),
        draft.mode === 'penalty' && penaltyCard(),
        variantsCard(),
        displayCard(),
      ),
      h(
        'footer',
        { class: 'setup__footer' },
        h('button', { class: 'btn btn--primary btn--big', onClick: () => onStart(draftToSetup(draft)) }, t('setup.start')),
      ),
    );
  }

  function modeCard() {
    return card(
      t('setup.mode'),
      h(
        'div',
        { class: 'segmented', role: 'radiogroup', 'aria-label': t('setup.mode') },
        Object.keys(MODES).map((mode) =>
          h(
            'button',
            {
              class: `segmented__option${draft.mode === mode ? ' is-selected' : ''}`,
              role: 'radio',
              'aria-checked': String(draft.mode === mode),
              onClick: () => update((d) => (d.mode = mode)),
            },
            h('strong', {}, t(`mode.${mode}`)),
            h('small', {}, t(`mode.${mode}.hint`)),
          ),
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
          }),
      }),
      h(
        'div',
        { class: 'names' },
        draft.names.map((name, i) =>
          h('input', {
            class: 'input',
            type: 'text',
            maxlength: '16',
            value: name,
            placeholder: t('setup.defaultName', { n: i + 1 }),
            'aria-label': t('setup.playerName', { n: i + 1 }),
            // Sin volver a dibujar, para no perder el foco al escribir
            onInput: (e) => (draft.names[i] = e.target.value),
          }),
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
      h(
        'label',
        { class: 'variant__row' },
        h(
          'span',
          { class: 'variant__text' },
          h('strong', {}, t('setup.silhouettes')),
          h('small', {}, t('setup.silhouettes.description')),
        ),
        h('input', {
          class: 'switch',
          type: 'checkbox',
          role: 'switch',
          checked: getPreference('silhouettes'),
          onChange: (e) => setPreference('silhouettes', e.target.checked),
        }),
      ),
    );
  }

  render();
  return root;
}

function card(title, ...children) {
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
