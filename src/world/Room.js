/* Salón: moqueta, paredes, techo, neones, tablero de récords y decorado. Todo procedural, sin archivos externos.
   Ejes: x de izquierda a derecha, z hacia la entrada (el jugador empieza en z>0 mirando a -z). */
import {
  Group, Mesh, PlaneGeometry, BoxGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, RepeatWrapping, AmbientLight, HemisphereLight, PointLight, Color, Fog
} from 'three';
import { FONT_FAMILY } from '../core/font.js';

export const ROOM = { minX: -5, maxX: 5, minZ: -4, maxZ: 4, height: 3.2 };
const BOARD = { x: ROOM.minX + 0.03, y: 1.75, z: -0.6, w: 2.6, h: 1.62 };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function texture(c, repeat) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

// Moqueta de salón: fondo oscuro con formas geométricas de colores.
function carpetTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#120a24';
  g.fillRect(0, 0, 256, 256);
  const colors = ['#ff3d8b', '#2fd8ff', '#ffd23f', '#7d4dff', '#3dff8b'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = colors[i % colors.length];
    g.fillStyle = colors[(i + 2) % colors.length];
    g.lineWidth = 3;
    const x = rnd() * 256, y = rnd() * 256, s = 6 + rnd() * 12, kind = i % 4;
    g.save();
    g.translate(x, y);
    g.rotate(rnd() * Math.PI);
    g.globalAlpha = 0.85;
    if (kind === 0) { g.beginPath(); g.arc(0, 0, s * 0.6, 0, Math.PI * 2); g.stroke(); }
    else if (kind === 1) { g.beginPath(); g.moveTo(-s, s * 0.6); g.lineTo(0, -s * 0.8); g.lineTo(s, s * 0.6); g.closePath(); g.stroke(); }
    else if (kind === 2) { g.beginPath(); g.moveTo(-s, 0); for (let k = 0; k < 4; k++) g.quadraticCurveTo(-s + k * s * 0.5 + s * 0.25, (k % 2 ? 1 : -1) * s * 0.5, -s + (k + 1) * s * 0.5, 0); g.stroke(); }
    else { g.fillRect(-2, -2, 4, 4); }
    g.restore();
  }
  return texture(c, [6, 5]);
}

// Pared: degradado violeta con un friso inferior.
function wallTexture() {
  const c = canvas(64, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a1033');
  grad.addColorStop(0.7, '#2a1650');
  grad.addColorStop(1, '#170c2c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#0d0820';
  g.fillRect(0, 214, 64, 42);
  g.fillStyle = '#3a2470';
  g.fillRect(0, 212, 64, 3);
  return texture(c, [8, 1]);
}

function signTexture(textValue, color, w = 1024, h = 160, size = 72) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.font = size + 'px ' + FONT_FAMILY + ', monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  for (const blur of [40, 20, 8]) {
    g.shadowBlur = blur;
    g.fillStyle = color;
    g.fillText(textValue, w / 2, h / 2);
  }
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.75;
  g.fillText(textValue, w / 2, h / 2);
  const t = texture(c);
  return t;
}

function posterTexture(title, sub, a, b) {
  const c = canvas(256, 360);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 360);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 360);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 360; y += 6) g.fillRect(0, y, 256, 2);
  g.fillStyle = '#fff';
  g.font = '22px ' + FONT_FAMILY + ', monospace';
  g.textAlign = 'center';
  g.fillText(title, 128, 60);
  g.font = '12px ' + FONT_FAMILY + ', monospace';
  g.fillText(sub, 128, 320);
  g.strokeStyle = '#fff';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 236, 340);
  g.beginPath();
  g.arc(128, 190, 70, 0, Math.PI * 2);
  g.stroke();
  return texture(c);
}

export class Room {
  constructor(quality) {
    this.group = new Group();
    this.colliders = [];
    this.lights = [];
    const add = (m) => { this.group.add(m); return m; };
    const W = ROOM.maxX - ROOM.minX;
    const Dp = ROOM.maxZ - ROOM.minZ;
    const Hh = ROOM.height;

    // Suelo, techo y paredes.
    const floor = add(new Mesh(new PlaneGeometry(W, Dp), new MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95 })));
    floor.rotation.x = -Math.PI / 2;
    const ceil = add(new Mesh(new PlaneGeometry(W, Dp), new MeshStandardMaterial({ color: 0x0a0716, roughness: 1 })));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = Hh;
    const wallMat = new MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 });
    const wall = (w, x, z, ry) => {
      const m = add(new Mesh(new PlaneGeometry(w, Hh), wallMat));
      m.position.set(x, Hh / 2, z);
      m.rotation.y = ry;
      return m;
    };
    wall(W, 0, ROOM.minZ, 0);
    wall(W, 0, ROOM.maxZ, Math.PI);
    wall(Dp, ROOM.minX, 0, Math.PI / 2);
    wall(Dp, ROOM.maxX, 0, -Math.PI / 2);

    // Paneles de luz en el techo.
    const panelMat = new MeshBasicMaterial({ color: 0xd8d0ff });
    for (const x of [-2.5, 2.5]) for (const z of [-2, 1.5]) {
      const p = add(new Mesh(new PlaneGeometry(1.2, 0.5), panelMat));
      p.rotation.x = Math.PI / 2;
      p.position.set(x, Hh - 0.01, z);
    }

    // Tubos de neón a lo largo de las paredes.
    const tube = (len, color, x, y, z, ry) => {
      const m = add(new Mesh(new CylinderGeometry(0.018, 0.018, len, 8), new MeshBasicMaterial({ color })));
      m.rotation.z = Math.PI / 2;
      m.rotation.y = ry;
      m.position.set(x, y, z);
    };
    tube(W - 0.4, 0xff3d8b, 0, 2.75, ROOM.minZ + 0.05, 0);
    tube(W - 0.4, 0x2fd8ff, 0, 0.42, ROOM.minZ + 0.05, 0);
    tube(Dp - 0.4, 0x2fd8ff, ROOM.minX + 0.05, 2.75, 0, Math.PI / 2);
    tube(Dp - 0.4, 0xff3d8b, ROOM.maxX - 0.05, 2.75, 0, Math.PI / 2);
    tube(W - 0.4, 0x7d4dff, 0, 2.75, ROOM.maxZ - 0.05, 0);

    // Letrero sobre las máquinas.
    const sign = add(new Mesh(new PlaneGeometry(4.0, 0.5), new MeshBasicMaterial({ map: signTexture('SALÓN RECREATIVO', '#ff3d8b', 1280, 160, 64), transparent: true })));
    sign.position.set(0, 2.32, ROOM.minZ + 0.02);

    // Puerta de entrada (decorado) en la pared del fondo.
    const door = add(new Mesh(new BoxGeometry(1.3, 2.3, 0.06), new MeshStandardMaterial({ color: 0x1b1430, roughness: 0.6 })));
    door.position.set(0, 1.15, ROOM.maxZ - 0.03);
    const exit = add(new Mesh(new PlaneGeometry(0.7, 0.16), new MeshBasicMaterial({ map: signTexture('SALIDA', '#3dff8b', 512, 120, 64), transparent: true })));
    exit.position.set(0, 2.5, ROOM.maxZ - 0.07);
    exit.rotation.y = Math.PI;

    // Carteles en la pared derecha.
    const posters = [['MAZE', 'MUNCHER · 1UP', '#2b3cff', '#ff3d8b'], ['BARREL', 'CLIMB · 7000', '#ff3d3d', '#ffb23f'], ['HIGH', 'SCORE · 1987', '#7d4dff', '#2fd8ff']];
    posters.forEach(([t, s, a, b], i) => {
      const p = add(new Mesh(new PlaneGeometry(0.7, 0.98), new MeshStandardMaterial({ map: posterTexture(t, s, a, b), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.06 })));
      p.position.set(ROOM.maxX - 0.02, 1.7, -2 + i * 1.6);
      p.rotation.y = -Math.PI / 2;
    });

    // Banco acolchado junto a la pared derecha.
    const bench = add(new Mesh(new BoxGeometry(0.5, 0.45, 1.8), new MeshStandardMaterial({ color: 0x8b1e4f, roughness: 0.7 })));
    bench.position.set(ROOM.maxX - 0.45, 0.225, 1.6);
    this.colliders.push({ minX: ROOM.maxX - 0.7, maxX: ROOM.maxX, minZ: 0.7, maxZ: 2.5, id: 'bench' });

    // Tablero de récords: pantalla en la pared izquierda, con marco luminoso.
    this.boardCanvas = canvas(1024, 640);
    this.boardTexture = texture(this.boardCanvas);
    const frame = add(new Mesh(new BoxGeometry(0.06, BOARD.h + 0.12, BOARD.w + 0.12), new MeshStandardMaterial({ color: 0x0b0b14, emissive: 0x2fd8ff, emissiveIntensity: 0.35 })));
    frame.position.set(BOARD.x + 0.01, BOARD.y, BOARD.z);
    const board = add(new Mesh(new PlaneGeometry(BOARD.w, BOARD.h), new MeshBasicMaterial({ map: this.boardTexture })));
    board.position.set(BOARD.x + 0.05, BOARD.y, BOARD.z);
    board.rotation.y = Math.PI / 2;
    this.board = board;

    // Luces: ambiente tenue + puntos de color (sin sombras).
    add(new HemisphereLight(0x6a5acd, 0x1a0f2e, 0.9));
    add(new AmbientLight(0x30284a, 0.6));
    const points = [
      [0xffffff, 0, 2.9, -2, 14, 7],      // sobre las máquinas
      [0xff3d8b, -3.5, 2.6, 2, 8, 6],
      [0x2fd8ff, 3.5, 2.6, -1, 8, 6],
      [0xb8a8ff, 0, 2.9, 2.2, 8, 7]
    ];
    for (const [color, x, y, z, intensity, dist] of points) {
      const l = new PointLight(color, intensity, dist, 1.6);
      l.position.set(x, y, z);
      add(l);
      this.lights.push(l);
    }
    this.setQuality(quality);
    this.fog = new Fog(new Color(0x0a0716), 7, 16);
  }

  setQuality(q) {
    // En calidad baja solo queda la luz principal.
    this.lights.forEach((l, i) => { l.visible = q !== 'low' || i === 0; });
  }

  // Redibuja el tablero: rows = { maze: [{name,best,level}], climb: [...] }, activeName resaltado.
  drawBoard(rows, activeName, gameNames) {
    this.lastRows = rows;
    const g = this.boardCanvas.getContext('2d');
    const w = this.boardCanvas.width, h = this.boardCanvas.height;
    g.fillStyle = '#05030c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(47,216,255,0.05)';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
    g.textBaseline = 'top';
    g.font = '40px ' + FONT_FAMILY + ', monospace';
    g.textAlign = 'center';
    g.fillStyle = '#ffd23f';
    g.shadowColor = '#ffd23f';
    g.shadowBlur = 12;
    g.fillText('RÉCORDS', w / 2, 30);
    g.shadowBlur = 0;
    const cols = [['maze', 40, '#2fd8ff'], ['climb', w / 2 + 20, '#ff3d8b']];
    for (const [id, x0, color] of cols) {
      g.textAlign = 'left';
      g.font = '24px ' + FONT_FAMILY + ', monospace';
      g.fillStyle = color;
      g.fillText(gameNames[id], x0, 110);
      g.fillRect(x0, 146, w / 2 - 60, 3);
      const list = rows[id];
      g.font = '22px ' + FONT_FAMILY + ', monospace';
      if (!list.length) {
        g.fillStyle = '#7a86c8';
        g.fillText('SIN JUGADORES', x0, 180);
      }
      list.slice(0, 5).forEach((r, i) => {
        const y = 176 + i * 76;
        const mine = r.name === activeName;
        g.fillStyle = mine ? '#ffd23f' : '#ffffff';
        g.textAlign = 'left';
        g.fillText((i + 1) + '. ' + r.name, x0, y);
        g.textAlign = 'right';
        g.fillText(String(r.best), x0 + w / 2 - 60, y);
        g.font = '14px ' + FONT_FAMILY + ', monospace';
        g.fillStyle = '#7a86c8';
        g.fillText(r.best ? 'NIVEL ' + r.level : '—', x0 + w / 2 - 60, y + 30);
        g.font = '22px ' + FONT_FAMILY + ', monospace';
      });
    }
    this.boardTexture.needsUpdate = true;
  }
}
