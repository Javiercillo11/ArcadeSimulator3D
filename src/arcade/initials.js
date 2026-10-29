/* Introducción de tres iniciales con la palanca, como en las recreativas:
   arriba/abajo cambia la letra (mantener repite), izquierda/derecha mueve el cursor,
   SALTAR o START confirma la letra y pasa a la siguiente; tras la tercera, termina. */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789. ';
const REPEAT_DELAY = 18;     // pasos manteniendo antes de repetir
const REPEAT_EVERY = 5;
export const TIMEOUT = 30 * 60;  // a los 30 s se acepta lo que haya

const NO_SFX = () => {};

export class InitialsEntry {
  constructor(start = 'AAA', sfx = NO_SFX) {
    this.letters = [];
    for (let i = 0; i < 3; i++) {
      const k = ALPHABET.indexOf((start[i] || 'A').toUpperCase());
      this.letters.push(k < 0 ? 0 : k);
    }
    this.cursor = 0;
    this.done = false;
    this.frames = 0;
    this.held = 0;
    this.sfx = sfx;
  }

  get value() {
    return this.letters.map((k) => ALPHABET[k]).join('');
  }

  change(delta) {
    const n = ALPHABET.length;
    this.letters[this.cursor] = (this.letters[this.cursor] + delta + n) % n;
    this.sfx('menuMove');
  }

  // Un paso fijo. input: { down, pressed } como en core/input.js.
  update(input) {
    if (this.done) return true;
    this.frames++;
    if (this.frames >= TIMEOUT) { this.done = true; return true; }
    if (!input) return false;
    const pr = input.pressed, d = input.down;
    if (pr.up) { this.change(1); this.held = 0; }
    else if (pr.down) { this.change(-1); this.held = 0; }
    else if (d.up || d.down) {
      this.held++;
      if (this.held >= REPEAT_DELAY && (this.held - REPEAT_DELAY) % REPEAT_EVERY === 0) this.change(d.up ? 1 : -1);
    } else this.held = 0;
    if (pr.left && this.cursor > 0) { this.cursor--; this.sfx('menuMove'); }
    if (pr.right && this.cursor < 2) { this.cursor++; this.sfx('menuMove'); }
    if (pr.jump || pr.start) {
      this.sfx('menuSelect');
      if (this.cursor < 2) this.cursor++;
      else this.done = true;
    }
    return this.done;
  }
}
