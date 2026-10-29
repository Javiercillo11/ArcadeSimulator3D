import { describe, it, expect } from 'vitest';
import { ClimbGame } from '../../src/games/climb/ClimbGame.js';
import L from '../../src/games/climb/climbLevel.js';
import { makeRng } from '../../src/core/rng.js';

function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags(), lastDir: null };
}

// Partida en PLAYING con semilla fija; por defecto sin lanzamientos ni peligros.
function playing({ calm = true } = {}) {
  const sounds = [];
  const game = new ClimbGame({ rng: makeRng(12345), sfx: (n) => sounds.push(n) });
  const t = game.test;
  t.startPlaying();
  if (calm) { t.setThrowing(false); t.clearHazards(); }
  const input = makeInput();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(input);
      for (const k in input.pressed) input.pressed[k] = false;
    }
  };
  const hold = (k) => { if (!input.down[k]) input.pressed[k] = true; input.down[k] = true; };
  const release = (k) => { input.down[k] = false; };
  return { game, t, input, step, hold, release, sounds };
}

describe('BARREL CLIMB: contrato', () => {
  it('expone score, lives, level, state y gameOver, y arranca en READY', () => {
    const g = new ClimbGame({ rng: makeRng(1) });
    expect([g.score, g.lives, g.level, g.state, g.gameOver]).toEqual([0, 3, 1, 'READY', false]);
    expect(new ClimbGame({ level: 3 }).level).toBe(3);
  });

  it('con la misma semilla y la misma entrada, la partida es idéntica', () => {
    const a = playing({ calm: false }), b = playing({ calm: false });
    for (const r of [a, b]) { r.hold('right'); r.step(300); r.release('right'); r.hold('left'); r.step(300); }
    expect(a.t.state()).toEqual(b.t.state());
  });
});

describe('BARREL CLIMB: movimiento', () => {
  it('camina sobre las vigas inclinadas sin atravesarlas', () => {
    const { t, step, hold } = playing();
    t.setPlayer(40, 0);
    hold('right');
    const samples = [];
    for (let i = 0; i < 12; i++) {
      step(10);
      const p = t.state().player;
      samples.push([p.x, p.y, t.surface(0, p.x), p.state]);
    }
    for (const [x, y, floor, st] of samples) {
      expect(st).toBe('walk');
      expect(Math.abs(y - floor), `x=${x}`).toBeLessThan(0.001);
    }
    expect(samples.at(-1)[0]).toBeCloseTo(40 + 120 * 0.75, 3);
    expect(samples.at(-1)[1]).toBeLessThan(samples[0][1]);   // la viga sube hacia la derecha
  });

  it('sube y baja escaleras solo cuando está alineado; las rotas no se usan', () => {
    const { t, step, hold, release } = playing();
    t.setPlayer(166, 0);                         // desalineado 10 px
    hold('up');
    step(40);
    expect(t.state().player).toMatchObject({ state: 'walk', platform: 0 });
    t.setPlayer(176, 0);                         // alineado
    step(5);
    expect(t.state().player.state).toBe('climb');
    step(80);
    release('up');
    expect(t.state().player).toMatchObject({ state: 'walk', platform: 1 });
    hold('down');
    step(90);
    release('down');
    expect(t.state().player).toMatchObject({ state: 'walk', platform: 0 });
    const broken = t.ladders().find((l) => l.broken && l.bottom === 0);
    expect(broken).toBeTruthy();
    t.setPlayer(broken.x, 0);
    hold('up');
    step(40);
    release('up');
    expect(t.state().player).toMatchObject({ state: 'walk', platform: 0 });
  });

  it('el salto sigue un arco y aterriza en la viga', () => {
    const { t, step, hold, release, sounds } = playing();
    t.setPlayer(100, 0);
    const y0 = t.state().player.y;
    hold('jump');
    hold('right');
    const ys = [];
    let frames = 0;
    do { step(1); frames++; ys.push(t.state().player.y); } while (t.state().player.state === 'jump' && frames < 200);
    release('jump');
    release('right');
    const p = t.state().player;
    const minY = Math.min(...ys);
    expect(y0 - minY).toBeGreaterThan(12);
    expect(y0 - minY).toBeLessThan(20);
    const iMin = ys.indexOf(minY);
    expect(iMin).toBeGreaterThan(5);
    expect(iMin).toBeLessThan(ys.length - 5);
    expect(frames).toBeGreaterThan(30);
    expect(frames).toBeLessThan(45);
    expect(p.state).toBe('walk');
    expect(p.x).toBeGreaterThan(110);
    expect(Math.abs(p.y - t.surface(0, p.x))).toBeLessThan(0.001);
    expect(t.state().lives).toBe(3);
    expect(sounds).toContain('jump');
  });

  it('una caída alta quita una vida', () => {
    const { t, step, hold } = playing();
    t.setPlayer(200, 1);
    hold('right');
    step(60);
    expect(t.state()).toMatchObject({ phase: 'LIFE_LOST', deathCause: 'fall', lives: 2 });
  });

  it('con el martillo no se puede subir escaleras', () => {
    const { t, step, hold } = playing();
    t.setPlayer(176, 0);
    t.giveHammer();
    hold('up');
    step(30);
    expect(t.state().player.state).toBe('walk');
  });

  it('una tecla mantenida al perder una vida no cuenta hasta soltarla', () => {
    const { t, step, hold, release } = playing();
    t.setPlayer(200, 1);
    hold('right');
    step(60);                                    // cae y muere con la flecha pulsada
    expect(t.state().phase).toBe('LIFE_LOST');
    step(150 + 120);                             // reinicio + READY
    expect(t.state().phase).toBe('PLAYING');
    const x0 = t.state().player.x;
    step(20);
    expect(t.state().player.x).toBe(x0);
    release('right');
    step(1);
    hold('right');
    step(20);
    expect(t.state().player.x).toBeGreaterThan(x0);
  });
});

describe('BARREL CLIMB: peligros y puntos', () => {
  it('los barriles ruedan, caen de viga en viga y a veces bajan escaleras', () => {
    const { t, step } = playing();
    t.setPlayer(8, 0);
    t.setBarrelLadders(false);
    t.spawnBarrel(60, 5);
    const platforms = new Set();
    const xs = [];
    for (let i = 0; i < 3000 && t.state().barrels.length; i++) {
      step(1);
      const b = t.state().barrels[0];
      if (b) { platforms.add(b.platform); xs.push(b.x); }
    }
    expect(xs[10]).toBeGreaterThan(xs[0]);
    expect([...platforms].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(t.state().barrels).toHaveLength(0);

    t.setBarrelLadders(true);
    t.setSeed(7);
    let used = 0, skipped = 0;
    for (let k = 0; k < 20; k++) {
      t.clearHazards();
      t.spawnBarrel(170, 5, 1);
      let ladder = false;
      for (let i = 0; i < 40; i++) {
        step(1);
        const b = t.state().barrels[0];
        if (b && b.state === 'ladder') ladder = true;
      }
      if (ladder) used++; else skipped++;
    }
    expect(used).toBeGreaterThan(0);
    expect(skipped).toBeGreaterThan(0);
  });

  it('el robot lanza barriles por sí solo', () => {
    const { t, step, sounds } = playing({ calm: false });
    t.setInvulnerable(true);
    step(240);
    expect(t.state().barrels.length).toBeGreaterThan(0);
    expect(sounds).toContain('throwBarrel');
  });

  it('el contacto con un barril quita una vida', () => {
    const { t, step } = playing();
    t.setPlayer(100, 0);
    t.spawnBarrel(130, 0, -1);
    let frames = 0;
    while (t.state().phase === 'PLAYING' && frames < 120) { step(1); frames++; }
    expect(t.state()).toMatchObject({ phase: 'LIFE_LOST', lives: 2, deathCause: 'hit' });
  });

  it('el contacto con una llama quita una vida', () => {
    const { t, step } = playing();
    t.setPlayer(100, 0);
    t.spawnFlame(90, 0);
    let frames = 0;
    while (t.state().phase === 'PLAYING' && frames < 300) { step(1); frames++; }
    expect(t.state()).toMatchObject({ phase: 'LIFE_LOST', lives: 2, deathCause: 'hit' });
  });

  it('saltar un barril suma 100 (fiable en toda la ventana de tiempo)', () => {
    const { t, step, hold, release } = playing();
    for (let jumpAt = 22; jumpAt <= 30; jumpAt++) {
      t.clearHazards();
      t.setPlayer(100, 0);
      t.setScore(0);
      t.spawnBarrel(140, 0, -1);
      step(jumpAt);
      hold('jump');
      step(1);
      release('jump');
      step(70);
      const s = t.state();
      expect({ score: s.score, phase: s.phase, lives: s.lives }, 'salto en el paso ' + jumpAt).toEqual({ score: 100, phase: 'PLAYING', lives: 3 });
    }
  });

  it('el martillo destruye barriles con 300 / 500 / 800 puntos', () => {
    const { t, step, sounds } = playing();
    t.setPlayer(100, 0);
    t.giveHammer();
    t.spawnBarrel(130, 0, -1);
    let frames = 0;
    while (t.state().barrels.length && frames < 120) { step(1); frames++; }
    const s = t.state();
    expect([300, 500, 800]).toContain(s.score);
    expect(s.phase).toBe('PLAYING');
    expect(s.lives).toBe(3);
    expect(s.hammer).toBeGreaterThan(0);
    expect(sounds).toContain('smash');
  });

  it('vida extra a los 7000 puntos', () => {
    const { t, step, hold, release } = playing();
    t.setScore(6950);
    t.setPlayer(100, 0);
    t.spawnBarrel(140, 0, -1);
    step(26);
    hold('jump');
    step(1);
    release('jump');
    step(70);
    expect(t.state().score).toBe(7050);
    expect(t.state().lives).toBe(4);
  });
});

describe('BARREL CLIMB: rescate, bonificación y niveles', () => {
  it('al llegar a la cima se rescata, se suma la bonificación y se pasa al nivel 2', () => {
    const { t, step, hold, release } = playing();
    t.setPlayer(128, 5);
    hold('up');
    let s = t.state();
    for (let i = 0; i < 20 && s.phase === 'PLAYING'; i++) { step(5); s = t.state(); }
    release('up');
    expect(s.phase).toBe('LEVEL_CLEAR');
    expect(s.score).toBe(s.bonus);
    expect(s.score).toBeGreaterThan(4000);
    step(301);
    s = t.state();
    expect([s.level, s.phase, s.player.platform]).toEqual([2, 'READY', 0]);
    expect(s.bonus).toBe(L.tuning(2).bonusStart);
  });

  it('la bonificación decrece con el tiempo', () => {
    const { t, step } = playing();
    const b0 = t.state().bonus;
    step(240);
    expect(t.state().bonus).toBe(b0 - 200);
  });

  it('si la bonificación llega a 0 se pierde una vida', () => {
    const { t, step } = playing();
    t.setBonus(100);
    step(120);
    expect(t.state()).toMatchObject({ phase: 'LIFE_LOST', deathCause: 'time', lives: 2 });
  });

  it('perder las 3 vidas lleva a GAME_OVER y luego a gameOver', () => {
    const { game, t, step } = playing();
    const seen = [];
    for (let k = 0; k < 3; k++) {
      t.setThrowing(false);
      t.clearHazards();
      t.setPlayer(100, 0);
      t.spawnBarrel(110, 0, -1);
      let f = 0;
      while (t.state().phase === 'PLAYING' && f < 60) { step(1); f++; }
      seen.push(t.state().phase + ':' + t.state().lives);
      step(150);
      if (t.state().phase === 'READY') step(121);
    }
    seen.push(game.state);
    expect(seen).toEqual(['LIFE_LOST:2', 'LIFE_LOST:1', 'LIFE_LOST:0', 'GAME_OVER']);
    step(181);
    expect(game.gameOver).toBe(true);
  });

  it('la dificultad sube por nivel', () => {
    const a = L.tuning(1), b = L.tuning(4);
    expect(b.throwInterval).toBeLessThan(a.throwInterval);
    expect(b.barrelSpeed).toBeGreaterThan(a.barrelSpeed);
    expect(b.maxFlames).toBeGreaterThan(a.maxFlames);
    expect(b.ladderProb).toBeGreaterThan(a.ladderProb);
    expect(L.tuning(10).bonusStart).toBe(8000);
  });
});
