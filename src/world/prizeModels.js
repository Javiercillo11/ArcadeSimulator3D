/* Modelos 3D sencillos de los premios y peluches (unos 12-18 cm). Origen en la base, de pie sobre y = 0. */
import { Group, Mesh, SphereGeometry, CylinderGeometry, BoxGeometry, TorusGeometry, ConeGeometry, MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { PLUSH } from '../data/prizes.js';

const mat = (color, opts = {}) => new MeshStandardMaterial({ color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000 });
const BLACK = mat(0x111111, { rough: 0.3 });
const WHITE = mat(0xffffff, { rough: 0.4 });

function add(group, geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  group.add(m);
  return m;
}

// Peluche: cuerpo, cabeza, orejas según el tipo, ojos y hocico.
export function plush(id) {
  const def = PLUSH.find((p) => p.id === id) || PLUSH[0];
  const g = new Group();
  const fur = mat(def.color, { rough: 0.95 });
  const belly = mat(0xfff0dc, { rough: 0.95 });
  add(g, new SphereGeometry(0.045, 14, 10), fur, 0, 0.045, 0, 1, 0.95, 0.9);
  add(g, new SphereGeometry(0.028, 12, 8), belly, 0, 0.042, 0.03, 1, 1, 0.5);
  add(g, new SphereGeometry(0.038, 14, 10), fur, 0, 0.115, 0);
  if (id === 'plushBunny') {
    add(g, CapsuleLike(0.012, 0.05), fur, -0.016, 0.17, 0, 1, 1, 0.6);
    add(g, CapsuleLike(0.012, 0.05), fur, 0.016, 0.17, 0, 1, 1, 0.6);
  } else if (id === 'plushCat') {
    for (const s of [-1, 1]) { const e = add(g, new ConeGeometry(0.014, 0.03, 4), fur, s * 0.022, 0.155, 0); e.rotation.z = -s * 0.3; }
  } else if (id === 'plushFrog') {
    for (const s of [-1, 1]) add(g, new SphereGeometry(0.014, 10, 8), fur, s * 0.02, 0.15, 0.012);
  } else {
    for (const s of [-1, 1]) add(g, new SphereGeometry(0.013, 10, 8), fur, s * 0.028, 0.145, 0);
  }
  for (const s of [-1, 1]) add(g, new SphereGeometry(0.0055, 8, 6), BLACK, s * 0.013, 0.122, 0.034);
  add(g, new SphereGeometry(0.009, 8, 6), belly, 0, 0.108, 0.035, 1.2, 0.8, 0.8);
  for (const s of [-1, 1]) add(g, new SphereGeometry(0.014, 8, 6), fur, s * 0.04, 0.06, 0.012);
  return g;
}

// Oreja larga de conejo: un cilindro algo más fino en la punta.
function CapsuleLike(r, len) {
  return new CylinderGeometry(r, r * 0.8, len, 8);
}

function trophy(color) {
  const g = new Group();
  const metal = mat(color, { rough: 0.2, metal: 0.9 });
  add(g, new BoxGeometry(0.07, 0.025, 0.07), mat(0x2a1a10, { rough: 0.5 }), 0, 0.0125, 0);
  add(g, new CylinderGeometry(0.008, 0.012, 0.05, 10), metal, 0, 0.05, 0);
  add(g, new CylinderGeometry(0.04, 0.018, 0.06, 16, 1, true), metal, 0, 0.105, 0);
  add(g, new CylinderGeometry(0.018, 0.018, 0.006, 16), metal, 0, 0.075, 0);
  for (const s of [-1, 1]) {
    const h = add(g, new TorusGeometry(0.016, 0.004, 6, 14, Math.PI), metal, s * 0.04, 0.11, 0);
    h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  return g;
}

function duck() {
  const g = new Group();
  const y = mat(0xffd23f, { rough: 0.3 });
  add(g, new SphereGeometry(0.04, 14, 10), y, 0, 0.035, 0, 1.15, 0.85, 1);
  add(g, new SphereGeometry(0.026, 12, 8), y, 0, 0.085, 0.022);
  const beak = add(g, new ConeGeometry(0.01, 0.025, 8), mat(0xff8c1a), 0, 0.082, 0.05);
  beak.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(g, new SphereGeometry(0.004, 6, 4), BLACK, s * 0.011, 0.094, 0.043);
  return g;
}

function sunglasses() {
  const g = new Group();
  const frame = mat(0xff3d8b, { rough: 0.3 });
  for (const s of [-1, 1]) {
    const lens = add(g, new CylinderGeometry(0.022, 0.022, 0.004, 16), BLACK, s * 0.027, 0.03, 0);
    lens.rotation.x = Math.PI / 2;
    const rim = add(g, new TorusGeometry(0.022, 0.003, 6, 16), frame, s * 0.027, 0.03, 0.002);
    rim.rotation.y = 0;
  }
  add(g, new BoxGeometry(0.014, 0.004, 0.004), frame, 0, 0.038, 0);
  add(g, new BoxGeometry(0.1, 0.006, 0.08), mat(0x1b1240), 0, 0.003, -0.02);
  return g;
}

function keychain() {
  const g = new Group();
  const ring = add(g, new TorusGeometry(0.014, 0.0025, 6, 16), mat(0xc8ccd6, { metal: 0.9, rough: 0.2 }), 0, 0.08, 0);
  ring.rotation.y = Math.PI / 2;
  // Un personaje de píxeles en cubitos.
  const px = mat(0xffd23f);
  const shape = ['.###.', '#####', '###..', '#####', '.###.'];
  shape.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') add(g, new BoxGeometry(0.01, 0.01, 0.01), px, (c - 2) * 0.01, 0.055 - r * 0.01, 0); }));
  return g;
}

function ghostPlush() {
  const g = new Group();
  const fur = mat(0x33e6ff, { rough: 0.95 });
  add(g, new SphereGeometry(0.045, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), fur, 0, 0.07, 0);
  add(g, new CylinderGeometry(0.045, 0.048, 0.06, 16), fur, 0, 0.04, 0);
  for (const s of [-1, 1]) {
    add(g, new SphereGeometry(0.011, 8, 6), WHITE, s * 0.017, 0.08, 0.038);
    add(g, new SphereGeometry(0.006, 8, 6), mat(0x1b2bff), s * 0.017, 0.078, 0.047);
  }
  return g;
}

function miniCabinet() {
  const g = new Group();
  add(g, new BoxGeometry(0.06, 0.14, 0.06), mat(0x1d2bb8, { rough: 0.4 }), 0, 0.07, 0);
  add(g, new BoxGeometry(0.044, 0.04, 0.002), new MeshBasicMaterial({ color: 0x33e6ff }), 0, 0.095, 0.031);
  add(g, new BoxGeometry(0.05, 0.016, 0.002), new MeshBasicMaterial({ color: 0xffd23f }), 0, 0.13, 0.031);
  add(g, new BoxGeometry(0.06, 0.01, 0.02), mat(0x111a6e), 0, 0.065, 0.035);
  return g;
}

export function prizeModel(id) {
  switch (id) {
    case 'bronze': return trophy(0xcd7f32);
    case 'silver': return trophy(0xd8dce6);
    case 'gold': return trophy(0xffd23f);
    case 'duck': return duck();
    case 'sunglasses': return sunglasses();
    case 'keychain': return keychain();
    case 'ghostPlush': return ghostPlush();
    case 'miniCabinet': return miniCabinet();
    default: return plush(id);
  }
}
