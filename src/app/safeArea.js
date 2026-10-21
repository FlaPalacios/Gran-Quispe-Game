// Zonas seguras del teléfono (muesca, barra inferior).
// env(safe-area-inset-*) solo existe en CSS, así que se miden con un elemento invisible
// que las usa como padding y se leen ya resueltas en píxeles.
let probe = null;

function getProbe() {
  if (probe || typeof document === 'undefined') return probe;
  probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top, 0px)',
    'padding-right:env(safe-area-inset-right, 0px)',
    'padding-bottom:env(safe-area-inset-bottom, 0px)',
    'padding-left:env(safe-area-inset-left, 0px)',
  ].join(';');
  document.body.append(probe);
  return probe;
}

export function getSafeAreaInsets() {
  const element = getProbe();
  if (!element) return { top: 0, right: 0, bottom: 0, left: 0 };
  const style = getComputedStyle(element);
  const read = (side) => Math.round(parseFloat(style.getPropertyValue(`padding-${side}`)) || 0);
  return { top: read('top'), right: read('right'), bottom: read('bottom'), left: read('left') };
}
