/* Mesas de juego: AIR HOCKEY y SKEE-BALL. La superficie es el canvas de su máquina (ArcadeMachine) como textura,
   así el juego 2D se ve sobre la mesa. Tienen la misma interfaz que las recreativas para sentarse a jugar.
   Coordenadas locales: el extremo del jugador mira hacia +z. */
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, Vector3, Matrix4
} from 'three';
import { FONT_FAMILY } from '../core/font.js';

const mat = (color, rough = 0.5, extra = {}) => new MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));
const font = (px) => px + 'px ' + FONT_FAMILY + ', monospace';

function surfaceTexture(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Plano con solo una franja vertical [v0, v1] de la textura (para doblar la pista de skee en dos tramos).
function stripPlane(w, h, v0, v1) {
  const geo = new PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  return geo;
}

class TableStation {
  constructor(id, title, machineCanvas) {
    this.id = id;
    this.title = title;
    this.group = new Group();
    this.group.name = id;
    this.texture = surfaceTexture(machineCanvas);
    this.machine = null;      // lo asigna App
    this._v = new Vector3();
    this._w = new Vector3();
    this._m = new Matrix4();
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

  // Pose de la cámara: de pie en el extremo de la mesa (fill > 0.6 → la vista cercana de F).
  screenPose(camera, fill, outPos, outQuat) {
    const pose = fill > 0.6 ? this.poses.zoom : this.poses.seat;
    this.group.localToWorld(outPos.set(...pose.eye));
    const target = this.group.localToWorld(this._w.set(...pose.look));
    this._m.lookAt(outPos, target, this._v.set(0, 1, 0));
    outQuat.setFromRotationMatrix(this._m);
    return outPos;
  }

  // La partida que se está viendo (la del jugador o la demo).
  game() {
    const m = this.machine;
    if (!m) return null;
    return m.state === 'ATTRACT' ? m.demo : m.game;
  }

  setCrt() {}
  setPower() {}
}

// ------------------------------------------------------------ air hockey

const HW = 1.0;                 // ancho de la superficie
const HL = HW * 400 / 224;      // largo (misma proporción que el canvas)
const HY = 0.82;                // altura de la superficie

export class HockeyTable extends TableStation {
  constructor(machineCanvas) {
    super('hockey', 'AIR HOCKEY', machineCanvas);
    const g = this.group;
    const body = mat(0x1b2bb8, 0.4);
    const rail = mat(0xe8e0f0, 0.3);
    const legMat = mat(0x111111, 0.5, { metalness: 0.6 });
    const box = (w, h, d, m, x, y, z) => { const mesh = new Mesh(new BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, HY - 0.15, 0.08, legMat, sx * (HW / 2 - 0.05), (HY - 0.15) / 2, sz * (HL / 2 - 0.1));
    box(HW + 0.12, 0.2, HL + 0.12, body, 0, HY - 0.1, 0);
    // Bandas alrededor, con hueco en las porterías.
    const goalW = HW * 80 / 224;
    const side = (HW - goalW) / 2;
    for (const sz of [-1, 1]) {
      box(side, 0.06, 0.06, rail, -(goalW / 2 + side / 2), HY + 0.02, sz * (HL / 2 + 0.03));
      box(side, 0.06, 0.06, rail, goalW / 2 + side / 2, HY + 0.02, sz * (HL / 2 + 0.03));
      box(goalW, 0.02, 0.1, mat(0x05050a), 0, HY - 0.005, sz * (HL / 2 + 0.04));
    }
    for (const sx of [-1, 1]) box(0.06, 0.06, HL + 0.12, rail, sx * (HW / 2 + 0.03), HY + 0.02, 0);
    // Luces de neón en los costados.
    for (const sx of [-1, 1]) box(0.012, 0.03, HL, new MeshBasicMaterial({ color: sx < 0 ? 0xff3d8b : 0x2fd8ff }), sx * (HW / 2 + 0.067), HY - 0.1, 0);
    const surface = new Mesh(new PlaneGeometry(HW, HL), new MeshStandardMaterial({ map: this.texture, roughness: 0.25, emissiveMap: this.texture, emissive: 0xffffff, emissiveIntensity: 0.35 }));
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = HY + 0.001;
    g.add(surface);
    // Mazos en 3D sobre los dibujados en la mesa (el del jugador se agarra con la mano).
    const knob = (color) => {
      const k = new Group();
      const base = new Mesh(new CylinderGeometry(0.055, 0.058, 0.025, 20), mat(color, 0.35));
      base.position.y = 0.0125;
      const handle = new Mesh(new CylinderGeometry(0.022, 0.026, 0.06, 14), mat(color, 0.35));
      handle.position.y = 0.055;
      const top = new Mesh(new SphereGeometry(0.026, 14, 10), mat(color, 0.35));
      top.position.y = 0.085;
      k.add(base, handle, top);
      g.add(k);
      return k;
    };
    this.playerKnob = knob(0xff3d8b);
    this.cpuKnob = knob(0x2fd8ff);
    this.footprint = [-HW / 2 - 0.08, HW / 2 + 0.08, -HL / 2 - 0.1, HL / 2 + 0.1];
    this.poses = {
      seat: { eye: [0, 1.6, HL / 2 + 0.55], look: [0, HY, 0.05] },
      zoom: { eye: [0, 2.05, HL / 2 - 0.05], look: [0, HY, -0.05] }
    };
    this.hint = ['ENTER', 'EMPEZAR', 'FLECHAS', 'MAZO', 'G', 'GRANDE', 'Q', 'LEVANTARSE'];
    this.updateKnobs();
  }

  // Posición en la mesa (coordenadas del canvas 224×400) → local.
  toLocal(out, x, y, h = 0) {
    return out.set((x / 224 - 0.5) * HW, HY + h, (y / 400 - 0.5) * HL);
  }

  updateKnobs() {
    const g = this.game();
    const p = g ? g.player : { x: 112, y: 350 }, c = g ? g.cpu : { x: 112, y: 50 };
    this.toLocal(this.playerKnob.position, p.x, p.y);
    this.toLocal(this.cpuKnob.position, c.x, c.y);
  }

  grips(outStick, outButton) {
    this.group.localToWorld(outStick.set(-HW / 2 + 0.05, HY + 0.06, HL / 2 + 0.02));
    this.playerKnob.getWorldPosition(outButton);
    outButton.y += 0.07;
  }

  animateControls() {}
  tick() { this.updateKnobs(); }
}

// ------------------------------------------------------------ skee-ball

const SW = 0.8;                         // ancho de la pista
const SL = SW * 560 / 224;              // largo total del canvas en metros
const SPLIT = 324 / 560;                // parte de abajo del canvas = pista; arriba = diana
const LANE_LEN = SL * SPLIT;
const BOARD_LEN = SL - LANE_LEN;
const LANE_Y = 0.78;
const LANE_TILT = 0.06;
const BOARD_TILT = 0.56;

function scoreBoardCanvas() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  return c;
}

export class SkeeLane extends TableStation {
  constructor(machineCanvas) {
    super('skee', 'SKEE-BALL', machineCanvas);
    const g = this.group;
    const wood = mat(0x6a3a18, 0.6);
    const neon = new MeshBasicMaterial({ color: 0xff3d8b });
    const box = (w, h, d, m, x, y, z) => { const mesh = new Mesh(new BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
    const zNear = 0.95;
    const zSplit = zNear - LANE_LEN * Math.cos(LANE_TILT);
    const ySplit = LANE_Y + LANE_LEN * Math.sin(LANE_TILT);
    const zFar = zSplit - BOARD_LEN * Math.cos(BOARD_TILT);
    const yFar = ySplit + BOARD_LEN * Math.sin(BOARD_TILT);
    // Mueble bajo la pista y laterales con neón.
    box(SW + 0.16, LANE_Y - 0.02, zNear - zFar + 0.1, mat(0x8a0d3e, 0.5), 0, (LANE_Y - 0.02) / 2, (zNear + zFar) / 2);
    for (const sx of [-1, 1]) {
      const wall = box(0.06, 0.22, zNear - zFar + 0.1, wood, sx * (SW / 2 + 0.05), LANE_Y + 0.1, (zNear + zFar) / 2);
      wall.scale.y = 1;
      box(0.015, 0.02, zNear - zFar + 0.1, neon, sx * (SW / 2 + 0.085), LANE_Y + 0.2, (zNear + zFar) / 2);
    }
    // Pista (tramo casi plano) y diana inclinada, con la misma textura.
    const surfMat = new MeshStandardMaterial({ map: this.texture, roughness: 0.35, emissiveMap: this.texture, emissive: 0xffffff, emissiveIntensity: 0.3 });
    const lane = new Mesh(stripPlane(SW, LANE_LEN, 0, SPLIT), surfMat);
    lane.rotation.x = -Math.PI / 2 + LANE_TILT;
    lane.position.set(0, (LANE_Y + ySplit) / 2, (zNear + zSplit) / 2);
    g.add(lane);
    const board = new Mesh(stripPlane(SW, BOARD_LEN, SPLIT, 1), surfMat);
    board.rotation.x = -Math.PI / 2 + BOARD_TILT;
    board.position.set(0, (ySplit + yFar) / 2, (zSplit + zFar) / 2);
    g.add(board);
    // Panel trasero con el marcador (se redibuja con la partida).
    box(SW + 0.16, 1.0, 0.08, mat(0x1b1240, 0.6), 0, yFar + 0.3, zFar - 0.05);
    this.scoreCanvas = scoreBoardCanvas();
    this.scoreTex = surfaceTexture(this.scoreCanvas);
    const display = new Mesh(new PlaneGeometry(SW, SW * 160 / 512), new MeshBasicMaterial({ map: this.scoreTex }));
    display.position.set(0, yFar + 0.55, zFar - 0.005);
    g.add(display);
    // Canal de bolas en el extremo del jugador, con unas cuantas bolas esperando.
    box(SW, 0.06, 0.16, mat(0x2a1a10, 0.7), 0, LANE_Y - 0.05, zNear + 0.08);
    const ballMat = mat(0xc4122e, 0.3);
    for (let i = 0; i < 5; i++) {
      const b = new Mesh(new SphereGeometry(0.035, 14, 10), ballMat);
      b.position.set(-0.3 + i * 0.075, LANE_Y + 0.0, zNear + 0.08);
      g.add(b);
    }
    // La bola que se lleva en la mano antes de lanzar.
    this.handBall = new Mesh(new SphereGeometry(0.035, 14, 10), ballMat);
    g.add(this.handBall);
    this.zNear = zNear;
    this.footprint = [-SW / 2 - 0.1, SW / 2 + 0.1, zFar - 0.12, zNear + 0.18];
    this.poses = {
      seat: { eye: [0, 1.62, zNear + 0.75], look: [0, LANE_Y + 0.25, zFar + 0.2] },
      zoom: { eye: [0, 1.75, zNear + 0.1], look: [0, ySplit, zFar + 0.1] }
    };
    this.hint = ['FLECHAS', 'APUNTAR', 'ESPACIO', 'FUERZA', 'G', 'GRANDE', 'Q', 'LEVANTARSE'];
    this.shown = '';
  }

  drawScore() {
    const g = this.game();
    const m = this.machine;
    const text = g ? g.score + '|' + g.ballsLeft + '|' + (m && m.state) : '';
    if (text === this.shown) return;
    this.shown = text;
    const c = this.scoreCanvas.getContext('2d');
    c.fillStyle = '#05030c';
    c.fillRect(0, 0, 512, 160);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = font(30);
    c.fillStyle = '#ff3d8b';
    c.fillText('SKEE-BALL', 256, 34);
    c.font = font(44);
    c.fillStyle = '#ffd23f';
    c.fillText(g ? String(g.score).padStart(3, '0') : '000', 150, 104);
    c.font = font(22);
    c.fillStyle = '#2fd8ff';
    c.fillText('BOLAS ' + (g ? g.ballsLeft : 9), 380, 104);
    this.scoreTex.needsUpdate = true;
  }

  // Bola en la mano: sigue la puntería y desaparece al lanzar.
  ballPos(out) {
    const g = this.game();
    const aim = g ? g.aim : 112;
    const x = (aim / 224 - 0.5) * SW;
    return out.set(x, LANE_Y + 0.09, this.zNear + 0.05);
  }

  grips(outStick, outButton) {
    this.group.localToWorld(outStick.set(-SW / 2 - 0.04, LANE_Y + 0.22, this.zNear));
    this.group.localToWorld(this.ballPos(outButton));
    outButton.y += 0.03;
  }

  animateControls() {}

  tick() {
    const g = this.game();
    this.ballPos(this.handBall.position);
    this.handBall.visible = !!g && g.phase === 'AIM' && this.machine && this.machine.state === 'PLAYING';
    this.drawScore();
  }
}
