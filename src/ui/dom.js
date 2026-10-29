/* Utilidades de DOM compartidas por los paneles: crear elementos, foco con flechas y avisos. */

export const $ = (id) => document.getElementById(id);

// el('button', { class, text, onclick, 'data-x': … }, [hijos])
export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  if (children) for (const c of children) node.appendChild(c);
  return node;
}

function focusables(container) {
  return Array.from(container.querySelectorAll('button:not(:disabled), input:not(:disabled)')).filter((n) => n.offsetParent !== null && n.type !== 'file');
}

export function focusFirst(container) {
  const list = focusables(container);
  if (list.length) list[0].focus();
}

// Mueve el foco al siguiente/anterior control del panel (flechas).
export function navigate(container, delta) {
  const list = focusables(container);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const next = i < 0 ? 0 : (i + delta + list.length) % list.length;
  list[next].focus();
}

let toastTimer = 0;
export function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), ms || 3200);
}
