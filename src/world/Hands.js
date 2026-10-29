/* Manos en primera persona: cuelgan de la cámara, se balancean al andar y, sentados, agarran la palanca y pulsan botones. */
import { Group, Mesh, BoxGeometry, CapsuleGeometry, CylinderGeometry, MeshStandardMaterial, Vector3 } from 'three';

const SKIN = 0xe0a682;
const SLEEVE = 0x2b2f8c;

function buildHand(side) {
  const skin = new MeshStandardMaterial({ color: SKIN, roughness: 0.65 });
  const sleeveMat = new MeshStandardMaterial({ color: SLEEVE, roughness: 0.8 });
  const root = new Group();
  // Antebrazo con manga: sale de la muñeca hacia atrás y hacia abajo, como desde el cuerpo,
  // para que nunca suba hacia la cámara aunque la mano se incline.
  const forearm = new Group();
  forearm.position.z = 0.03;
  forearm.rotation.x = 0.6;
  const arm = new Mesh(new CylinderGeometry(0.032, 0.038, 0.26, 14), sleeveMat);
  arm.rotation.x = Math.PI / 2;
  arm.position.z = 0.15;
  const cuff = new Mesh(new CylinderGeometry(0.035, 0.035, 0.03, 14), new MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 }));
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.015;
  forearm.add(arm, cuff);
  const wrist = new Mesh(new CylinderGeometry(0.026, 0.03, 0.05, 12), skin);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.z = 0.01;
  // Palma.
  const palm = new Mesh(new BoxGeometry(0.075, 0.028, 0.08), skin);
  palm.position.z = -0.045;
  root.add(forearm, wrist, palm);
  // Dedos: cuatro cápsulas con dos falanges; el índice se puede doblar por separado.
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const base = new Group();
    base.position.set(-0.027 + i * 0.018, 0, -0.085);
    const len = i === 0 || i === 3 ? 0.03 : 0.036;
    const p1 = new Mesh(new CapsuleGeometry(0.0075, len, 4, 8), skin);
    p1.rotation.x = Math.PI / 2;
    p1.position.z = -len / 2;
    const knuckle = new Group();
    knuckle.position.z = -len;
    const p2 = new Mesh(new CapsuleGeometry(0.007, len * 0.8, 4, 8), skin);
    p2.rotation.x = Math.PI / 2;
    p2.position.z = -len * 0.4;
    knuckle.add(p2);
    base.add(p1, knuckle);
    root.add(base);
    fingers.push({ base, knuckle });
  }
  // Pulgar hacia el centro del cuerpo.
  const thumbBase = new Group();
  thumbBase.position.set(side * -0.04, -0.004, -0.03);
  thumbBase.rotation.set(-0.3, side * 0.55, 0);
  const thumb = new Mesh(new CapsuleGeometry(0.0085, 0.022, 4, 8), skin);
  thumb.rotation.x = Math.PI / 2;
  thumb.position.z = -0.02;
  thumbBase.add(thumb);
  root.add(thumbBase);
  if (side < 0) {
    // Mano izquierda: el orden de los dedos va al revés.
    fingers.reverse();
  }
  root.traverse((o) => { o.frustumCulled = false; });
  return { root, fingers, thumbBase };
}

// Poses en espacio de cámara (x derecha, y arriba, -z delante).
const IDLE = { left: new Vector3(-0.2, -0.24, -0.38), right: new Vector3(0.2, -0.24, -0.38) };

export class Hands {
  constructor(camera) {
    this.camera = camera;
    this.group = new Group();
    this.group.name = 'hands';
    camera.add(this.group);
    this.left = buildHand(-1);
    this.right = buildHand(1);
    this.group.add(this.left.root, this.right.root);
    this.walkPhase = 0;
    this.sit = 0;           // 0 de pie, 1 sentado (lo controla FirstPerson)
    this.grip = 0;          // cierre de la mano izquierda sobre la bola de la palanca
    this.press = 0;         // índice derecho pulsando
    this._stick = new Vector3();
    this._button = new Vector3();
    this._tmp = new Vector3();
    this.visible = true;
  }

  setVisible(v) { this.group.visible = v; this.visible = v; }

  // speed: m/s en planta; cabinet: máquina en la que se está sentado (o null); input: entrada actual.
  update(dt, speed, cabinet, input) {
    const walking = Math.min(1, speed / 1.6);
    this.walkPhase += dt * (4 + speed * 3.2) * (walking > 0.05 ? 1 : 0.25);
    const bob = Math.sin(this.walkPhase) * 0.018 * walking;
    const sway = Math.cos(this.walkPhase * 0.5) * 0.014 * walking;
    const breathe = Math.sin(this.walkPhase * 0.6) * 0.003;

    const down = input && input.down;
    const pressing = cabinet && down && (down.jump || down.start) ? 1 : 0;
    const k = Math.min(1, dt * 14);
    this.press += (pressing - this.press) * k;
    this.grip += ((cabinet ? 1 : 0.25) - this.grip) * k;

    this.pose(this.left, IDLE.left, -1, bob, sway, breathe, cabinet, 'left');
    this.pose(this.right, IDLE.right, 1, -bob, -sway, breathe, cabinet, 'right');
  }

  pose(hand, idle, side, bob, sway, breathe, cabinet, which) {
    const root = hand.root;
    const s = this.sit;
    // De pie: un poco por delante y abajo, con balanceo opuesto entre manos.
    const px = idle.x + sway, py = idle.y + bob + breathe, pz = idle.z;
    // rx negativo inclina los dedos hacia abajo (la mano mira al frente con la palma hacia el suelo).
    let rx = -0.22 + bob * 3, ry = side * -0.12, rz = side * -0.2;
    root.position.set(px, py, pz);
    if (cabinet && s > 0) {
      // Sentado: la muñeca va al punto de agarre (convertido a espacio de cámara).
      cabinet.grips(this._stick, this._button);
      const target = which === 'left' ? this._stick : this._button;
      this.camera.updateMatrixWorld();
      const local = this.camera.worldToLocal(this._tmp.copy(target));
      // La palma queda sobre la bola / el botón: la muñeca se retrasa hacia el jugador.
      local.y += which === 'left' ? 0.012 : 0.03 - this.press * 0.012;
      local.z += 0.06;
      if (which === 'right') local.x -= 0.012;
      root.position.lerp(local, s);
      rx = rx + (-0.3 - rx) * s;
      ry = ry * (1 - s);
      rz = rz * (1 - s);
    }
    root.rotation.set(rx, ry, rz);
    // Dedos: cerrados alrededor de la palanca (izquierda) o extendidos para pulsar (derecha).
    const curl = which === 'left' ? 0.2 + this.grip * 0.9 * s : 0.2 + 0.4 * s;
    hand.fingers.forEach((f, i) => {
      let c = curl;
      if (which === 'right' && i === 1) c = 0.15 + this.press * 0.7 * s + (1 - s) * 0.2;
      f.base.rotation.x = -c;
      f.knuckle.rotation.x = -c * 1.1;
    });
  }
}
