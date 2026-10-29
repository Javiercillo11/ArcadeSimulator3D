/* Arte impreso de las máquinas, dibujado en canvas: vinilos laterales, marquesina, bisel, cubierta de mandos,
   puerta de monedas y pegatinas. Usa los sprites de cada juego ampliados, como el arte de los muebles de la época. */
import { sprites as S } from '../gfx/sprites.js';
import MazeSprites from '../games/maze/mazeSprites.js';
import ClimbSprites from '../games/climb/climbSprites.js';
import { FONT_FAMILY } from '../core/font.js';

const PIXEL = (px) => px + 'px ' + FONT_FAMILY + ', monospace';
const SANS = (px) => '900 ' + px + 'px "Arial Black", "Helvetica Neue", Arial, sans-serif';

export const css = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function buildSprites() {
  MazeSprites.build();
  ClimbSprites.build();
}

// Sprite ampliado sin suavizado, con un borde recortado de color (aspecto de pegatina troquelada).
function outlined(name, scale, border, color = '#ffffff', flip = false) {
  const img = S.get(name, flip);
  const pad = border + 1;
  const w = img.width * scale + pad * 2, h = img.height * scale + pad * 2;
  const sil = canvas(w, h);
  const sg = sil.getContext('2d');
  sg.imageSmoothingEnabled = false;
  sg.drawImage(img, pad, pad, img.width * scale, img.height * scale);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, w, h);
  const out = canvas(w, h);
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (border > 0) {
    for (let a = 0; a < 16; a++) {
      const ang = a * Math.PI / 8;
      g.drawImage(sil, Math.round(Math.cos(ang) * border), Math.round(Math.sin(ang) * border));
    }
  }
  g.drawImage(img, pad, pad, img.width * scale, img.height * scale);
  return out;
}

function drawSprite(g, name, x, y, scale, flip = false) {
  const img = S.get(name, flip);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g, cx, cy, spikes, outer, inner) {
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

// Texto con contorno grueso (estilo logotipo de recreativa).
function logo(g, text, x, y, size, fill, stroke = '#000', font = PIXEL) {
  g.font = font(size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.32;
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

function mirror(src) {
  const c = canvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

// ------------------------------------------------------------ vinilo lateral
// u (x del canvas) va de la trasera (0) al frente (512); v (y) de arriba (0) al suelo (1024).
// El cuerpo bajo (y > 540) ocupa casi todo el ancho; arriba solo la mitad trasera es lateral.

function sideMaze(g, colors) {
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#0b1240');
  grad.addColorStop(0.5, css(colors.body));
  grad.addColorStop(1, '#070b2a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  // Pasillos del laberinto en neón tenue.
  g.strokeStyle = 'rgba(80,110,255,0.35)';
  g.lineWidth = 10;
  for (let i = 0; i < 9; i++) {
    roundRect(g, 18 + (i % 3) * 150, 470 + Math.floor(i / 3) * 170, 120, 120, 26);
    g.stroke();
  }
  // Rayo de luz y estallido amarillo detrás del protagonista.
  g.fillStyle = 'rgba(255,210,63,0.18)';
  star(g, 150, 230, 14, 230, 150);
  g.fill();
  drawSprite(g, 'munch2', 40, 110, 17);
  // Rastro de puntos hacia la trasera… y la superpíldora.
  g.fillStyle = '#ffd6a8';
  for (let i = 0; i < 5; i++) g.fillRect(40 + i * 46, 360, 14, 14);
  g.beginPath();
  g.arc(266, 367, 20, 0, Math.PI * 2);
  g.fill();
  // Los cuatro enemigos persiguiéndole por el cuerpo bajo.
  const ghosts = ['spook0_0', 'spook1_1', 'spook2_0', 'scared_1'];
  ghosts.forEach((n, i) => drawSprite(g, n, 26 + i * 104, 600 + (i % 2) * 26, 6));
  logo(g, 'MAZE', 230, 812, 92, '#ffd23f');
  logo(g, 'MUNCHER', 230, 905, 56, '#ff8ad8');
  // Franja de color en el zócalo.
  g.fillStyle = css(colors.accent);
  g.fillRect(0, 975, 512, 14);
  g.fillStyle = '#ff3d8b';
  g.fillRect(0, 995, 512, 8);
}

function sideClimb(g, colors) {
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#2a0510');
  grad.addColorStop(0.55, css(colors.body));
  grad.addColorStop(1, '#22030a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  // Vigas rosas inclinadas con su celosía, y escaleras cian.
  const girder = (y0, y1) => {
    g.save();
    g.beginPath();
    g.moveTo(0, y0);
    g.lineTo(512, y1);
    g.lineTo(512, y1 + 34);
    g.lineTo(0, y0 + 34);
    g.closePath();
    g.fillStyle = '#ff3d6e';
    g.fill();
    g.clip();
    g.strokeStyle = '#8a0d2e';
    g.lineWidth = 5;
    for (let x = -40; x < 560; x += 34) {
      g.beginPath();
      g.moveTo(x, Math.min(y0, y1) - 10);
      g.lineTo(x + 34, Math.max(y0, y1) + 50);
      g.moveTo(x + 34, Math.min(y0, y1) - 10);
      g.lineTo(x, Math.max(y0, y1) + 50);
      g.stroke();
    }
    g.restore();
  };
  g.strokeStyle = '#2fd8ff';
  g.lineWidth = 7;
  for (const [x, top, bot] of [[110, 470, 620], [400, 480, 610], [70, 300, 460]]) {
    g.beginPath();
    g.moveTo(x, top); g.lineTo(x, bot);
    g.moveTo(x + 44, top); g.lineTo(x + 44, bot);
    for (let y = top + 14; y < bot; y += 26) { g.moveTo(x, y); g.lineTo(x + 44, y); }
    g.stroke();
  }
  girder(440, 470);
  girder(640, 600);
  girder(820, 850);
  // GROG arriba, lanzando barriles hacia abajo.
  g.fillStyle = 'rgba(155,77,255,0.25)';
  star(g, 140, 200, 12, 200, 130);
  g.fill();
  drawSprite(g, 'grogThrow', 20, 60, 7);
  for (let i = 0; i < 3; i++) drawSprite(g, 'barrel' + i, 250 + i * 70, 380 + i * 28, 5);
  // PIP saltando un barril en el cuerpo bajo.
  drawSprite(g, 'pipJump', 250, 500, 8);
  drawSprite(g, 'barrel2', 300, 575, 6);
  logo(g, 'BARREL', 230, 728, 78, '#2fd8ff');
  logo(g, 'CLIMB', 230, 925, 96, '#ffd23f');
  g.fillStyle = css(colors.accent);
  g.fillRect(0, 975, 512, 14);
  g.fillStyle = '#ffd23f';
  g.fillRect(0, 995, 512, 8);
}

const BRICK_COLORS = ['#ff3b3b', '#ff8c1a', '#ffd23f', '#3dff8b', '#33e6ff', '#3d6bff', '#9b4dff'];

function brickRect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fillRect(x, y, w, Math.max(2, h * 0.15));
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(x, y + h * 0.85, w, h * 0.15);
}

function sideBrick(g, colors) {
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#0a1a3a');
  grad.addColorStop(0.5, css(colors.body));
  grad.addColorStop(1, '#071022');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  // Muro de ladrillos que se rompe hacia la parte delantera.
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 6; c++) {
      if ((r * 7 + c * 3) % 5 === 0 || c > 4 - (r % 3)) continue;
      brickRect(g, 8 + c * 46 + (r % 2) * 22, 40 + r * 30, 42, 26, BRICK_COLORS[r % BRICK_COLORS.length]);
    }
  }
  // Bola con estela y pala.
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(300 - i * 26, 420 + i * 30, 18 - i * 2, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(310, 410, 20, 0, Math.PI * 2); g.fill();
  brickRect(g, 120, 600, 240, 30, '#ff3d8b');
  g.fillStyle = '#c8ccd6';
  g.fillRect(120, 600, 24, 30);
  g.fillRect(336, 600, 24, 30);
  logo(g, 'BRICK', 230, 760, 96, '#ffd23f');
  logo(g, 'BLAST', 230, 880, 96, '#ff3d8b');
  g.fillStyle = css(colors.accent);
  g.fillRect(0, 975, 512, 14);
  g.fillStyle = '#ff3d8b';
  g.fillRect(0, 995, 512, 8);
}

// Máquina averiada: vinilo descolorido, rayado y con el logotipo medio despegado.
function sideBroken(g) {
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#2a2a33');
  grad.addColorStop(1, '#16161c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  g.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) { g.fillStyle = ['#ff3d8b', '#2fd8ff'][i % 2]; g.fillRect(0, 560 + i * 60, 512, 26); }
  g.globalAlpha = 0.5;
  logo(g, 'STAR', 230, 760, 90, '#8e94a4');
  logo(g, 'PATROL', 230, 870, 70, '#6a7084');
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 2;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 512, y = rnd() * 1024;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 30); g.stroke();
  }
}

// Devuelve [izquierda, derecha]: el lado derecho va en espejo para que el texto se lea bien en los dos.
export function sideArt(id, colors) {
  buildSprites();
  const c = canvas(512, 1024);
  const g = c.getContext('2d');
  if (id === 'maze') sideMaze(g, colors);
  else if (id === 'climb') sideClimb(g, colors);
  else if (id === 'brick') sideBrick(g, colors);
  else sideBroken(g);
  return [c, mirror(c)];
}

// ------------------------------------------------------------ marquesina

export function marqueeArt(id, title, colors) {
  buildSprites();
  const c = canvas(1024, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, colors.marqueeTop);
  grad.addColorStop(1, colors.marqueeBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  // Rayos desde el centro.
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) {
    g.beginPath();
    g.moveTo(512, 128);
    const a = (i / 16) * Math.PI * 2;
    g.lineTo(512 + Math.cos(a) * 900, 128 + Math.sin(a) * 900);
    g.lineTo(512 + Math.cos(a + 0.12) * 900, 128 + Math.sin(a + 0.12) * 900);
    g.fill();
  }
  g.restore();
  g.strokeStyle = colors.accent;
  g.lineWidth = 10;
  roundRect(g, 14, 14, 996, 228, 20);
  g.stroke();
  if (id === 'maze') {
    drawSprite(g, 'munch2', 40, 70, 9);
    drawSprite(g, 'spook0_0', 870, 70, 8);
    g.fillStyle = '#ffd6a8';
    for (let i = 0; i < 3; i++) g.fillRect(170 + i * 22, 124, 10, 10);
  } else if (id === 'climb') {
    drawSprite(g, 'grogIdle', 34, 40, 5);
    drawSprite(g, 'barrel1', 880, 80, 9);
  } else if (id === 'brick') {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      brickRect(g, 40 + c * 50, 60 + r * 46, 46, 40, BRICK_COLORS[(r + c) % 7]);
      brickRect(g, 830 + c * 50, 60 + r * 46, 46, 40, BRICK_COLORS[(r + c + 3) % 7]);
    }
  } else {
    // Marquesina apagada: casi sin luz y con el tubo roto.
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(0, 0, 1024, 256);
  }
  g.shadowColor = colors.accent;
  g.shadowBlur = 24;
  logo(g, title, 512, 132, 72, '#ffffff', '#000');
  g.shadowBlur = 0;
  logo(g, title, 512, 128, 72, colors.accent, 'rgba(0,0,0,0)');
  return c;
}

// ------------------------------------------------------------ bisel alrededor de la pantalla

export function bezelArt(id, colors, screenFrac) {
  buildSprites();
  const W = 512, H = Math.round(512 * screenFrac.aspect);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#15141f');
  grad.addColorStop(1, '#07060c');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const sw = W * screenFrac.w, sh = H * screenFrac.h;
  const sx = (W - sw) / 2, sy = (H - sh) / 2;
  // Marco de color con esquinas redondeadas y una línea interior fina.
  g.strokeStyle = colors.accent;
  g.lineWidth = 10;
  roundRect(g, sx - 16, sy - 16, sw + 32, sh + 32, 18);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  roundRect(g, sx - 26, sy - 26, sw + 52, sh + 52, 24);
  g.stroke();
  g.font = PIXEL(12);
  g.textAlign = 'center';
  g.fillStyle = '#cfd2ff';
  g.fillText('1 JUGADOR', W / 2, sy - 34);
  g.fillStyle = colors.accent;
  g.fillText({ maze: '¡COME TODOS LOS PUNTOS!', climb: '¡RESCATA A LUNA!', brick: '¡NO DEJES NI UNO!' }[id] || 'INSERT COIN', W / 2, sy + sh + 44);
  // Personajes a los lados de la pantalla.
  const side = id === 'maze' ? ['spook0_0', 'spook1_0', 'spook2_0', 'spook3_0'] : id === 'climb' ? ['barrel0', 'hammer', 'heart', 'flameA'] : null;
  for (let i = 0; i < 4; i++) {
    const y = sy + 20 + i * (sh - 40) / 3;
    if (side) {
      drawSprite(g, side[i], 22, y - 16, 3);
      drawSprite(g, side[i], W - 70, y - 16, 3, true);
    } else if (id === 'brick') {
      brickRect(g, 22, y - 10, 48, 20, BRICK_COLORS[i]);
      brickRect(g, W - 70, y - 10, 48, 20, BRICK_COLORS[i + 3]);
    }
  }
  return c;
}

// ------------------------------------------------------------ cubierta de mandos

// layout: { inner, len, stick: [x,z], buttons: { jump: [x,z], jump2: [x,z], start: [x,z] } } en metros.
export function deckArt(id, colors, layout) {
  const W = 1024, H = Math.round(1024 * layout.len / layout.inner);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const px = (x) => (x / layout.inner + 0.5) * W;
  const pz = (z) => (z / layout.len + 0.5) * H;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, css(colors.stripe));
  grad.addColorStop(1, css(colors.body));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Franjas diagonales al fondo y el nombre del juego.
  g.save();
  g.globalAlpha = 0.25;
  g.fillStyle = colors.accent;
  for (let x = -H; x < W; x += 90) {
    g.beginPath();
    g.moveTo(x, H); g.lineTo(x + 40, H); g.lineTo(x + 40 + H, 0); g.lineTo(x + H, 0);
    g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, W, 34);
  g.font = PIXEL(18);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = colors.accent;
  g.fillText({ maze: 'MAZE MUNCHER', climb: 'BARREL CLIMB', brick: 'BRICK BLAST' }[id] || 'STAR PATROL', 24, 18);
  // Rosa de direcciones alrededor de la palanca.
  const [jx, jz] = [px(layout.stick[0]), pz(layout.stick[1])];
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(jx, jz, 92, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    g.save();
    g.translate(jx + Math.cos(a) * 110, jz + Math.sin(a) * 110);
    g.rotate(a);
    g.beginPath();
    g.moveTo(12, 0); g.lineTo(-8, -12); g.lineTo(-8, 12);
    g.fill();
    g.restore();
  }
  // Aros y rótulos de los botones.
  const label = (pos, text, r) => {
    const x = px(pos[0]), z = pz(pos[1]);
    g.strokeStyle = colors.accent;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, z, r, 0, Math.PI * 2);
    g.stroke();
    g.font = PIXEL(13);
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.fillText(text, x, z + r + 18);
  };
  const jumpText = id === 'climb' ? 'SALTAR' : id === 'brick' ? 'LANZAR' : 'A';
  label(layout.buttons.jump, jumpText, 54);
  label(layout.buttons.jump2, id === 'climb' ? 'SALTAR' : id === 'brick' ? 'LANZAR' : 'B', 54);
  label(layout.buttons.start, '1P START', 34);
  // Tarjeta de instrucciones a la derecha.
  const cx = px(0.215), cz = pz(-0.06);
  g.save();
  g.translate(cx, cz);
  g.rotate(-0.04);
  g.fillStyle = '#f4f0e0';
  roundRect(g, -78, -64, 156, 128, 8);
  g.fill();
  g.fillStyle = '#1a1a2a';
  g.font = PIXEL(11);
  g.textAlign = 'center';
  g.fillText('CÓMO JUGAR', 0, -44);
  g.font = PIXEL(9);
  const lines = {
    maze: ['COME LOS PUNTOS', 'EVITA A LOS 4', 'SUPERPÍLDORA:', '¡A POR ELLOS!'],
    climb: ['SUBE LAS VIGAS', 'SALTA BARRILES', 'MARTILLO: ROMPE', 'RESCATA A LUNA'],
    brick: ['MUEVE LA PALA', 'ROMPE LADRILLOS', 'PLATA: 2 GOLPES', 'COGE CÁPSULAS']
  }[id] || ['ESTA MÁQUINA', 'NO FUNCIONA', 'PERDONEN LAS', 'MOLESTIAS'];
  lines.forEach((l, i) => g.fillText(l, 0, -18 + i * 18));
  g.restore();
  return c;
}

// ------------------------------------------------------------ puerta de monedas

export function coinDoorArt() {
  const c = canvas(256, 200);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 200);
  grad.addColorStop(0, '#d8dce6');
  grad.addColorStop(0.5, '#8e94a4');
  grad.addColorStop(1, '#c4c8d4');
  g.fillStyle = grad;
  roundRect(g, 0, 0, 256, 200, 14);
  g.fill();
  // Pulido cepillado.
  g.globalAlpha = 0.12;
  g.fillStyle = '#ffffff';
  for (let y = 0; y < 200; y += 3) g.fillRect(0, y, 256, 1);
  g.globalAlpha = 1;
  g.strokeStyle = '#4a4f5e';
  g.lineWidth = 4;
  roundRect(g, 6, 6, 244, 188, 10);
  g.stroke();
  for (const x of [69, 187]) {
    g.fillStyle = '#3a3e4a';
    roundRect(g, x - 34, 34, 68, 92, 8);
    g.fill();
    g.fillStyle = '#ffd23f';
    g.font = PIXEL(14);
    g.textAlign = 'center';
    g.fillText('1€', x, 116);
  }
  g.fillStyle = '#1b1c22';
  g.font = PIXEL(10);
  g.fillText('INSERTE MONEDA', 128, 158);
  // Cerradura.
  g.fillStyle = '#5a5f6e';
  g.beginPath();
  g.arc(128, 182, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.fillRect(126, 176, 4, 10);
  return c;
}

// ------------------------------------------------------------ pegatinas
// Cada una: { c: canvas, w, h (metros), face: 'front' | 'left' | 'right', x (o z en los laterales), y, rot }

function sticker(w, h, draw) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  draw(g, w, h);
  return c;
}

function priceSticker() {
  return sticker(320, 140, (g, w, h) => {
    g.fillStyle = '#ffffff';
    roundRect(g, 0, 0, w, h, 26);
    g.fill();
    g.fillStyle = '#ffd23f';
    roundRect(g, 8, 8, w - 16, h - 16, 20);
    g.fill();
    logo(g, '1 CRÉDITO', w / 2, 50, 30, '#1a1a2a', 'rgba(0,0,0,0)');
    g.font = SANS(28);
    g.fillStyle = '#c4122e';
    g.textAlign = 'center';
    g.fillText('= 1 PARTIDA', w / 2, 104);
  });
}

function noDrinksSticker() {
  return sticker(260, 130, (g, w, h) => {
    g.fillStyle = '#ffffff';
    roundRect(g, 0, 0, w, h, 14);
    g.fill();
    g.strokeStyle = '#c4122e';
    g.lineWidth = 6;
    roundRect(g, 6, 6, w - 12, h - 12, 10);
    g.stroke();
    // Vaso tachado.
    g.fillStyle = '#2a7fff';
    g.beginPath();
    g.moveTo(34, 38); g.lineTo(78, 38); g.lineTo(72, 96); g.lineTo(40, 96);
    g.fill();
    g.strokeStyle = '#c4122e';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(56, 66, 40, 0, Math.PI * 2);
    g.moveTo(28, 38); g.lineTo(84, 94);
    g.stroke();
    g.fillStyle = '#1a1a2a';
    g.font = SANS(22);
    g.textAlign = 'left';
    g.fillText('NO APOYAR', 112, 58);
    g.fillText('BEBIDAS', 112, 88);
  });
}

function highScoreSticker(colors) {
  return sticker(300, 300, (g, w, h) => {
    g.fillStyle = '#ffffff';
    star(g, w / 2, h / 2, 16, 148, 118);
    g.fill();
    g.fillStyle = '#ff3d8b';
    star(g, w / 2, h / 2, 16, 136, 108);
    g.fill();
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.18);
    logo(g, 'HIGH', 0, -28, 42, '#ffd23f');
    logo(g, 'SCORE', 0, 26, 38, '#ffffff');
    g.restore();
  });
}

function propertySticker(n) {
  return sticker(360, 120, (g, w, h) => {
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, w, h);
    g.save();
    g.beginPath();
    g.rect(0, 0, w, 26);
    g.rect(0, h - 26, w, 26);
    g.clip();
    g.fillStyle = '#111';
    for (let x = -40; x < w + 40; x += 36) {
      g.beginPath();
      g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x - 8, h); g.lineTo(x - 26, h);
      g.fill();
    }
    g.restore();
    g.fillStyle = '#111';
    g.font = PIXEL(18);
    g.textAlign = 'center';
    g.fillText('PROPIEDAD DEL SALÓN', w / 2, 56);
    g.font = PIXEL(16);
    g.fillText('MÁQUINA Nº ' + n, w / 2, 84);
  });
}

function spriteSticker(name, scale, flip) {
  return outlined(name, scale, 6, '#ffffff', flip);
}

function warningSticker() {
  return sticker(300, 270, (g, w) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w, 236); g.lineTo(0, 236);
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 18;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.fill();
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.moveTo(w / 2, 22); g.lineTo(w - 22, 222); g.lineTo(22, 222);
    g.closePath();
    g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 8;
    g.stroke();
    drawSprite(g, 'barrel0', w / 2 - 35, 96, 6);
    g.fillStyle = '#111';
    g.font = PIXEL(18);
    g.textAlign = 'center';
    g.fillText('¡CUIDADO!', w / 2, 212);
    g.fillStyle = '#ffffff';
    g.font = PIXEL(16);
    g.fillText('BARRILES', w / 2, 260);
  });
}

function oneUpSticker() {
  return sticker(220, 140, (g, w, h) => {
    g.fillStyle = '#ffffff';
    roundRect(g, 0, 0, w, h, 70);
    g.fill();
    g.fillStyle = '#2fd8ff';
    roundRect(g, 8, 8, w - 16, h - 16, 62);
    g.fill();
    logo(g, '1UP!', w / 2, h / 2 + 2, 46, '#ffffff', '#1d2bb8');
  });
}

function heartSticker() {
  return sticker(260, 240, (g, w) => {
    const heart = outlined('heart', 14, 8);
    g.drawImage(heart, (w - heart.width) / 2, 0);
    logo(g, 'SALVA A LUNA', w / 2, 214, 20, '#ffffff', '#c4122e');
  });
}

function outOfOrderSticker() {
  return sticker(420, 150, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4122e';
    g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffffff';
    g.font = SANS(40);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FUERA DE', w / 2, 52);
    g.fillText('SERVICIO', w / 2, 104);
  });
}

function brickBurstSticker() {
  return sticker(260, 260, (g, w, h) => {
    g.fillStyle = '#ffffff';
    star(g, w / 2, h / 2, 12, 128, 100);
    g.fill();
    g.fillStyle = '#3dff8b';
    star(g, w / 2, h / 2, 12, 116, 90);
    g.fill();
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(0.15);
    logo(g, '¡ROMPE', 0, -22, 32, '#ffffff', '#0a1a3a');
    logo(g, 'TODO!', 0, 22, 36, '#ffd23f', '#0a1a3a');
    g.restore();
  });
}

export function stickers(id, number, colors) {
  buildSprites();
  if (id === 'broken') {
    return [
      { c: outOfOrderSticker(), w: 0.24, h: 0.085, face: 'front', x: 0, y: 0.74, rot: -0.08 },
      { c: noDrinksSticker(), w: 0.13, h: 0.065, face: 'front', x: 0.19, y: 0.24, rot: 0.04 },
      { c: propertySticker(number), w: 0.15, h: 0.05, face: 'right', x: -0.22, y: 0.14, rot: 0.0 }
    ];
  }
  const list = [
    { c: priceSticker(), w: 0.16, h: 0.07, face: 'front', x: 0.0, y: 0.76, rot: -0.05 },
    { c: noDrinksSticker(), w: 0.13, h: 0.065, face: 'front', x: 0.19, y: 0.24, rot: 0.04 },
    { c: highScoreSticker(colors), w: 0.15, h: 0.15, face: 'left', x: 0.17, y: 0.66, rot: 0.2 },
    { c: propertySticker(number), w: 0.15, h: 0.05, face: 'right', x: -0.22, y: 0.14, rot: 0.0 }
  ];
  if (id === 'maze') {
    list.push({ c: spriteSticker('spook1_0', 8), w: 0.095, h: 0.095, face: 'front', x: -0.2, y: 0.27, rot: -0.22 });
    list.push({ c: spriteSticker('scared_0', 8), w: 0.07, h: 0.07, face: 'left', x: -0.25, y: 0.3, rot: 0.15 });
    list.push({ c: oneUpSticker(), w: 0.11, h: 0.07, face: 'right', x: 0.12, y: 0.66, rot: -0.12 });
  } else if (id === 'brick') {
    list.push({ c: brickBurstSticker(), w: 0.11, h: 0.11, face: 'front', x: -0.2, y: 0.27, rot: -0.15 });
    list.push({ c: oneUpSticker(), w: 0.11, h: 0.07, face: 'right', x: 0.12, y: 0.66, rot: -0.12 });
  } else {
    list.push({ c: spriteSticker('barrel1', 9), w: 0.09, h: 0.09, face: 'front', x: -0.2, y: 0.27, rot: 0.18 });
    list.push({ c: heartSticker(), w: 0.11, h: 0.1, face: 'left', x: -0.24, y: 0.3, rot: -0.1 });
    list.push({ c: warningSticker(), w: 0.13, h: 0.12, face: 'right', x: 0.1, y: 0.64, rot: 0.08 });
  }
  return list;
}
