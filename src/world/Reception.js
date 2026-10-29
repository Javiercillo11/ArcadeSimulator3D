/* Recepción: mostrador, recepcionista (Mari) con animaciones, estantería con el catálogo de premios,
   y la vitrina con los premios del jugador. Coordenadas locales: el mostrador mira hacia +z. */
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, Vector3
} from 'three';
import { FONT_FAMILY } from '../core/font.js';
import { PRIZES } from '../data/prizes.js';
import { prizeModel } from './prizeModels.js';

const COUNTER = { w: 2.2, h: 1.05, d: 0.6 };
const NPC_Z = -0.55;
const COINS = 5;
const font = (px) => px + 'px ' + FONT_FAMILY + ', monospace';
const mat = (color, rough = 0.6, extra = {}) => new MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function counterFront() {
  return canvasTex(1024, 480, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a1650');
    grad.addColorStop(1, '#12082a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = ['#ff3d8b', '#2fd8ff', '#ffd23f'][i % 3];
      g.globalAlpha = 0.25;
      g.beginPath();
      g.moveTo(i * 180 - 100, h); g.lineTo(i * 180 - 40, h); g.lineTo(i * 180 + 160, 0); g.lineTo(i * 180 + 100, 0);
      g.fill();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff3d8b';
    g.shadowBlur = 24;
    g.fillStyle = '#ffffff';
    g.font = font(72);
    g.fillText('RECEPCIÓN', w / 2, 150);
    g.shadowBlur = 0;
    g.font = font(30);
    g.fillStyle = '#ffd23f';
    g.fillText('MONEDAS · PREMIOS · TICKETS', w / 2, 260);
    g.fillStyle = '#2fd8ff';
    g.font = font(24);
    g.fillText('PREGUNTA POR MARI', w / 2, 340);
  });
}

function nameTag(name) {
  return canvasTex(128, 48, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3d8b';
    g.fillRect(0, 0, w, 10);
    g.fillStyle = '#1a1a2a';
    g.font = font(18);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, w / 2, 30);
  });
}

function priceTag(cost) {
  return canvasTex(128, 48, (g, w, h) => {
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1a2a';
    g.font = font(18);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(cost + ' TIC.', w / 2, h / 2 + 2);
  });
}

// ------------------------------------------------------------ recepcionista

function buildPerson() {
  // Un poco de brillo propio: así las luces de colores del salón no le tiñen la cara.
  const skin = mat(0xe8b08a, 0.7, { emissive: 0x4a2a1c, emissiveIntensity: 0.6 });
  const uniform = mat(0xb81d7e, 0.55);
  const shirt = mat(0xffffff, 0.6);
  const hairMat = mat(0x3a1d10, 0.8);
  const dark = mat(0x1a1010, 0.4);
  const root = new Group();
  const add = (parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const mesh = new Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  // Cadera y torso (la parte baja queda oculta tras el mostrador).
  add(root, new CylinderGeometry(0.15, 0.16, 0.3, 16), mat(0x1b1240), 0, 0.85, 0, 1, 1, 0.7);
  const torso = new Group();
  torso.position.y = 1.0;
  root.add(torso);
  add(torso, new CylinderGeometry(0.18, 0.15, 0.44, 18), uniform, 0, 0.2, 0, 1, 1, 0.68);
  add(torso, new BoxGeometry(0.1, 0.16, 0.02), shirt, 0, 0.33, 0.1);
  const tag = add(torso, new PlaneGeometry(0.075, 0.028), new MeshBasicMaterial({ map: nameTag('MARI') }), 0.075, 0.29, 0.112);
  tag.rotation.y = 0.15;
  add(torso, new SphereGeometry(0.075, 12, 8), uniform, -0.17, 0.39, 0, 1, 0.8, 0.9);
  add(torso, new SphereGeometry(0.075, 12, 8), uniform, 0.17, 0.39, 0, 1, 0.8, 0.9);
  add(torso, new CylinderGeometry(0.045, 0.05, 0.09, 12), skin, 0, 0.47, 0);
  // Cabeza: cara, pelo con coleta, ojos que parpadean, cejas, boca que habla.
  const head = new Group();
  head.position.y = 0.5;
  torso.add(head);
  add(head, new SphereGeometry(0.105, 20, 16), skin, 0, 0.1, 0, 1, 1.1, 1);
  add(head, new SphereGeometry(0.113, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 0.115, -0.008, 1, 1.12, 1.02);
  add(head, new BoxGeometry(0.17, 0.035, 0.04), hairMat, 0, 0.19, 0.075);
  add(head, new SphereGeometry(0.05, 12, 10), hairMat, 0, 0.16, -0.11);
  const tail = add(head, new CylinderGeometry(0.03, 0.012, 0.16, 10), hairMat, 0, 0.07, -0.14);
  tail.rotation.x = 0.35;
  add(head, new SphereGeometry(0.016, 8, 6), mat(0xff3d8b), 0, 0.165, -0.14);
  const eyes = [];
  for (const s of [-1, 1]) {
    add(head, new SphereGeometry(0.019, 10, 8), shirt, s * 0.037, 0.115, 0.088, 1, 1, 0.5);
    eyes.push(add(head, new SphereGeometry(0.011, 10, 8), dark, s * 0.037, 0.115, 0.097, 1, 1, 0.6));
    const brow = add(head, new BoxGeometry(0.03, 0.006, 0.006), hairMat, s * 0.037, 0.145, 0.097);
    brow.rotation.z = -s * 0.15;
    add(head, new SphereGeometry(0.016, 8, 6), mat(0xff9aa8, 0.8), s * 0.06, 0.075, 0.08, 1, 0.6, 0.4);
  }
  add(head, new SphereGeometry(0.012, 8, 6), skin, 0, 0.09, 0.105);
  const mouth = add(head, new BoxGeometry(0.035, 0.008, 0.01), mat(0xa8243a, 0.5), 0, 0.055, 0.098);
  // Brazos: hombro y codo articulados.
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(s * 0.2, 0.37, 0);
    torso.add(shoulder);
    add(shoulder, new CylinderGeometry(0.045, 0.04, 0.26, 10), uniform, 0, -0.13, 0);
    const elbow = new Group();
    elbow.position.y = -0.26;
    shoulder.add(elbow);
    add(elbow, new CylinderGeometry(0.036, 0.03, 0.22, 10), skin, 0, -0.11, 0);
    add(elbow, new SphereGeometry(0.035, 10, 8), skin, 0, -0.24, 0, 0.9, 1.1, 0.6);
    arms.push({ shoulder, elbow, side: s });
  }
  root.traverse((o) => { o.castShadow = false; });
  return { root, torso, head, eyes, mouth, arms };
}

export class Reception {
  constructor() {
    this.id = 'reception';
    this.title = 'RECEPCIÓN';
    this.promptText = 'HABLAR CON MARI';
    const group = new Group();
    group.name = 'reception';
    this.group = group;

    // Mostrador: cuerpo con frontal impreso, encimera que sobresale y zócalo luminoso.
    const front = new MeshStandardMaterial({ map: counterFront(), roughness: 0.5 });
    front.emissiveMap = front.map;
    front.emissive.set(0xffffff);
    front.emissiveIntensity = 0.25;
    const side = mat(0x1b1240, 0.5);
    const body = new Mesh(new BoxGeometry(COUNTER.w, COUNTER.h - 0.05, COUNTER.d), [side, side, side, side, front, side]);
    body.position.y = (COUNTER.h - 0.05) / 2;
    group.add(body);
    const top = new Mesh(new BoxGeometry(COUNTER.w + 0.08, 0.05, COUNTER.d + 0.14), mat(0xe8e0f0, 0.25, { metalness: 0.1 }));
    top.position.set(0, COUNTER.h - 0.025, 0.04);
    group.add(top);
    const led = new Mesh(new BoxGeometry(COUNTER.w, 0.03, 0.02), new MeshBasicMaterial({ color: 0xff3d8b }));
    led.position.set(0, 0.04, COUNTER.d / 2 + 0.005);
    group.add(led);
    // Timbre y caja registradora.
    const bell = new Group();
    bell.add(new Mesh(new CylinderGeometry(0.04, 0.045, 0.012, 16), mat(0x222222, 0.4)));
    const dome = new Mesh(new SphereGeometry(0.035, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8c060, 0.2, { metalness: 0.9 }));
    dome.position.y = 0.006;
    bell.add(dome);
    bell.position.set(0.55, COUNTER.h, 0.18);
    group.add(bell);
    this.bell = bell;
    const register = new Mesh(new BoxGeometry(0.3, 0.16, 0.24), mat(0x3a3e4a, 0.4, { metalness: 0.5 }));
    register.position.set(-0.7, COUNTER.h + 0.08, -0.05);
    register.rotation.y = 0.25;
    group.add(register);
    const screen = new Mesh(new PlaneGeometry(0.16, 0.07), new MeshBasicMaterial({ color: 0x3dff8b }));
    screen.position.set(-0.68, COUNTER.h + 0.2, 0.0);
    screen.rotation.y = 0.25;
    group.add(screen);

    // Estantería con el catálogo detrás de la recepcionista.
    const shelfZ = -0.95;
    const back = new Mesh(new BoxGeometry(2.1, 1.5, 0.04), mat(0x241640, 0.7));
    back.position.set(0, 1.6, shelfZ - 0.02);
    group.add(back);
    const sign = new Mesh(new PlaneGeometry(1.2, 0.18), new MeshBasicMaterial({
      map: canvasTex(768, 112, (g, w, h) => {
        g.fillStyle = '#0a0716'; g.fillRect(0, 0, w, h);
        g.font = font(46); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = '#ffd23f'; g.shadowBlur = 18; g.fillStyle = '#ffd23f';
        g.fillText('PREMIOS', w / 2, h / 2 + 4);
      })
    }));
    sign.position.set(0, 2.45, shelfZ + 0.01);
    group.add(sign);
    const shelves = [1.12, 1.62, 2.1];
    for (const y of shelves) {
      const s = new Mesh(new BoxGeometry(2.0, 0.03, 0.3), mat(0xe8e0f0, 0.3));
      s.position.set(0, y, shelfZ + 0.15);
      group.add(s);
    }
    PRIZES.forEach((p, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      const n = row === 2 ? 2 : 3;
      const x = (col - (n - 1) / 2) * 0.62;
      const model = prizeModel(p.id);
      model.scale.setScalar(1.4);
      model.position.set(x, shelves[row] + 0.015, shelfZ + 0.12);
      group.add(model);
      const tagMesh = new Mesh(new PlaneGeometry(0.12, 0.045), new MeshBasicMaterial({ map: priceTag(p.cost) }));
      tagMesh.position.set(x, shelves[row] - 0.01, shelfZ + 0.305);
      group.add(tagMesh);
    });

    // Recepcionista.
    this.person = buildPerson();
    this.person.root.position.z = NPC_Z;
    group.add(this.person.root);

    // Bocadillo de texto.
    this.bubbleCanvas = document.createElement('canvas');
    this.bubbleCanvas.width = 512;
    this.bubbleCanvas.height = 180;
    this.bubbleTex = new CanvasTexture(this.bubbleCanvas);
    this.bubbleTex.colorSpace = SRGBColorSpace;
    this.bubble = new Sprite(new SpriteMaterial({ map: this.bubbleTex, transparent: true, depthTest: false }));
    this.bubble.scale.set(0.95, 0.334, 1);
    this.bubble.position.set(0, 1.98, NPC_Z + 0.05);
    this.bubble.visible = false;
    this.bubble.renderOrder = 10;
    group.add(this.bubble);

    // Monedas que Mari deja en el mostrador.
    const coinGeo = new CylinderGeometry(0.014, 0.014, 0.004, 18);
    const coinMat = mat(0xffd23f, 0.25, { metalness: 0.9, emissive: 0x5a4300 });
    this.coins = [];
    for (let i = 0; i < COINS; i++) {
      const m = new Mesh(coinGeo, coinMat);
      m.visible = false;
      group.add(m);
      this.coins.push({ mesh: m, vy: 0, delay: 0, life: 0, rest: 0 });
    }

    this.t = 0;
    this.blink = 2;
    this.talk = 0;
    this.wave = 0;
    this.give = 0;
    this.waveCooldown = 0;
    this.bubbleTime = 0;
    this._v = new Vector3();
    this._w = new Vector3();
  }

  place(x, z, rotY) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotY;
    this.group.updateMatrixWorld(true);
  }

  collider() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of [[-COUNTER.w / 2 - 0.05, -1.0], [COUNTER.w / 2 + 0.05, -1.0], [-COUNTER.w / 2 - 0.05, COUNTER.d / 2 + 0.12], [COUNTER.w / 2 + 0.05, COUNTER.d / 2 + 0.12]]) {
      const v = this.group.localToWorld(this._v.set(x, 0, z));
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    return { minX, maxX, minZ, maxZ, id: this.id };
  }

  frontPoint(out, dist = 0.75) {
    return this.group.localToWorld(out.set(0, 0, COUNTER.d / 2 + 0.12 + dist));
  }

  // Muestra un bocadillo durante unos segundos (texto en una o dos líneas separadas por \n).
  say(text, seconds = 3.5) {
    const g = this.bubbleCanvas.getContext('2d');
    const w = 512, h = 180;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#1a1a2a';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(30, 10); g.lineTo(w - 30, 10); g.quadraticCurveTo(w - 10, 10, w - 10, 30);
    g.lineTo(w - 10, 120); g.quadraticCurveTo(w - 10, 140, w - 30, 140);
    g.lineTo(280, 140); g.lineTo(250, 172); g.lineTo(240, 140);
    g.lineTo(30, 140); g.quadraticCurveTo(10, 140, 10, 120); g.lineTo(10, 30); g.quadraticCurveTo(10, 10, 30, 10);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#1a1a2a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = String(text).split('\n');
    // Letra más pequeña si la línea más larga no cabe en el bocadillo.
    let size = lines.length > 1 ? 24 : 28;
    g.font = font(size);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (widest > w - 50) size = Math.floor(size * (w - 50) / widest);
    g.font = font(size);
    lines.forEach((l, i) => g.fillText(l, w / 2, 75 + (i - (lines.length - 1) / 2) * 38));
    this.bubbleTex.needsUpdate = true;
    this.bubble.visible = true;
    this.bubbleTime = seconds;
    this.talk = Math.min(seconds, 1.6);
    this.lastSaid = text;
  }

  // Mari alarga la mano y deja n monedas en el mostrador.
  giveCoins(n) {
    this.give = 1.2;
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      c.mesh.visible = false;
      if (i >= n) { c.life = 0; continue; }
      c.delay = 0.35 + i * 0.1;
      c.vy = 0;
      c.life = 5;
      c.rest = COUNTER.h + 0.002 + i * 0.0045;
      c.mesh.position.set(0.18 + (i - 2) * 0.03, COUNTER.h + 0.25, 0.05);
      c.mesh.rotation.set(0, 0, 0.3);
    }
  }

  ringBell() {
    this.bellT = 0.4;
  }

  // dt en segundos; eye: posición de la cámara en mundo (para mirar al jugador).
  update(dt, eye) {
    this.t += dt;
    const p = this.person;
    // Respirar y balancearse un poco.
    p.torso.scale.set(1, 1 + Math.sin(this.t * 1.6) * 0.008, 1);
    p.torso.rotation.z = Math.sin(this.t * 0.7) * 0.02;
    // Mirar al jugador si está cerca.
    const local = this.group.worldToLocal(this._w.copy(eye));
    const dx = local.x, dz = local.z - NPC_Z, dy = local.y - 1.6;
    const dist = Math.hypot(dx, dz);
    let yaw = 0, pitch = 0;
    if (dist < 6) {
      yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(dx, dz)));
      pitch = Math.max(-0.3, Math.min(0.3, -Math.atan2(dy, dist)));
    }
    p.head.rotation.y += (yaw - p.head.rotation.y) * Math.min(1, dt * 5);
    p.head.rotation.x += (pitch - p.head.rotation.x) * Math.min(1, dt * 5);
    // Parpadeo.
    this.blink -= dt;
    const closed = this.blink < 0.12;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3;
    for (const e of p.eyes) e.scale.y = closed ? 0.1 : 1;
    // Boca al hablar.
    if (this.talk > 0) this.talk -= dt;
    p.mouth.scale.y = this.talk > 0 ? 1 + Math.abs(Math.sin(this.t * 18)) * 2.5 : 1;
    // Saludo al acercarse (como mucho cada 20 s).
    this.waveCooldown -= dt;
    if (dist < 3 && this.waveCooldown <= 0) { this.wave = 2; this.waveCooldown = 20; }
    if (this.wave > 0) this.wave -= dt;
    if (this.give > 0) this.give -= dt;
    const [left, right] = p.arms;
    // Reposo: manos apoyadas en el mostrador.
    left.shoulder.rotation.set(-0.55, 0, -0.12);
    left.elbow.rotation.set(-0.9, 0, 0);
    if (this.give > 0) {
      right.shoulder.rotation.set(-1.35, 0, 0.05);
      right.elbow.rotation.set(-0.25, 0, 0);
    } else if (this.wave > 0) {
      right.shoulder.rotation.set(-0.2, 0, 2.5);
      right.elbow.rotation.set(0, 0, 0.4 + Math.sin(this.t * 12) * 0.45);
    } else {
      right.shoulder.rotation.set(-0.55, 0, 0.12);
      right.elbow.rotation.set(-0.9, 0, 0);
    }
    // Bocadillo.
    if (this.bubbleTime > 0) {
      this.bubbleTime -= dt;
      if (this.bubbleTime <= 0) this.bubble.visible = false;
    }
    // Timbre.
    if (this.bellT > 0) {
      this.bellT -= dt;
      this.bell.children[1].position.y = 0.006 - Math.max(0, this.bellT - 0.3) * 0.05;
    }
    // Monedas cayendo.
    for (const c of this.coins) {
      if (c.life <= 0) continue;
      if (c.delay > 0) { c.delay -= dt; continue; }
      c.mesh.visible = true;
      c.life -= dt;
      c.vy -= 9.8 * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.rotation.z *= 0.9;
      if (c.mesh.position.y <= c.rest) {
        c.mesh.position.y = c.rest;
        c.vy = Math.abs(c.vy) > 0.4 ? -c.vy * 0.3 : 0;
      }
      if (c.life <= 0) c.mesh.visible = false;
    }
  }
}

// ------------------------------------------------------------ vitrina con los premios del jugador

export class PrizeCase {
  constructor() {
    const group = new Group();
    group.name = 'prize-case';
    this.group = group;
    const W = 1.3, H = 1.9, D = 0.42;
    const frame = mat(0x2a2a3a, 0.4, { metalness: 0.6 });
    const glass = new MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const box = (w, h, d, m, x, y, z) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    box(W, 0.1, D, frame, 0, 0.05, 0);
    box(W, 0.06, D, frame, 0, H - 0.03, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.03, H, 0.03, frame, sx * (W / 2 - 0.015), H / 2, sz * (D / 2 - 0.015));
    box(W - 0.04, H - 0.16, 0.01, mat(0x1b1240, 0.8), 0, H / 2, -D / 2 + 0.01);
    this.shelves = [0.35, 0.75, 1.15, 1.55];
    for (const y of this.shelves) box(W - 0.06, 0.012, D - 0.06, glass, 0, y - 0.006, 0);
    const front = box(W - 0.06, H - 0.16, 0.006, glass, 0, H / 2, D / 2 - 0.01);
    front.renderOrder = 2;
    box(W - 0.06, 0.02, 0.02, new MeshBasicMaterial({ color: 0xfff4d8 }), 0, H - 0.07, D / 2 - 0.04);
    const sign = new Mesh(new PlaneGeometry(1.0, 0.16), new MeshBasicMaterial({
      map: canvasTex(640, 104, (g, w, h) => {
        g.fillStyle = '#0a0716'; g.fillRect(0, 0, w, h);
        g.font = font(40); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = '#2fd8ff'; g.shadowBlur = 16; g.fillStyle = '#2fd8ff';
        g.fillText('TUS PREMIOS', w / 2, h / 2 + 4);
      })
    }));
    sign.position.set(0, H + 0.12, 0);
    group.add(sign);
    this.items = new Group();
    group.add(this.items);
    this.W = W;
    this.D = D;
    this.key = '';
    this._v = new Vector3();
  }

  place(x, z, rotY) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotY;
    this.group.updateMatrixWorld(true);
  }

  collider() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of [[-this.W / 2, -this.D / 2], [this.W / 2, -this.D / 2], [-this.W / 2, this.D / 2], [this.W / 2, this.D / 2]]) {
      const v = this.group.localToWorld(this._v.set(x, 0, z));
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    return { minX, maxX, minZ, maxZ, id: 'prize-case' };
  }

  // Coloca los premios del jugador: 6 por balda, de abajo arriba.
  setPrizes(list) {
    const key = list.join(',');
    if (key === this.key) return;
    this.key = key;
    this.items.clear();
    list.slice(0, 24).forEach((id, i) => {
      const shelf = Math.floor(i / 6), col = i % 6;
      const m = prizeModel(id);
      m.position.set(-0.5 + col * 0.2, this.shelves[shelf], (shelf % 2 ? -0.03 : 0.03));
      m.rotation.y = ((i * 37) % 9 - 4) * 0.08;
      this.items.add(m);
    });
  }
}
