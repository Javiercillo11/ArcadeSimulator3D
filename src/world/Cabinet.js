/* Máquina recreativa procedural: mueble, pantalla CRT, marquesina luminosa, palanca y botones animados.
   Coordenadas locales: origen en el suelo, centro del mueble; la parte delantera mira hacia +z. */
import {
  Group, Mesh, Shape, ExtrudeGeometry, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, NearestFilter, Vector3, Quaternion, Matrix4
} from 'three';
import { createCrtMaterial } from './CrtMaterial.js';
import { FONT_FAMILY } from '../core/font.js';

const W = 0.72;          // ancho
const D = 0.78;          // fondo
const H = 1.86;          // alto
const SIDE = 0.03;       // grosor de los laterales
const SCREEN_H = 0.40;
const SCREEN_W = SCREEN_H * 224 / 288;

// Perfil lateral (z, y): de la base trasera hacia delante y hacia arriba.
const PROFILE = [
  [-0.39, 0], [0.30, 0], [0.30, 0.88], [0.40, 0.93], [0.40, 0.99], [0.13, 1.07],
  [0.10, 1.10], [0.0, 1.58], [0.05, 1.60], [0.11, 1.86], [-0.39, 1.86]
];
const PANEL_A = new Vector3(0, 1.07, 0.13);   // borde trasero de la cubierta de mandos
const PANEL_B = new Vector3(0, 0.99, 0.40);   // borde delantero
const SCREEN_A = new Vector3(0, 1.10, 0.10);  // borde inferior del cristal
const SCREEN_B = new Vector3(0, 1.58, 0.0);   // borde superior

function marqueeTexture(title, colors) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, colors.marqueeTop);
  grad.addColorStop(1, colors.marqueeBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = colors.accent;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 112);
  g.font = '40px ' + FONT_FAMILY + ', monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = colors.accent;
  g.shadowBlur = 18;
  g.fillStyle = '#ffffff';
  g.fillText(title, 256, 66);
  g.shadowBlur = 0;
  g.fillStyle = colors.accent;
  g.fillText(title, 256, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Los colores de la máquina vienen como número (three) o cadena CSS; el canvas solo acepta cadenas.
const css = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);

// Dibujo lateral (vinilo): franjas diagonales sobre el color del mueble.
function sideTexture(colors) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = css(colors.body);
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = css(i % 2 ? colors.accent : colors.stripe);
    g.beginPath();
    g.moveTo(0, 300 + i * 34);
    g.lineTo(256, 180 + i * 34);
    g.lineTo(256, 200 + i * 34);
    g.lineTo(0, 320 + i * 34);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Cabinet {
  // opts: { id, title, screenCanvas, colors: { body, stripe, accent, marqueeTop, marqueeBottom, buttons:[a,b] } }
  constructor(opts) {
    this.id = opts.id;
    this.title = opts.title;
    const colors = opts.colors;
    const group = new Group();
    group.name = 'cabinet-' + opts.id;
    this.group = group;

    const bodyMat = new MeshStandardMaterial({ color: colors.body, roughness: 0.55, metalness: 0.05 });
    const darkMat = new MeshStandardMaterial({ color: 0x0b0b14, roughness: 0.8 });
    const trimMat = new MeshStandardMaterial({ color: colors.accent, roughness: 0.4, emissive: colors.accent, emissiveIntensity: 0.25 });
    const sideMat = new MeshStandardMaterial({ map: sideTexture(colors), roughness: 0.6 });

    // Laterales: el perfil extruido a lo ancho.
    const shape = new Shape();
    PROFILE.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
    const sideGeo = new ExtrudeGeometry(shape, { depth: SIDE, bevelEnabled: false });
    sideGeo.rotateY(-Math.PI / 2);
    // Las UV de ExtrudeGeometry van en metros del perfil: se normalizan para el vinilo.
    const uv = sideGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.39) / D, uv.getY(i) / H);
    for (const sx of [-1, 1]) {
      const side = new Mesh(sideGeo, [sideMat, bodyMat]);
      side.position.x = sx < 0 ? -W / 2 + SIDE : W / 2;
      group.add(side);
    }
    // Moldura luminosa en el canto delantero de cada lateral.
    for (const sx of [-1, 1]) {
      const edge = new Mesh(new BoxGeometry(0.012, 0.86, 0.012), trimMat);
      edge.position.set(sx * (W / 2 - SIDE / 2), 0.44, 0.305);
      group.add(edge);
    }

    const inner = W - SIDE * 2;
    const box = (w, h, d, mat, x, y, z) => {
      const m = new Mesh(new BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    box(inner, H, 0.02, bodyMat, 0, H / 2, -0.38);                 // trasera
    box(inner, 0.88, 0.02, bodyMat, 0, 0.44, 0.29);                // frontal inferior
    box(inner, 0.02, D, bodyMat, 0, H - 0.01, 0);                  // techo
    box(inner, 0.08, 0.1, darkMat, 0, 0.04, 0.27);                 // zócalo
    // Puerta de monedas: placa oscura con dos ranuras rojas.
    box(0.26, 0.2, 0.01, darkMat, 0, 0.55, 0.305);
    const slotMat = new MeshStandardMaterial({ color: 0xff2a3a, emissive: 0xff2a3a, emissiveIntensity: 1.2 });
    box(0.03, 0.06, 0.01, slotMat, -0.06, 0.57, 0.312);
    box(0.03, 0.06, 0.01, slotMat, 0.06, 0.57, 0.312);
    // Frente bajo la cubierta de mandos.
    const lip = box(inner, 0.06, 0.02, trimMat, 0, 0.96, 0.395);
    lip.rotation.x = -0.45;

    // Cubierta de mandos inclinada.
    const panel = new Group();
    const panelLen = PANEL_A.distanceTo(PANEL_B);
    const panelTilt = Math.atan2(PANEL_A.y - PANEL_B.y, PANEL_B.z - PANEL_A.z);
    panel.position.copy(PANEL_A).add(PANEL_B).multiplyScalar(0.5);
    panel.rotation.x = panelTilt;
    group.add(panel);
    const deck = new Mesh(new BoxGeometry(inner, 0.03, panelLen), new MeshStandardMaterial({ color: colors.stripe, roughness: 0.5 }));
    deck.position.y = -0.015;
    panel.add(deck);
    this.panel = panel;

    // Palanca: base, varilla y bola en un pivote que se inclina con la entrada.
    const stickBase = new Mesh(new CylinderGeometry(0.035, 0.04, 0.012, 24), darkMat);
    stickBase.position.set(-0.17, 0.006, 0.02);
    panel.add(stickBase);
    const pivot = new Group();
    pivot.position.set(-0.17, 0.01, 0.02);
    const shaft = new Mesh(new CylinderGeometry(0.007, 0.007, 0.075, 12), new MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.8, roughness: 0.3 }));
    shaft.position.y = 0.0375;
    const ball = new Mesh(new SphereGeometry(0.022, 20, 14), new MeshStandardMaterial({ color: colors.buttons[0], roughness: 0.25 }));
    ball.position.y = 0.08;
    pivot.add(shaft, ball);
    panel.add(pivot);
    this.stick = pivot;
    this.stickBall = ball;

    // Botones: dos de acción (saltar) y uno de START.
    const makeButton = (x, z, r, color) => {
      const ring = new Mesh(new CylinderGeometry(r + 0.006, r + 0.006, 0.006, 24), darkMat);
      ring.position.set(x, 0.003, z);
      const cap = new Mesh(new CylinderGeometry(r, r, 0.016, 24), new MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.15 }));
      cap.position.set(x, 0.012, z);
      panel.add(ring, cap);
      return cap;
    };
    this.buttons = {
      jump: makeButton(0.06, 0.03, 0.022, colors.buttons[1]),
      jump2: makeButton(0.15, 0.0, 0.022, colors.buttons[0]),
      start: makeButton(-0.02, -0.08, 0.012, 0xffffff)
    };

    // Pantalla: bisel negro y el CRT encima, inclinados hacia atrás.
    const screenGroup = new Group();
    screenGroup.position.copy(SCREEN_A).add(SCREEN_B).multiplyScalar(0.5);
    const screenTilt = Math.atan2(SCREEN_A.z - SCREEN_B.z, SCREEN_B.y - SCREEN_A.y);
    screenGroup.rotation.x = -screenTilt;
    group.add(screenGroup);
    const bezelLen = SCREEN_A.distanceTo(SCREEN_B);
    const bezel = new Mesh(new BoxGeometry(inner, bezelLen, 0.02), darkMat);
    bezel.position.z = -0.012;
    screenGroup.add(bezel);
    this.texture = new CanvasTexture(opts.screenCanvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.crt = createCrtMaterial(this.texture);
    const screen = new Mesh(new PlaneGeometry(SCREEN_W, SCREEN_H), this.crt);
    screen.position.z = 0.0;
    screenGroup.add(screen);
    this.screen = screen;
    this.screenGroup = screenGroup;

    // Marquesina luminosa.
    const marquee = new Mesh(new PlaneGeometry(inner, 0.24), new MeshBasicMaterial({ map: marqueeTexture(opts.title, colors) }));
    marquee.position.set(0, 1.73, 0.085);
    marquee.rotation.x = -Math.atan2(0.06, 0.26);
    group.add(marquee);

    this.halfW = W / 2;
    this.front = 0.42;
    this.back = -0.39;
    this._v = new Vector3();
    this._tilt = { x: 0, z: 0 };
  }

  // Coloca el mueble en la sala.
  place(x, z, rotY) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotY;
    this.group.updateMatrixWorld(true);
  }

  // Caja de colisión en planta (en coordenadas de mundo; el mueble solo gira en múltiplos de 90°).
  collider() {
    const pts = [[-this.halfW, this.back], [this.halfW, this.back], [-this.halfW, this.front], [this.halfW, this.front]];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) {
      const v = this.group.localToWorld(this._v.set(x, 0, z));
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    return { minX, maxX, minZ, maxZ, id: this.id };
  }

  // Punto del suelo delante de la máquina (para el aviso de E y para levantarse).
  frontPoint(out, dist = 0.75) {
    return this.group.localToWorld(out.set(0, 0, this.front + dist));
  }

  screenCenter(out) {
    return this.screen.getWorldPosition(out);
  }

  screenNormal(out) {
    return out.set(0, 0, 1).applyQuaternion(this.screen.getWorldQuaternion(new Quaternion()));
  }

  // Pose de cámara frente a la pantalla. fill: fracción de la vista que ocupa la pantalla;
  // tilt: cuánto se eleva la cámara y mira hacia abajo (0 = de frente; ~0.3 deja ver los mandos y las manos).
  screenPose(camera, fill, outPos, outQuat, tilt = 0) {
    const vfov = camera.fov * Math.PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(SCREEN_H / (2 * Math.tan(vfov / 2)), SCREEN_W / (2 * Math.tan(hfov / 2))) / fill;
    const center = this.screenCenter(new Vector3());
    const normal = this.screenNormal(new Vector3());
    outPos.copy(center).addScaledVector(normal, dist);
    outPos.y += dist * tilt * 0.4;
    const target = center.clone();
    target.y -= dist * tilt;
    const m = new Matrix4().lookAt(outPos, target, new Vector3(0, 1, 0));
    outQuat.setFromRotationMatrix(m);
    return outPos;
  }

  // Puntos de agarre de las manos en mundo: palanca y botón de salto.
  grips(outStick, outButton) {
    this.stickBall.getWorldPosition(outStick);
    this.buttons.jump.getWorldPosition(outButton);
  }

  // Anima palanca y botones según la entrada (dt en segundos).
  animateControls(input, dt) {
    const d = input ? input.down : null;
    const tx = d ? (d.left ? 1 : 0) - (d.right ? 1 : 0) : 0;
    const tz = d ? (d.down ? 1 : 0) - (d.up ? 1 : 0) : 0;
    const k = Math.min(1, dt * 18);
    this._tilt.x += (tz * 0.38 - this._tilt.x) * k;
    this._tilt.z += (tx * 0.38 - this._tilt.z) * k;
    this.stick.rotation.x = this._tilt.x;
    this.stick.rotation.z = this._tilt.z;
    const pressJump = d && d.jump ? 1 : 0;
    const pressStart = d && d.start ? 1 : 0;
    this.buttons.jump.position.y = 0.012 - pressJump * 0.008;
    this.buttons.jump2.position.y = 0.012 - pressJump * 0.008;
    this.buttons.start.position.y = 0.012 - pressStart * 0.008;
  }

  setPower(on) { this.crt.uniforms.power.value = on ? 1 : 0.15; }
  setCrt(on) { this.crt.uniforms.enabled.value = on ? 1 : 0; }
  tick(time) { this.crt.uniforms.time.value = time; }
}

