/* Primera persona: vista con ratón, movimiento con colisiones círculo-AABB, aviso de interacción
   y transiciones de cámara al sentarse en una máquina, acercar la pantalla y levantarse.
   Todo avanza en pasos fijos (update), así el recorrido es reproducible en las pruebas. */
import { Vector3, Quaternion, Euler } from 'three';
import { ROOM } from './Room.js';

const EYE = 1.62;
const RADIUS = 0.28;
const WALK = 1.6;          // m/s
const RUN = 3.0;
const ACCEL = 12;          // respuesta del movimiento (1/s)
const PITCH_MAX = 1.35;
const INTERACT_DIST = 1.6;
const INTERACT_ANGLE = Math.cos(50 * Math.PI / 180);
const SIT_TIME = 0.8;
const ZOOM_TIME = 0.35;
const SEAT_FILL = 0.40;    // fracción de la vista que ocupa la pantalla al sentarse
const SEAT_TILT = 0.3;     // sentado se mira un poco hacia abajo: se ven los mandos y las manos
const ZOOM_FILL = 0.92;

function smooth(t) { return t * t * (3 - 2 * t); }

export class FirstPerson {
  constructor(camera, colliders, cabinets) {
    this.camera = camera;
    this.colliders = colliders;
    this.cabinets = cabinets;
    this.pos = new Vector3(0, EYE, 2.6);
    this.vel = new Vector3();
    this.yaw = 0;           // 0 = mirando a -z
    this.pitch = -0.05;
    this.sensitivity = 1;
    this.mode = 'walk';     // walk | sitting | seated | standing
    this.cabinet = null;
    this.zoomed = false;
    this.prompt = null;     // máquina a la que se puede usar con E
    this.speed = 0;
    this.stepDistance = 0;  // para el sonido de pasos
    this.onStep = null;
    // Transición de cámara.
    this.t = 0;
    this.duration = SIT_TIME;
    this.fromPos = new Vector3();
    this.fromQuat = new Quaternion();
    this.toPos = new Vector3();
    this.toQuat = new Quaternion();
    this.onArrive = null;
    this._e = new Euler(0, 0, 0, 'YXZ');
    this._q = new Quaternion();
    this._v = new Vector3();
    this._w = new Vector3();
    this.applyLook();
  }

  get seated() { return this.mode === 'seated'; }
  get sitAmount() {
    if (this.mode === 'seated') return 1;
    if (this.mode === 'sitting') return smooth(this.t);
    if (this.mode === 'standing') return 1 - smooth(this.t);
    return 0;
  }

  teleport(x, z, yaw = 0, pitch = -0.05) {
    this.mode = 'walk';
    this.cabinet = null;
    this.zoomed = false;
    this.pos.set(x, EYE, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.applyLook();
  }

  applyLook() {
    this._e.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._e);
    this.camera.position.copy(this.pos);
  }

  // look: { x, y } px de ratón desde el último paso.
  look(dx, dy) {
    const k = 0.0022 * this.sensitivity;
    this.yaw -= dx * k;
    this.pitch -= dy * k;
    if (this.pitch > PITCH_MAX) this.pitch = PITCH_MAX;
    if (this.pitch < -PITCH_MAX) this.pitch = -PITCH_MAX;
  }

  // Un paso fijo de movimiento a pie.
  walk(dt, input) {
    const d = input.down;
    let fx = (d.right ? 1 : 0) - (d.left ? 1 : 0) + input.move.x;
    let fz = (d.up ? 1 : 0) - (d.down ? 1 : 0) - input.move.y;
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const speed = d.run ? RUN : WALK;
    // Avance relativo a la vista (solo el giro horizontal).
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const tx = (fx * cos - fz * sin) * speed;
    const tz = (-fx * sin - fz * cos) * speed;
    const k = Math.min(1, dt * ACCEL);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    const ox = this.pos.x, oz = this.pos.z;
    // Se mueve eje a eje para deslizar a lo largo de las paredes.
    this.pos.x += this.vel.x * dt;
    this.resolve('x');
    this.pos.z += this.vel.z * dt;
    this.resolve('z');
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.speed = moved / dt;
    this.stepDistance += moved;
    if (this.stepDistance > 0.7) {
      this.stepDistance = 0;
      if (this.onStep) this.onStep();
    }
  }

  // Empuja al jugador fuera de las paredes y de los AABB sobre el eje indicado.
  resolve(axis) {
    const p = this.pos;
    if (p.x < ROOM.minX + RADIUS) p.x = ROOM.minX + RADIUS;
    if (p.x > ROOM.maxX - RADIUS) p.x = ROOM.maxX - RADIUS;
    if (p.z < ROOM.minZ + RADIUS) p.z = ROOM.minZ + RADIUS;
    if (p.z > ROOM.maxZ - RADIUS) p.z = ROOM.maxZ - RADIUS;
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx, dz = p.z - cz;
      if (dx * dx + dz * dz >= RADIUS * RADIUS) continue;
      if (axis === 'x') {
        p.x = this.vel.x > 0 || (this.vel.x === 0 && dx < 0) ? c.minX - RADIUS : c.maxX + RADIUS;
        this.vel.x = 0;
      } else {
        p.z = this.vel.z > 0 || (this.vel.z === 0 && dz < 0) ? c.minZ - RADIUS : c.maxZ + RADIUS;
        this.vel.z = 0;
      }
    }
  }

  // La máquina más cercana que esté a menos de 1,6 m y a la vista (o null).
  findPrompt() {
    let best = null, bestD = Infinity;
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    for (const cab of this.cabinets) {
      const front = cab.frontPoint(this._v, 0);
      const dx = front.x - this.pos.x, dz = front.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > INTERACT_DIST || dist < 1e-6) continue;
      // Hay que estar delante de la máquina, no a un lado ni detrás.
      const n = cab.frontPoint(this._w, 1).sub(front);
      if (-(dx * n.x + dz * n.z) / (dist * n.length()) < 0.2) continue;
      if ((dx * fwdX + dz * fwdZ) / dist < INTERACT_ANGLE) continue;
      if (dist < bestD) { bestD = dist; best = cab; }
    }
    return best;
  }

  // Empieza una transición de cámara hacia (pos, quat).
  transition(mode, toPos, toQuat, duration, onArrive) {
    this.mode = mode;
    this.t = 0;
    this.duration = duration;
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    this.toPos.copy(toPos);
    this.toQuat.copy(toQuat);
    this.onArrive = onArrive || null;
  }

  sit(cabinet, onArrive) {
    if (this.mode !== 'walk') return false;
    this.cabinet = cabinet;
    this.zoomed = false;
    this.vel.set(0, 0, 0);
    this.speed = 0;
    cabinet.screenPose(this.camera, SEAT_FILL, this._v, this._q, SEAT_TILT);
    this.transition('sitting', this._v, this._q, SIT_TIME, onArrive);
    return true;
  }

  pose(pos, quat) {
    return this.cabinet.screenPose(this.camera, this.zoomed ? ZOOM_FILL : SEAT_FILL, pos, quat, this.zoomed ? 0 : SEAT_TILT);
  }

  toggleZoom() {
    if (this.mode !== 'seated') return;
    this.zoomed = !this.zoomed;
    this.pose(this._v, this._q);
    this.transition('seated', this._v, this._q, ZOOM_TIME, null);
  }

  // Recalcula la pose sentada si cambia el tamaño de la ventana.
  refit() {
    if (this.mode !== 'seated' || !this.cabinet) return;
    this.pose(this._v, this._q);
    this.toPos.copy(this._v);
    this.toQuat.copy(this._q);
    if (this.t >= 1) { this.camera.position.copy(this._v); this.camera.quaternion.copy(this._q); }
  }

  stand(onArrive) {
    if (this.mode !== 'seated' && this.mode !== 'sitting') return false;
    const cab = this.cabinet;
    const spot = cab.frontPoint(this._w, 0.75);
    // De pie, mirando a la máquina.
    const dx = cab.group.position.x - spot.x, dz = cab.group.position.z - spot.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.12;
    this.pos.set(spot.x, EYE, spot.z);
    this._e.set(this.pitch, this.yaw, 0, 'YXZ');
    this._q.setFromEuler(this._e);
    this.transition('standing', this.pos, this._q, SIT_TIME * 0.75, () => {
      this.cabinet = null;
      this.zoomed = false;
      if (onArrive) onArrive();
    });
    return true;
  }

  // Paso fijo. walkInput: entrada si se puede andar (null si hay un menú abierto). look: {x,y}.
  update(dt, walkInput, look) {
    if (this.mode === 'walk') {
      if (walkInput) {
        if (look) this.look(look.x, look.y);
        this.walk(dt, walkInput);
      } else {
        this.vel.set(0, 0, 0);
        this.speed = 0;
      }
      this.applyLook();
      this.prompt = walkInput ? this.findPrompt() : null;
      return;
    }
    this.prompt = null;
    this.speed = 0;
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const s = smooth(this.t);
      this.camera.position.lerpVectors(this.fromPos, this.toPos, s);
      this.camera.quaternion.slerpQuaternions(this.fromQuat, this.toQuat, s);
      if (this.t >= 1) {
        if (this.mode === 'sitting') this.mode = 'seated';
        else if (this.mode === 'standing') { this.mode = 'walk'; this.applyLook(); }
        const cb = this.onArrive;
        this.onArrive = null;
        if (cb) cb();
      }
    }
  }
}
