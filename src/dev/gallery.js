// Galería de assets (solo desarrollo): muestra qué assets faltan, cuáles ya están y cómo se ven
// sobre los colores del juego. Se abre en http://localhost:5173/galeria.html con `npm run dev`.
// Vite recarga la página sola al agregar o cambiar un archivo en src/assets/.
import { EXPECTED_ASSETS } from './assetList.js';

const found = {
  ...import.meta.glob('/src/assets/images/**/*.{png,webp,jpg,jpeg,svg}', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('/src/assets/audio/**/*.{ogg,mp3,wav}', { eager: true, query: '?url', import: 'default' }),
};
const urlFor = (path) => found[`/src/assets/${path}`];
const isAudio = (path) => path.startsWith('audio/');

const expectedPaths = new Set(EXPECTED_ASSETS.flatMap((g) => g.items.map((i) => `/src/assets/${i.path}`)));
const extras = Object.keys(found).filter((p) => !expectedPaths.has(p));

function card({ path, size, note, optional }) {
  const url = urlFor(path);
  const status = url ? 'ok' : optional ? 'optional' : 'missing';
  const label = { ok: 'Listo', optional: 'Opcional', missing: 'Falta' }[status];
  const preview = !url
    ? `<div class="preview empty">—</div>`
    : isAudio(path)
      ? `<audio controls src="${url}"></audio>`
      : `<div class="preview"><img src="${url}" alt="${path}"></div>
         <p class="dims" data-src="${url}"></p>`;
  return `
    <article class="card ${status}">
      <header><span class="badge">${label}</span><code>src/assets/${path}</code></header>
      ${preview}
      <p class="meta">${size} · ${note}</p>
    </article>`;
}

const total = EXPECTED_ASSETS.flatMap((g) => g.items).filter((i) => !i.optional);
const done = total.filter((i) => urlFor(i.path)).length;

document.getElementById('app').innerHTML = `
  <h1>Galería de assets</h1>
  <p class="summary">Obligatorios listos: <strong>${done} de ${total.length}</strong>. Fondo de vista previa:
    <button data-bg="rayos">Rayos</button><button data-bg="crema">Crema</button><button data-bg="noche">Noche</button></p>
  ${EXPECTED_ASSETS.map((g) => `<h2>${g.group}</h2><div class="grid">${g.items.map(card).join('')}</div>`).join('')}
  ${extras.length ? `<h2>Otros archivos encontrados</h2><ul>${extras.map((p) => `<li><code>${p}</code></li>`).join('')}</ul>` : ''}
`;

// Medidas reales de cada imagen, para comparar con las esperadas
document.querySelectorAll('.dims').forEach((el) => {
  const img = new Image();
  img.onload = () => (el.textContent = `Tamaño real: ${img.naturalWidth} x ${img.naturalHeight} px`);
  img.src = el.dataset.src;
});

document.querySelectorAll('[data-bg]').forEach((btn) =>
  btn.addEventListener('click', () => (document.body.dataset.bg = btn.dataset.bg)),
);
