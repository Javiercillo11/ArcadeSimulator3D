import { describe, it, expect } from 'vitest';
import { InitialsEntry, ALPHABET, TIMEOUT } from '../../src/arcade/initials.js';

function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags() };
}

// Pulsa una tecla durante un paso (flanco + mantenida) y la suelta.
function tap(entry, input, key) {
  input.down[key] = input.pressed[key] = true;
  entry.update(input);
  input.down[key] = input.pressed[key] = false;
  entry.update(input);
}

describe('iniciales', () => {
  it('empieza con las iniciales propuestas y el cursor en la primera', () => {
    const e = new InitialsEntry('JAV');
    expect([e.value, e.cursor, e.done]).toEqual(['JAV', 0, false]);
    expect(new InitialsEntry('a').value).toBe('AAA');
    expect(new InitialsEntry('ñ?x').value).toBe('AAX');
  });

  it('arriba y abajo cambian la letra dando la vuelta al alfabeto', () => {
    const e = new InitialsEntry('AAA');
    const input = makeInput();
    tap(e, input, 'up');
    expect(e.value).toBe('BAA');
    tap(e, input, 'down');
    tap(e, input, 'down');
    expect(e.value[0]).toBe(ALPHABET.at(-1));
  });

  it('mantener arriba repite tras una pausa', () => {
    const e = new InitialsEntry('AAA');
    const input = makeInput();
    input.down.up = input.pressed.up = true;
    e.update(input);
    input.pressed.up = false;
    for (let i = 0; i < 17; i++) e.update(input);
    expect(e.value[0]).toBe('B');
    for (let i = 0; i < 1 + 5 * 3; i++) e.update(input);
    expect(e.value[0]).toBe('F');
  });

  it('izquierda y derecha mueven el cursor sin salirse', () => {
    const e = new InitialsEntry('AAA');
    const input = makeInput();
    tap(e, input, 'left');
    expect(e.cursor).toBe(0);
    tap(e, input, 'right');
    tap(e, input, 'right');
    tap(e, input, 'right');
    expect(e.cursor).toBe(2);
    tap(e, input, 'up');
    expect(e.value).toBe('AAB');
  });

  it('SALTAR o START confirma cada letra y la tercera termina', () => {
    const sounds = [];
    const e = new InitialsEntry('AAA', (n) => sounds.push(n));
    const input = makeInput();
    tap(e, input, 'up');            // B
    tap(e, input, 'jump');          // → 2.ª
    tap(e, input, 'up');
    tap(e, input, 'up');            // C
    tap(e, input, 'start');         // → 3.ª
    expect(e.done).toBe(false);
    tap(e, input, 'down');          // espacio (última del alfabeto)
    tap(e, input, 'jump');
    expect([e.done, e.value]).toEqual([true, 'BC ']);
    expect(sounds).toContain('menuSelect');
  });

  it('a los 30 s se acepta lo que haya', () => {
    const e = new InitialsEntry('XYZ');
    for (let i = 0; i < TIMEOUT - 1; i++) e.update(null);
    expect(e.done).toBe(false);
    e.update(null);
    expect([e.done, e.value]).toEqual([true, 'XYZ']);
  });
});
