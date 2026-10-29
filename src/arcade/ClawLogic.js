/* Lógica de la grúa de peluches (sin 3D). Coordenadas en metros dentro de la urna:
   x de -0.3 a 0.3, z de -0.25 a 0.25 (z positiva hacia el jugador), y = altura de la pinza bajo el techo.
   Estados: IDLE (sin moneda) → MOVE (15 s para colocarla) → DROP → CLOSE → LIFT → RETURN → RELEASE → IDLE. */

export const BOX = { minX: -0.3, maxX: 0.3, minZ: -0.25, maxZ: 0.25, depth: 0.42 };
export const CHUTE = { x: -0.24, z: 0.19 };       // boca de premios: esquina delantera izquierda
export const MOVE_FRAMES = 15 * 60;
const SPEED = 0.25 / 60;          // m por paso
const DROP_SPEED = 0.35 / 60;
const GRAB_RADIUS = 0.075;
const NO_SFX = () => {};

export class ClawLogic {
  // plush: [{ id, x, z }] peluches en el fondo de la urna.
  constructor(plush, rng, sfx = NO_SFX) {
    this.plush = plush;
    this.rand = rng;
    this.sfx = sfx;
    this.x = CHUTE.x;
    this.z = CHUTE.z;
    this.y = 0;               // 0 = arriba; BOX.depth = fondo
    this.open = 1;            // 1 abierta, 0 cerrada
    this.held = null;         // peluche agarrado
    this.won = null;          // último peluche ganado (para la interfaz)
    this.state = 'IDLE';
    this.timer = 0;
    this.slipAt = -1;
  }

  // Con la moneda echada, empieza el tiempo de mover la pinza.
  start() {
    if (this.state !== 'IDLE') return false;
    this.state = 'MOVE';
    this.timer = MOVE_FRAMES;
    this.won = null;
    return true;
  }

  nearest() {
    let best = null, bestD = Infinity;
    for (const p of this.plush) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return { plush: best, dist: bestD };
  }

  // Un paso fijo. Devuelve el peluche ganado en este paso (o null).
  update(input) {
    const d = input && input.down, pr = input && input.pressed;
    switch (this.state) {
      case 'MOVE': {
        const dx = d ? (d.right ? 1 : 0) - (d.left ? 1 : 0) : 0;
        const dz = d ? (d.down ? 1 : 0) - (d.up ? 1 : 0) : 0;
        this.x = Math.max(BOX.minX, Math.min(BOX.maxX, this.x + dx * SPEED));
        this.z = Math.max(BOX.minZ, Math.min(BOX.maxZ, this.z + dz * SPEED));
        if ((dx || dz) && this.timer % 15 === 0) this.sfx('claw');
        if ((pr && (pr.jump || pr.start)) || --this.timer <= 0) { this.state = 'DROP'; this.sfx('claw'); }
        return null;
      }
      case 'DROP':
        this.y += DROP_SPEED;
        if (this.y >= BOX.depth) { this.y = BOX.depth; this.state = 'CLOSE'; this.timer = 30; }
        return null;
      case 'CLOSE': {
        this.open = Math.max(0, this.open - 1 / 30);
        if (--this.timer > 0) return null;
        this.sfx('grab');
        // Agarra el peluche más cercano con una probabilidad que baja con la distancia al centro.
        const { plush, dist } = this.nearest();
        if (plush && dist <= GRAB_RADIUS && this.rand() < 0.75 - dist * 4) {
          this.held = plush;
          plush.taken = true;
          // A veces se escurre al subir, como en las de verdad.
          this.slipAt = this.rand() < 0.3 ? BOX.depth * (0.3 + this.rand() * 0.5) : -1;
        }
        this.state = 'LIFT';
        return null;
      }
      case 'LIFT':
        this.y -= DROP_SPEED;
        if (this.held && this.slipAt > 0 && this.y <= this.slipAt) this.dropHeld(this.x, this.z);
        if (this.y <= 0) { this.y = 0; this.state = 'RETURN'; }
        return null;
      case 'RETURN': {
        const dx = CHUTE.x - this.x, dz = CHUTE.z - this.z;
        const len = Math.hypot(dx, dz);
        if (len <= SPEED * 1.5) { this.x = CHUTE.x; this.z = CHUTE.z; this.state = 'RELEASE'; this.timer = 30; return null; }
        this.x += dx / len * SPEED * 1.5;
        this.z += dz / len * SPEED * 1.5;
        return null;
      }
      case 'RELEASE':
        this.open = Math.min(1, this.open + 1 / 30);
        if (--this.timer > 0) return null;
        this.state = 'IDLE';
        if (this.held) {
          const prize = this.held;
          this.held = null;
          this.won = prize;
          this.sfx('win');
          return prize;
        }
        return null;
      default:
        return null;
    }
  }

  // El peluche se suelta y cae de nuevo en la urna (cerca de donde estaba la pinza).
  dropHeld(x, z) {
    const p = this.held;
    this.held = null;
    p.taken = false;
    p.x = Math.max(BOX.minX + 0.05, Math.min(BOX.maxX - 0.05, x));
    p.z = Math.max(BOX.minZ + 0.05, Math.min(BOX.maxZ - 0.05, z));
    this.slipAt = -1;
    this.sfx('bounce');
  }
}
