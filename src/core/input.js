/* Entrada unificada: teclado, ratón (vista) y controles táctiles. Detección de flanco y buffer de dirección.
   Los mismos nombres de acción sirven en la sala y en la máquina; cada contexto lee las que necesita. */

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump',
  Enter: 'start', NumpadEnter: 'start',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  KeyE: 'use',
  KeyF: 'zoom',
  KeyQ: 'stand',
  ShiftLeft: 'run', ShiftRight: 'run'
};
export const ACTIONS = ['up', 'down', 'left', 'right', 'jump', 'start', 'pause', 'mute', 'use', 'zoom', 'stand', 'run'];
const DIRS = { up: 1, down: 1, left: 1, right: 1 };

const down = {};
const pressed = {};
const listeners = [];

export const input = {
  down,
  pressed,
  lastDir: null,       // buffer: última dirección pulsada
  look: { x: 0, y: 0 },// desplazamiento de la vista acumulado desde el último consumo (px de ratón)
  move: { x: 0, y: 0 },// palanca virtual analógica de la sala (-1..1); 0 si no se usa
  enabled: true
};

function reset() {
  for (const a of ACTIONS) {
    down[a] = false;
    pressed[a] = false;
  }
}
reset();

function isTextField(el) {
  if (!el || !el.tagName) return false;
  const t = el.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
}

function isControl(el) {
  if (!el || !el.tagName) return false;
  const t = el.tagName;
  return t === 'BUTTON' || t === 'A' || isTextField(el);
}

// source: 'key' | 'virtual'
export function press(action, source) {
  if (!down[action]) {
    pressed[action] = true;
    if (DIRS[action]) input.lastDir = action;
  }
  down[action] = true;
  for (const fn of listeners) fn(action, source || 'key');
}

export function release(action) {
  // lastDir no se borra: MAZE MUNCHER conserva el giro pedido aunque se suelte la tecla.
  down[action] = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (isTextField(e.target)) return;
    const action = KEYMAP[e.code];
    if (!action) return;
    const isArrow = e.code.indexOf('Arrow') === 0;
    // Flechas nunca desplazan la página; espacio/Enter solo si no hay un control enfocado.
    if (isArrow || (!isControl(e.target) && (e.code === 'Space' || action === 'start'))) {
      e.preventDefault();
    }
    if (e.repeat) return;
    press(action, 'key');
  });

  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) release(action);
  });

  window.addEventListener('blur', () => {
    for (const a of ACTIONS) down[a] = false;
  });

  // La vista solo se mueve con el ratón capturado (Pointer Lock) o con arrastre táctil (addLook).
  window.addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    input.look.x += e.movementX || 0;
    input.look.y += e.movementY || 0;
  });
}

export function addLook(dx, dy) {
  input.look.x += dx;
  input.look.y += dy;
}

// Devuelve y pone a cero el desplazamiento de vista acumulado.
export function takeLook(out) {
  out.x = input.look.x;
  out.y = input.look.y;
  input.look.x = 0;
  input.look.y = 0;
  return out;
}

// Controles táctiles / ratón: cualquier elemento con data-action.
export function bindVirtual(el) {
  const action = el.getAttribute('data-action');
  function on(e) {
    e.preventDefault();
    e.stopPropagation();
    if (el.setPointerCapture && e.pointerId !== undefined) {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    }
    el.classList.add('is-down');
    press(action, 'virtual');
  }
  function off() {
    el.classList.remove('is-down');
    release(action);
  }
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Escucha inmediata (fuera del bucle) para pausa, silencio, E, Q y navegación.
export function on(fn) { listeners.push(fn); }

// Llamar al final de cada paso fijo: los flancos solo duran un paso.
export function endStep() {
  for (const a of ACTIONS) pressed[a] = false;
}

export function clear() {
  reset();
  input.lastDir = null;
  input.look.x = input.look.y = 0;
  input.move.x = input.move.y = 0;
}

Object.assign(input, { press, release, on, endStep, clear, bindVirtual, addLook, takeLook });
