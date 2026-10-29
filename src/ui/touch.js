/* Controles táctiles: palanca virtual y arrastre para mirar en la sala; cruceta y botones en la máquina.
   Escriben en el mismo objeto `input` que el teclado. */
import { $ } from './dom.js';
import { input, bindVirtual, addLook } from '../core/input.js';

export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function initTouch() {
  for (const b of document.querySelectorAll('[data-action]')) bindVirtual(b);

  // Palanca virtual: desplazamiento del pomo → input.move (-1..1).
  const stick = $('touch-stick');
  const knob = stick.querySelector('.touch-knob');
  let stickId = null;
  const R = 46;
  const moveStick = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.move.x = dx / R;
    input.move.y = dy / R;
  };
  const endStick = () => {
    stickId = null;
    knob.style.transform = '';
    input.move.x = input.move.y = 0;
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    try { stick.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  // Arrastrar en la mitad derecha para mirar.
  const look = $('touch-look');
  let lookId = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    try { look.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    addLook((e.clientX - lx) * 1.6, (e.clientY - ly) * 1.6);
    lx = e.clientX;
    ly = e.clientY;
  });
  const endLook = () => { lookId = null; };
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);
}

// mode: 'room' | 'cabinet' | null (ocultos)
export function setTouchMode(mode) {
  const on = isTouch();
  $('touch-room').hidden = !(on && mode === 'room');
  $('touch-cab').hidden = !(on && mode === 'cabinet');
}
