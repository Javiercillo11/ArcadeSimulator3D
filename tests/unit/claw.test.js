import { describe, it, expect } from 'vitest';
import { ClawLogic, BOX, CHUTE, MOVE_FRAMES } from '../../src/arcade/ClawLogic.js';

function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags() };
}

// rng fijo: devuelve los valores de la lista en orden (y luego el último).
const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };

function run(claw, input, maxSteps = 5000) {
  let won = null;
  for (let i = 0; i < maxSteps && claw.state !== 'IDLE'; i++) {
    won = claw.update(input) || won;
    for (const k in input.pressed) input.pressed[k] = false;
  }
  return won;
}

describe('grúa de peluches', () => {
  it('sin moneda no se mueve; con moneda hay 15 s para colocar la pinza', () => {
    const c = new ClawLogic([], seq(0.5));
    const input = makeInput();
    input.down.right = true;
    c.update(input);
    expect([c.state, c.x]).toEqual(['IDLE', CHUTE.x]);
    expect(c.start()).toBe(true);
    expect(c.start()).toBe(false);
    for (let i = 0; i < 60; i++) c.update(input);
    expect(c.x).toBeCloseTo(CHUTE.x + 0.25, 5);
    for (let i = 0; i < MOVE_FRAMES; i++) c.update(input);
    expect(c.x).toBe(BOX.maxX);
    expect(c.state).not.toBe('MOVE');
  });

  it('ESPACIO la deja caer; si está encima de un peluche lo agarra y lo lleva a la boca', () => {
    const plush = [{ id: 'plushBear', x: 0, z: 0 }, { id: 'plushCat', x: 0.25, z: -0.2 }];
    const sounds = [];
    const c = new ClawLogic(plush, seq(0.1, 0.9), (n) => sounds.push(n));
    c.start();
    c.x = 0.01; c.z = 0;
    const input = makeInput();
    input.pressed.jump = true;
    const won = run(c, input);
    expect(won).toBe(plush[0]);
    expect(c.won.id).toBe('plushBear');
    expect([c.x, c.z, c.y, c.state]).toEqual([CHUTE.x, CHUTE.z, 0, 'IDLE']);
    expect(sounds).toEqual(expect.arrayContaining(['claw', 'grab', 'win']));
  });

  it('lejos de cualquier peluche, sube vacía', () => {
    const plush = [{ id: 'plushBear', x: 0.25, z: 0.2 }];
    const c = new ClawLogic(plush, seq(0));
    c.start();
    c.x = -0.25; c.z = -0.2;
    const input = makeInput();
    input.pressed.jump = true;
    expect(run(c, input)).toBe(null);
    expect(plush[0].taken).toBeFalsy();
  });

  it('a veces se escurre al subir y el peluche vuelve a la urna', () => {
    const plush = [{ id: 'plushFrog', x: 0, z: 0 }];
    // 0.1: agarra; 0.1: se va a escurrir; 0.5: a media subida.
    const c = new ClawLogic(plush, seq(0.1, 0.1, 0.5));
    c.start();
    c.x = 0; c.z = 0;
    const input = makeInput();
    input.pressed.jump = true;
    expect(run(c, input)).toBe(null);
    expect(plush[0].taken).toBe(false);
  });

  it('un peluche ya ganado no se puede volver a coger', () => {
    const plush = [{ id: 'plushBear', x: 0, z: 0, taken: true }];
    const c = new ClawLogic(plush, seq(0));
    c.start();
    c.x = 0; c.z = 0;
    const input = makeInput();
    input.pressed.jump = true;
    expect(run(c, input)).toBe(null);
  });
});
