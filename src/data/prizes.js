/* Catálogo de premios del mostrador (se canjean por tickets) y peluches de la grúa (no se venden). */

export const PRIZES = [
  { id: 'keychain', name: 'LLAVERO PIXEL', cost: 15 },
  { id: 'duck', name: 'PATITO DE GOMA', cost: 30 },
  { id: 'sunglasses', name: 'GAFAS DE SOL', cost: 45 },
  { id: 'ghostPlush', name: 'FANTASMA DE PELUCHE', cost: 60 },
  { id: 'bronze', name: 'TROFEO DE BRONCE', cost: 90 },
  { id: 'silver', name: 'TROFEO DE PLATA', cost: 160 },
  { id: 'miniCabinet', name: 'RECREATIVA EN MINIATURA', cost: 240 },
  { id: 'gold', name: 'TROFEO DE ORO', cost: 350 }
];

export const PLUSH = [
  { id: 'plushBear', name: 'OSITO', color: 0xc8742c },
  { id: 'plushBunny', name: 'CONEJITO', color: 0xff8ad8 },
  { id: 'plushCat', name: 'GATITO', color: 0x8a8aa8 },
  { id: 'plushFrog', name: 'RANITA', color: 0x3dff8b }
];

export function prizeById(id) {
  return PRIZES.find((p) => p.id === id) || PLUSH.find((p) => p.id === id) || null;
}
