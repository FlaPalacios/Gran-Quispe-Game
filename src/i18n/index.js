// Textos visibles al jugador. Por ahora solo español; en y qu se suman en la Fase 5.
import es from './es.json';

const dictionaries = { es };
let current = 'es';

export function setLanguage(lang) {
  if (!dictionaries[lang]) throw new RangeError(`Idioma no disponible: ${lang}`);
  current = lang;
}

// t('game.turnOf', { name: 'Rosa' }) → "Turno de Rosa".
// Devuelve la clave tal cual si falta la traducción, para detectarla a simple vista.
export function t(key, params = {}) {
  const text = dictionaries[current][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
