/* Grúa de peluches: urna de cristal con peluches, pinza con cable y tres dedos, palanca y botón.
   Es a la vez estación (para sentarse delante) y «máquina» (misma interfaz que ArcadeMachine para App).
   La lógica está en arcade/ClawLogic.js. Coordenadas locales: el frente mira hacia +z. */
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, Vector3, Matrix4
} from 'three';
import { ClawLogic, BOX, CHUTE } from '../arcade/ClawLogic.js';
import { PLUSH } from '../data/prizes.js';
import { plush as plushModel } from './prizeModels.js';
import { makeRng } from '../core/rng.js';
import { FONT_FAMILY } from '../core/font.js';

const W = 0.8, D = 0.8;
const BASE_H = 0.95;
const GLASS_H = 0.9;
const FLOOR_Y = BASE_H + 0.02;
const TOP_Y = BASE_H + GLASS_H - 0.08;      // altura de la pinza recogida
const DROP_SCALE = 1.55;                     // metros de bajada por unidad de profundidad lógica
const SCALE = 1.0;                            // la lógica ya va en metros
const N_PLUSH = 14;
const font = (px) => px + 'px ' + FONT_FAMILY + ', monospace';
const mat = (color, rough = 0.5, extra = {}) => new MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));

function marquee() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff3d8b');
  grad.addColorStop(1, '#7d1d6e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = i % 2 ? '#ffd23f' : '#ffffff';
    g.beginPath(); g.arc(30 + i * 56, 20, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(30 + i * 56, 236, 9, 0, Math.PI * 2); g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 16;
  g.strokeStyle = '#3a0a30';
  g.font = font(76);
  g.strokeText('GRÚA', 512, 100);
  g.fillStyle = '#ffffff';
  g.fillText('GRÚA', 512, 100);
  g.font = font(40);
  g.lineWidth = 10;
  g.strokeText('DE PELUCHES', 512, 176);
  g.fillStyle = '#ffd23f';
  g.fillText('DE PELUCHES', 512, 176);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function frontPanel() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 600;
  const g = c.getContext('2d');
  g.fillStyle = '#2a0f3a';
  g.fillRect(0, 0, 512, 600);
  g.fillStyle = '#ff3d8b';
  for (let y = 0; y < 600; y += 60) g.fillRect(0, y, 512, 8);
  g.fillStyle = '#ffffff';
  g.font = font(30);
  g.textAlign = 'center';
  g.fillText('1 MONEDA', 256, 120);
  g.fillText('= 1 INTENTO', 256, 165);
  g.fillStyle = '#ffd23f';
  g.font = font(22);
  g.fillText('FLECHAS: MOVER', 256, 260);
  g.fillText('ESPACIO: ¡BAJAR!', 256, 300);
  g.fillStyle = '#2fd8ff';
  g.fillText('15 SEGUNDOS', 256, 360);
  g.fillStyle = '#0a0a14';
  g.fillRect(40, 430, 170, 130);
  g.fillStyle = '#ffffff';
  g.font = font(18);
  g.fillText('PREMIOS', 125, 590);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class ClawMachine {
  constructor(opts) {
    this.id = 'claw';
    this.name = 'GRÚA DE PELUCHES';
    this.title = 'GRÚA DE PELUCHES';
    this.audio = opts.audio;
    this.users = opts.users;
    this.onWin = opts.onWin || (() => {});
    this.rng = makeRng(opts.seed || 1234);
    this.hint = ['ENTER', 'MONEDA', 'FLECHAS', 'MOVER', 'ESPACIO', 'BAJAR', 'Q', 'LEVANTARSE'];
    this.state = 'ATTRACT';
    this.dirty = false;
    this.texture = null;
    this.noCoin = 0;
    const group = new Group();
    group.name = 'claw-machine';
    this.group = group;

    const body = mat(0xff3d8b, 0.45);
    const frame = mat(0xe8e0f0, 0.3, { metalness: 0.4 });
    const box = (w, h, d, m, x, y, z, parent = group) => { const mesh = new Mesh(new BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
    // Mueble base con frontal impreso, boca de premios y panel de mandos.
    const panelMat = new MeshStandardMaterial({ map: frontPanel(), roughness: 0.5 });
    box(W, BASE_H, D, [body, body, body, body, panelMat, body], 0, BASE_H / 2, 0);
    box(0.18, 0.14, 0.03, mat(0x05050a), -0.22, 0.24, D / 2 + 0.005);
    const shelf = box(W, 0.05, 0.2, mat(0x1b1240, 0.4), 0, BASE_H - 0.05, D / 2 + 0.08);
    shelf.rotation.x = 0.15;
    // Palanca y botón.
    this.stick = new Group();
    this.stick.position.set(0.05, BASE_H - 0.02, D / 2 + 0.09);
    const shaft = new Mesh(new CylinderGeometry(0.007, 0.007, 0.08, 10), mat(0xc8c8d0, 0.3, { metalness: 0.8 }));
    shaft.position.y = 0.04;
    this.stickBall = new Mesh(new SphereGeometry(0.022, 16, 12), mat(0xffd23f, 0.25));
    this.stickBall.position.y = 0.085;
    this.stick.add(shaft, this.stickBall);
    group.add(this.stick);
    this.button = new Mesh(new CylinderGeometry(0.028, 0.028, 0.02, 20), mat(0x2fd8ff, 0.3, { emissive: 0x2fd8ff, emissiveIntensity: 0.4 }));
    this.button.position.set(0.22, BASE_H - 0.01, D / 2 + 0.09);
    group.add(this.button);
    this._tilt = { x: 0, z: 0 };

    // Urna: suelo, cristales y perfiles.
    box(W - 0.04, 0.02, D - 0.04, mat(0x2a0f3a, 0.8), 0, BASE_H + 0.01, 0);
    const glass = new MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false });
    for (const [w, d, x, z] of [[W, 0.006, 0, D / 2], [W, 0.006, 0, -D / 2], [0.006, D, W / 2, 0], [0.006, D, -W / 2, 0]]) {
      const pane = box(w, GLASS_H, d, glass, x, BASE_H + GLASS_H / 2, z);
      pane.renderOrder = 3;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.03, GLASS_H, 0.03, frame, sx * (W / 2 - 0.015), BASE_H + GLASS_H / 2, sz * (D / 2 - 0.015));
    // Boca de premios: hueco con paredes de metacrilato en la esquina.
    const chute = new Vector3(CHUTE.x * SCALE, 0, CHUTE.z * SCALE);
    box(0.16, 0.16, 0.006, glass, chute.x, FLOOR_Y + 0.08, chute.z - 0.08).renderOrder = 3;
    box(0.006, 0.16, 0.16, glass, chute.x + 0.08, FLOOR_Y + 0.08, chute.z).renderOrder = 3;
    box(0.15, 0.005, 0.15, mat(0x05050a), chute.x, FLOOR_Y + 0.002, chute.z);
    // Techo luminoso y marquesina.
    box(W, 0.04, D, new MeshBasicMaterial({ color: 0xfff4d8 }), 0, BASE_H + GLASS_H + 0.02, 0);
    box(W + 0.04, 0.26, D + 0.04, body, 0, BASE_H + GLASS_H + 0.17, 0);
    const mq = new Mesh(new PlaneGeometry(W, 0.24), new MeshBasicMaterial({ map: marquee() }));
    mq.position.set(0, BASE_H + GLASS_H + 0.17, D / 2 + 0.025);
    group.add(mq);

    // Peluches en el fondo (posiciones lógicas dentro de BOX).
    this.plush = [];
    for (let i = 0; i < N_PLUSH; i++) this.plush.push(this.newPlush(i));
    // Pórtico, cable y pinza.
    this.rail = box(W - 0.06, 0.02, 0.03, frame, 0, TOP_Y + 0.06, 0);
    this.carriage = box(0.07, 0.04, 0.07, mat(0x3a3e4a, 0.4, { metalness: 0.6 }), 0, TOP_Y + 0.05, 0);
    this.cable = new Mesh(new CylinderGeometry(0.003, 0.003, 1, 6), mat(0x222222, 0.4));
    group.add(this.cable);
    this.claw = new Group();
    const hub = new Mesh(new CylinderGeometry(0.03, 0.035, 0.05, 14), mat(0xd8dce6, 0.25, { metalness: 0.9 }));
    this.claw.add(hub);
    this.prongs = [];
    for (let i = 0; i < 3; i++) {
      const pivot = new Group();
      pivot.rotation.y = (i * Math.PI * 2) / 3;
      const arm = new Group();
      arm.position.set(0, -0.02, 0.025);
      const finger = new Mesh(new BoxGeometry(0.012, 0.09, 0.008), mat(0xd8dce6, 0.25, { metalness: 0.9 }));
      finger.position.y = -0.045;
      const tip = new Mesh(new BoxGeometry(0.012, 0.008, 0.025), mat(0xd8dce6, 0.25, { metalness: 0.9 }));
      tip.position.set(0, -0.09, -0.01);
      arm.add(finger, tip);
      pivot.add(arm);
      this.claw.add(pivot);
      this.prongs.push(arm);
    }
    group.add(this.claw);

    this.logic = new ClawLogic(this.plush.map((p) => p.data), this.rng, (n) => this.audio.play(n));
    this.footprint = [-W / 2 - 0.02, W / 2 + 0.02, -D / 2 - 0.02, D / 2 + 0.2];
    this.poses = {
      seat: { eye: [0, 1.58, D / 2 + 0.6], look: [0, BASE_H + 0.3, 0] },
      zoom: { eye: [0, 1.62, D / 2 + 0.25], look: [0, BASE_H + 0.1, -0.05] }
    };
    this._v = new Vector3();
    this._w = new Vector3();
    this._m = new Matrix4();
    this.respawn = 0;
    this.sync();
  }

  newPlush(i) {
    const kind = PLUSH[i % PLUSH.length];
    const data = { id: kind.id, x: (this.rng() - 0.5) * (BOX.maxX - BOX.minX - 0.1), z: (this.rng() - 0.5) * (BOX.maxZ - BOX.minZ - 0.1), taken: false };
    // Que no caigan dentro de la boca de premios.
    if (Math.hypot(data.x - CHUTE.x, data.z - CHUTE.z) < 0.12) data.x += 0.2;
    const mesh = plushModel(kind.id);
    mesh.scale.setScalar(1.25);
    mesh.rotation.set((this.rng() - 0.5) * 0.6, this.rng() * Math.PI * 2, (this.rng() - 0.5) * 0.6);
    this.group.add(mesh);
    return { data, mesh, h: (i % 3) * 0.04 };
  }

  place(x, z, rotY) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotY;
    this.group.updateMatrixWorld(true);
  }

  collider() {
    const [x0, x1, z0, z1] = this.footprint;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const v = this.group.localToWorld(this._v.set(x, 0, z));
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    return { minX, maxX, minZ, maxZ, id: this.id };
  }

  frontPoint(out, dist = 0.75) {
    return this.group.localToWorld(out.set(0, 0, this.footprint[3] + 0.1 + dist));
  }

  screenPose(camera, fill, outPos, outQuat) {
    const pose = fill > 0.6 ? this.poses.zoom : this.poses.seat;
    this.group.localToWorld(outPos.set(...pose.eye));
    const target = this.group.localToWorld(this._w.set(...pose.look));
    this._m.lookAt(outPos, target, this._v.set(0, 1, 0));
    outQuat.setFromRotationMatrix(this._m);
    return outPos;
  }

  grips(outStick, outButton) {
    this.stickBall.getWorldPosition(outStick);
    this.button.getWorldPosition(outButton);
  }

  animateControls(input, dt) {
    const d = input ? input.down : null;
    const tx = d ? (d.left ? 1 : 0) - (d.right ? 1 : 0) : 0;
    const tz = d ? (d.down ? 1 : 0) - (d.up ? 1 : 0) : 0;
    const k = Math.min(1, dt * 18);
    this._tilt.x += (tz * 0.38 - this._tilt.x) * k;
    this._tilt.z += (tx * 0.38 - this._tilt.z) * k;
    this.stick.rotation.set(this._tilt.x, 0, this._tilt.z);
    this.button.position.y = BASE_H - 0.01 - (d && d.jump ? 0.008 : 0);
  }

  // Coloca pinza, cable y peluches según la lógica.
  sync() {
    const L = this.logic;
    const x = L.x * SCALE, z = L.z * SCALE;
    const y = TOP_Y - L.y * DROP_SCALE;
    this.rail.position.z = z;
    this.carriage.position.set(x, TOP_Y + 0.05, z);
    this.claw.position.set(x, y, z);
    const len = TOP_Y + 0.05 - y;
    this.cable.scale.y = Math.max(0.01, len);
    this.cable.position.set(x, y + len / 2, z);
    const spread = 0.15 + L.open * 0.55;
    for (const a of this.prongs) a.rotation.x = spread;
    for (const p of this.plush) {
      if (p.data === L.held) p.mesh.position.set(x, y - 0.16, z);
      else if (!p.data.taken) p.mesh.position.set(p.data.x * SCALE, FLOOR_Y + p.h, p.data.z * SCALE);
      p.mesh.visible = !p.data.taken || p.data === L.held;
    }
  }

  // ---------------------------------------------------------------- interfaz de «máquina»

  insert() { this.state = 'TITLE'; }

  // Al levantarse, si estaba moviendo la pinza, baja sola donde esté (como si se acabara el tiempo).
  leave() {
    if (this.logic.state === 'MOVE') this.logic.timer = 1;
    this.state = 'ATTRACT';
  }

  tryStart() {
    if (this.logic.state !== 'IDLE') return false;
    const user = this.users.active();
    if (!user || !this.users.spendCoin(user.id)) {
      this.audio.play('error');
      this.noCoin = 90;
      return false;
    }
    this.audio.play('coin');
    this.logic.start();
    this.state = 'PLAYING';
    return true;
  }

  start() { return this.tryStart(); }

  pause() {
    if (this.state !== 'PLAYING') return false;
    this.state = 'PAUSED';
    return true;
  }

  resume() {
    if (this.state !== 'PAUSED') return false;
    this.state = 'PLAYING';
    return true;
  }

  update(input) {
    if (this.noCoin > 0) this.noCoin--;
    if (this.state === 'PAUSED') return;
    if (this.state === 'TITLE' && input && (input.pressed.start || input.pressed.jump)) {
      this.tryStart();
      return;
    }
    // La pinza termina su ciclo aunque el jugador se haya ido.
    const won = this.logic.update(this.state === 'PLAYING' ? input : null);
    if (won) this.onWin(won);
    if (this.logic.state === 'IDLE' && this.state === 'PLAYING') this.state = 'TITLE';
    // Los peluches ganados reaparecen al rato para que la urna no se vacíe.
    if (this.plush.some((p) => p.data.taken && p.data !== this.logic.held) && ++this.respawn > 600) {
      this.respawn = 0;
      const p = this.plush.find((q) => q.data.taken && q.data !== this.logic.held);
      p.data.taken = false;
      p.data.x = (this.rng() - 0.5) * 0.4;
      p.data.z = (this.rng() - 0.5) * 0.3;
    }
  }

  render() { return false; }

  tick() { this.sync(); }
  setCrt() {}
  setPower() {}
}
