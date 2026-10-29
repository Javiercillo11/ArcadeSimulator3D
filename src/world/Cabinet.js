/* Máquina recreativa procedural: mueble, pantalla CRT, marquesina luminosa, palanca y botones animados.
   Coordenadas locales: origen en el suelo, centro del mueble; la parte delantera mira hacia +z. */
import {
  Group, Mesh, Shape, ExtrudeGeometry, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, TubeGeometry,
  CurvePath, LineCurve3, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace, NearestFilter,
  Vector3, Quaternion, Matrix4
} from 'three';
import { createCrtMaterial } from './CrtMaterial.js';
import { sideArt, marqueeArt, bezelArt, deckArt, coinDoorArt, stickers } from './cabinetArt.js';
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

// Canto delantero del perfil, por donde corre la moldura luminosa (T-molding).
const FRONT_EDGE = PROFILE.slice(1, 10);
const STICK = [-0.17, 0.02];
const BUTTONS = { jump: [0.06, 0.03], jump2: [0.15, 0.0], start: [-0.02, -0.08] };

function tex(c, anisotropy = 8) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export class Cabinet {
  // opts: { id, title, number, screenCanvas, colors: { body, stripe, accent, marqueeTop, marqueeBottom, buttons:[a,b] } }
  constructor(opts) {
    this.id = opts.id;
    this.title = opts.title;
    this.promptText = opts.promptText;
    this.hint = opts.hint || null;
    const colors = opts.colors;
    const group = new Group();
    group.name = 'cabinet-' + opts.id;
    this.group = group;

    const bodyMat = new MeshStandardMaterial({ color: colors.body, roughness: 0.55, metalness: 0.05 });
    const darkMat = new MeshStandardMaterial({ color: 0x0b0b14, roughness: 0.8 });
    const trimMat = new MeshStandardMaterial({ color: colors.accent, roughness: 0.4, emissive: colors.accent, emissiveIntensity: 0.25 });
    // Vinilo lateral: el derecho va en espejo para que los textos se lean bien desde fuera.
    const [artL, artR] = sideArt(opts.id, colors);
    // Un poco de brillo propio para que el arte se lea en la penumbra del salón.
    const sideMats = [artL, artR].map((c) => {
      const t = tex(c);
      return new MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.45, metalness: 0.05 });
    });

    // Laterales: el perfil extruido a lo ancho.
    const shape = new Shape();
    PROFILE.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
    const sideGeo = new ExtrudeGeometry(shape, { depth: SIDE, bevelEnabled: false });
    sideGeo.rotateY(-Math.PI / 2);
    // Las UV de ExtrudeGeometry van en metros del perfil: se normalizan para el vinilo.
    const uv = sideGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.39) / D, uv.getY(i) / H);
    for (const sx of [-1, 1]) {
      const side = new Mesh(sideGeo, [sideMats[sx < 0 ? 0 : 1], bodyMat]);
      side.position.x = sx < 0 ? -W / 2 + SIDE : W / 2;
      group.add(side);
    }
    // Moldura luminosa (T-molding) a lo largo de todo el canto delantero de cada lateral.
    const ledMat = new MeshBasicMaterial({ color: colors.accent });
    for (const sx of [-1, 1]) {
      const path = new CurvePath();
      const x = sx * (W / 2 - SIDE / 2);
      for (let i = 0; i < FRONT_EDGE.length - 1; i++) {
        const [z0, y0] = FRONT_EDGE[i], [z1, y1] = FRONT_EDGE[i + 1];
        path.add(new LineCurve3(new Vector3(x, y0, z0 + 0.004), new Vector3(x, y1, z1 + 0.004)));
      }
      group.add(new Mesh(new TubeGeometry(path, 120, 0.017, 6, false), ledMat));
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
    // Puerta de monedas metálica con dos ranuras rojas iluminadas.
    const door = new Mesh(new PlaneGeometry(0.26, 0.2), new MeshStandardMaterial({ map: tex(coinDoorArt()), metalness: 0.7, roughness: 0.35 }));
    door.position.set(0, 0.55, 0.302);
    group.add(door);
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
    // Cubierta impresa (cara superior) con rótulos de los mandos y tarjeta de instrucciones.
    const deckMat = new MeshStandardMaterial({ map: tex(deckArt(opts.id, colors, { inner, len: panelLen, stick: STICK, buttons: BUTTONS })), roughness: 0.35 });
    const deckSide = new MeshStandardMaterial({ color: colors.stripe, roughness: 0.5 });
    const deck = new Mesh(new BoxGeometry(inner, 0.03, panelLen), [deckSide, deckSide, deckMat, deckSide, deckSide, deckSide]);
    deck.position.y = -0.015;
    panel.add(deck);
    this.panel = panel;

    // Palanca: base, varilla y bola en un pivote que se inclina con la entrada.
    const stickBase = new Mesh(new CylinderGeometry(0.035, 0.04, 0.012, 24), darkMat);
    stickBase.position.set(STICK[0], 0.006, STICK[1]);
    panel.add(stickBase);
    const pivot = new Group();
    pivot.position.set(STICK[0], 0.01, STICK[1]);
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
      jump: makeButton(...BUTTONS.jump, 0.022, colors.buttons[1]),
      jump2: makeButton(...BUTTONS.jump2, 0.022, colors.buttons[0]),
      start: makeButton(...BUTTONS.start, 0.012, 0xffffff)
    };

    // Pantalla: bisel negro y el CRT encima, inclinados hacia atrás.
    const screenGroup = new Group();
    screenGroup.position.copy(SCREEN_A).add(SCREEN_B).multiplyScalar(0.5);
    const screenTilt = Math.atan2(SCREEN_A.z - SCREEN_B.z, SCREEN_B.y - SCREEN_A.y);
    screenGroup.rotation.x = -screenTilt;
    group.add(screenGroup);
    const bezelLen = SCREEN_A.distanceTo(SCREEN_B);
    // Bisel impreso alrededor del cristal.
    const bezelArtMat = new MeshStandardMaterial({
      map: tex(bezelArt(opts.id, colors, { aspect: bezelLen / inner, w: SCREEN_W / inner, h: SCREEN_H / bezelLen })),
      roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.08
    });
    bezelArtMat.emissiveMap = bezelArtMat.map;
    const bezel = new Mesh(new BoxGeometry(inner, bezelLen, 0.02), [darkMat, darkMat, darkMat, darkMat, bezelArtMat, darkMat]);
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
    if (opts.broken) {
      // Cinta de precinto cruzada sobre el cristal.
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 48;
      const g = c.getContext('2d');
      g.fillStyle = '#ffd23f';
      g.fillRect(0, 0, 512, 48);
      g.fillStyle = '#111';
      for (let x = -20; x < 540; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x - 4, 48); g.lineTo(x - 20, 48); g.fill(); }
      g.fillStyle = '#ffd23f';
      g.fillRect(70, 8, 372, 32);
      g.fillStyle = '#111';
      g.font = '22px ' + FONT_FAMILY + ', monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('FUERA DE SERVICIO', 256, 26);
      const tapeMat = new MeshBasicMaterial({ map: tex(c), transparent: true });
      for (const a of [0.55, -0.55]) {
        const tape = new Mesh(new PlaneGeometry(0.48, 0.045), tapeMat);
        tape.position.z = 0.004;
        tape.rotation.z = a;
        screenGroup.add(tape);
      }
    }

    // Marquesina retroiluminada y una tira de luz bajo ella que ilumina el bisel.
    const marquee = new Mesh(new PlaneGeometry(inner, 0.24), new MeshBasicMaterial({ map: tex(marqueeArt(opts.id, opts.title, colors)) }));
    marquee.position.set(0, 1.73, 0.085);
    marquee.rotation.x = -Math.atan2(0.06, 0.26);
    group.add(marquee);
    const strip = box(inner, 0.012, 0.03, new MeshBasicMaterial({ color: opts.broken ? 0x333333 : 0xfff4d8 }), 0, 1.598, 0.04);
    strip.rotation.x = 0.2;

    // Pegatinas: planos con recorte (alphaTest) pegados a la superficie, un poco torcidos.
    for (const st of stickers(opts.id, opts.number || 1, colors)) {
      const mat = new MeshStandardMaterial({
        map: tex(st.c), alphaTest: 0.5, roughness: 0.3, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      });
      const h = st.w * st.c.height / st.c.width;
      const m = new Mesh(new PlaneGeometry(st.w, h), mat);
      if (st.face === 'front') m.position.set(st.x, st.y, 0.3015);
      else if (st.face === 'left') { m.position.set(-W / 2 - 0.0015, st.y, st.x); m.rotation.y = -Math.PI / 2; }
      else { m.position.set(W / 2 + 0.0015, st.y, st.x); m.rotation.y = Math.PI / 2; }
      m.rotation.z = st.rot;
      group.add(m);
    }

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

