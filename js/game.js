// space-runner — MIT License (c) 2026 Kor-sh
'use strict';
(() => {
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W = 320, H = 180, S = 3;
function resize() {
  S = Math.max(2, Math.round(Math.min(innerWidth / 320, innerHeight / 200)));
  W = Math.ceil(innerWidth / S); H = Math.ceil(innerHeight / S);
  cv.width = W; cv.height = H; cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize); resize();

// ---------- palette ----------
const P = { bg0:'#0b0820', bg1:'#1a1040', ink:'#fff4e0', dim:'#8a7fb8', gold:'#ffd35c', gold2:'#ff9f3a', cyan:'#5ee7ff', red:'#ff5577', suit:'#e8f0ff', suit2:'#9aa8d8', visor:'#5ee7ff' };
const TYPES = [
  { name:'rock', c:['#3b2a4f','#6b4a6e','#a86f6a','#e0a27a'], atm:'#e0a27a' },
  { name:'ice',  c:['#1f3a6b','#3f6fb0','#7fc0e8','#dff6ff'], atm:'#7fc0e8' },
  { name:'moss', c:['#1d3b3a','#2f6b4a','#5fae5a','#c6e86a'], atm:'#9fe07a' },
  { name:'lava', c:['#2a1030','#6b1f3a','#d8452f','#ffb03a'], atm:'#ff7a3a' },
  { name:'dust', c:['#3a2a20','#7a5030','#c08a48','#f0d08a'], atm:'#f0d08a' },
  { name:'void', c:['#1a1438','#3a2a78','#7a5ad8','#c8a8ff'], atm:'#a88aff' },
];

// ---------- rng ----------
function hash(a, b, c = 0) { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
let SEED = 1;

// ---------- pixel font 3x5 ----------
const FONT = {};
('A010101111101101B110101110101110C011100100100011D110101101101110E111100110100111F111100110100100G011100101101011H101101111101101I111010010010111J001001001101010K101101110101101L100100100100111M101111111101101N110101101101101O010101101101010P110101110100100Q010101101110011R110101110101101S011100010001110T111010010010010U101101101101111V101101101101010W101101111111101X101101010101101Y101101010010010Z111001010100111'+
 '0111101101101111101011001001011121100010101001113110001010001110410110111100100151111001100011106011100111101111711100101001001081111011111011119111101111001110-000000111000000.000000000000010:000010000010000!010010010000010/001001010100100').replace(/(.)([01]{15})/g, (_, ch, b) => FONT[ch] = b);
function text(s, x, y, col, sc = 1, center = false) {
  x = Math.floor(x); y = Math.floor(y); s = String(s).toUpperCase(); if (center) x -= Math.floor((s.length * 4 - 1) * sc / 2);
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) { const f = FONT[s[i]]; if (f) for (let k = 0; k < 15; k++) if (f[k] === '1') ctx.fillRect(x + (i * 4 + k % 3) * sc, y + ((k / 3) | 0) * sc, sc, sc); }
}
function textS(s, x, y, col, sc = 1, center = false) { text(s, x + sc, y + sc, '#0008', sc, center); text(s, x, y, col, sc, center); }

// ---------- world (infinite seeded chunks) ----------
const CH = 420; const chunks = new Map(), rawChunks = new Map();
// planets keep a clear gap: surface + fur + rings + margin, also across chunk borders
const pExt = p => p.rings ? p.r * 1.95 + 4 : p.r + 4, GAP = 40;
const tooClose = (p, q) => Math.hypot(q.x - p.x, q.y - p.y) < pExt(p) + pExt(q) + GAP;
const prio = p => p.home ? Infinity : p.seed;
function getChunk(cx, cy) {
  const key = cx + ',' + cy; let c = chunks.get(key); if (c) return c;
  const raw = rawChunk(cx, cy), others = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i || j) others.push(...rawChunk(cx + i, cy + j).planets);
  // deterministic: a planet is dropped if a higher-priority planet from a neighbour chunk is too close
  const drop = new Set(raw.planets.filter(p => others.some(q => prio(q) > prio(p) && tooClose(p, q))));
  c = { planets: raw.planets.filter(p => !drop.has(p)), items: raw.items.filter(o => !drop.has(o.owner)) };
  chunks.set(key, c); return c;
}
function rawChunk(cx, cy) {
  const key = cx + ',' + cy; let c = rawChunks.get(key); if (c) return c;
  const r = rng(Math.floor(hash(cx, cy, SEED) * 4e9) + 7);
  c = { planets: [], items: [] };
  const n = (cx === 0 && cy === 0) ? 1 : 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    let p, tries = 0;
    do {
      const rad = (cx === 0 && cy === 0) ? 46 : (r() < 0.25 ? 9 + r() * 7 : 20 + r() * 42);
      p = { x: cx * CH + 70 + r() * (CH - 140), y: cy * CH + 70 + r() * (CH - 140), r: Math.round(rad), t: TYPES[(r() * TYPES.length) | 0], seed: (r() * 1e9) | 0, rings: rad > 40 && r() < 0.21, /* ring chance x0.6 */ spin: (r() - .5) * 0.3 };
      if (cx === 0 && cy === 0) { p.x = 0; p.y = 60; p.t = TYPES[2]; p.home = true; p.rings = false; /* spawn planet: never ringed */ }
      tries++;
    } while (tries < 8 && c.planets.some(q => tooClose(p, q)));
    if (tries >= 8 && i > 0) continue;
    p.g = 2 * (200 + p.r * 2.2); /* gravity x2 */ p.range = p.r * 4 + 70;
    c.planets.push(p);
    // orbiting pickups
    const k = 3 + (r() * 6) | 0, a0 = r() * 6.28, h = 10 + r() * 22;
    for (let j = 0; j < k; j++) { const a = a0 + j * 0.28; c.items.push({ x: p.x + Math.cos(a) * (p.r + h), y: p.y + Math.sin(a) * (p.r + h), k: 'star', got: false, ph: r() * 6, owner: p }); }
    if (r() < 0.6 && !p.home) /* spawn planet: no fuel boost */ { const a = r() * 6.28; const tier = p.g < 500 ? 0 : p.g < 600 ? 1 : 2; /* thresholds x2 with gravity: same tiers */ const hh = 5 + tier * 2, rr = p.r + 1 + hh / 2 + 1; c.items.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr, k: 'fuel', got: false, ph: 0, owner: p, tier, amt: [30, 55, 90][tier], rot: a + Math.PI / 2 }); }
  }
  // free-floating star trail
  if (r() < 0.6) { const x0 = cx * CH + r() * CH, y0 = cy * CH + r() * CH, a = r() * 6.28; for (let j = 0; j < 6; j++) c.items.push({ x: x0 + Math.cos(a) * j * 14, y: y0 + Math.sin(a) * j * 14, k: 'star', got: false, ph: j }); }
  c.items = c.items.filter(it => !c.planets.some(p => Math.hypot(it.x - p.x, it.y - p.y) < p.r + 4));
  rawChunks.set(key, c); return c;
}
function nearby(x, y, rad = 1) {
  const cx = Math.floor(x / CH), cy = Math.floor(y / CH), pl = [], it = [];
  for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) { const c = getChunk(cx + i, cy + j); pl.push(...c.planets); it.push(...c.items); }
  return { pl, it };
}

// ---------- planet sprites (pre-rendered pixel art) ----------
function planetSprite(p) {
  if (p.spr) return p.spr;
  const pad = p.rings ? p.r : 4, D = p.r * 2 + pad * 2, o = document.createElement('canvas'); o.width = o.height = D;
  const g = o.getContext('2d'), img = g.createImageData(D, D), d = img.data, r = rng(p.seed);
  const craters = []; // craters never overlap (rims included, +1px gap): retry, skip if no room
  for (let i = 0; i < 2 + p.r / 8; i++) for (let t = 0; t < 12; t++) {
    const c = [(r() - .5) * 1.6 * p.r, (r() - .5) * 1.6 * p.r, 2 + r() * p.r * .25];
    if (craters.every(q => Math.hypot(q[0] - c[0], q[1] - c[1]) >= q[2] + c[2] + 1)) { craters.push(c); break; }
  }
  const cols = p.t.c.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const bands = r() * 10, bf = 0.15 + r() * 0.3;
  const B = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const dx = x - D / 2 + .5, dy = y - D / 2 + .5, dd = Math.hypot(dx, dy), i = (y * D + x) * 4;
    if (dd <= p.r) {
      const nz = Math.sqrt(Math.max(0, 1 - (dd / p.r) ** 2));
      let l = (-dx * 0.55 - dy * 0.6) / p.r * 0.8 + nz * 0.7;
      l += Math.sin(dy * bf + bands + Math.sin(dx * 0.2) * 1.5) * 0.12;
      for (const [cx, cy, cr] of craters) { const q = Math.hypot(dx - cx, dy - cy); if (q < cr) l -= q < cr - 1.2 ? 0.22 : -0.12; }
      if (dd > p.r - 1.5) l -= 0.25;
      const v = Math.max(0, Math.min(3.99, l * 3.4 + (B[y & 3][x & 3] / 16 - .5)));
      const c = cols[v | 0]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // atmosphere dither ring
  // (fur ring is drawn live in drawFur so it can sway)
  p.spr = o; return o;
}
function furInit(p) { if (!p.fur) { const n = Math.ceil(6.283 * p.r); p.fur = new Float32Array(n); p.furV = new Float32Array(n); p.furAct = 0; } }
function furStep(p, dt) {
  if (!p.fur || p.furAct <= 0) return; p.furAct -= dt;
  for (let i = 0; i < p.fur.length; i++) { p.furV[i] += (-90 * p.fur[i] - 7 * p.furV[i]) * dt; p.fur[i] += p.furV[i] * dt; }
}
function drawFur(p, sx, sy) {
  furInit(p); ctx.fillStyle = p.t.atm; const n = p.fur.length, D = p.spr.width, cx = sx - (D >> 1) + D / 2, cy = sy - (D >> 1) + D / 2;
  for (let i = 0; i < n; i++) { const a = i / p.r, c = Math.cos(a), s = Math.sin(a);
    for (let k = 1; k <= 3; k++) if (i % (k + 1) === 0) { const b = p.fur[i] * k / 3; ctx.fillRect(Math.round(cx + c * (p.r + k) - s * b), Math.round(cy + s * (p.r + k) + c * b), 1, 1); } }
}
function ringSprite(p) {
  if (p.ringSpr) return p.ringSpr;
  const r = rng(p.seed ^ 0x5a5a), tilt = (r() - .5) * 0.7, k = 0.22 + r() * 0.12, R0 = p.r * 1.25, R1 = p.r * 1.9;
  const nb = 4 + (r() * 3 | 0), bands = []; for (let i = 0; i < nb; i++) bands.push(r() < 0.22 ? -1 : [1, 2, 3, 2][(r() * 4) | 0]); /* -1 = gap */
  const D = Math.ceil(R1 * 2 + 4), mk = () => { const o = document.createElement('canvas'); o.width = o.height = D; return o; };
  const back = mk(), front = mk(), gb = back.getContext('2d'), gf = front.getContext('2d'), ct = Math.cos(tilt), st = Math.sin(tilt), B = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const dx = x - D / 2 + .5, dy = y - D / 2 + .5, u = dx * ct + dy * st, v = -dx * st + dy * ct, e = Math.hypot(u, v / k);
    if (e < R0 || e >= R1) continue;
    const bi = Math.min(nb - 1, ((e - R0) / (R1 - R0) * nb) | 0), b = bands[bi]; if (b < 0) continue;
    const isFront = v > 0, inDisk = Math.hypot(dx, dy) <= p.r + 0.5;
    if (!isFront && inDisk) continue; /* far half hidden behind the planet */
    let c = b; if (!isFront && inDisk === false && Math.hypot(dx, dy) < p.r + 3) c = Math.max(0, c - 1); /* contact shade */
    if (isFront && u > 0 && inDisk) c = Math.max(0, c - 1); /* front over the planet's shaded side */
    if ((e - R0) % ((R1 - R0) / nb) < 1 && B[y & 3][x & 3] < 8) c = Math.max(0, c - 1); /* fine banding */
    const g = isFront ? gf : gb; g.fillStyle = p.t.c[c]; g.fillRect(x, y, 1, 1);
  }
  return p.ringSpr = { back, front, D };
}
function drawRings(p, sx, sy, front) {
  const rs = ringSprite(p); ctx.drawImage(front ? rs.front : rs.back, sx - (rs.D >> 1), sy - (rs.D >> 1));
}

// ---------- sprites ----------
const SPR = {
  run0: ['..WWW..','.WCCCW.','.WCCCW.','.WWWWW.','BWWWWWB','BWWWWW.','..WWW..','..W.W..','.WW..W.'],
  run1: ['..WWW..','.WCCCW.','.WCCCW.','.WWWWW.','BWWWWW.','BWWWWWW','..WWW..','.W..W..','.W...WW'],
  idle: ['..WWW..','.WCCCW.','.WCCCW.','.WWWWW.','BWWWWWB','BWWWWWB','..WWW..','..W.W..','..W.W..'],
  air:  ['..WWW..','.WCCCW.','.WCCCW.','.WWWWW.','BWWWWWW','BWWWWW.','..WWW..','.W...W.','W.....W'],
};
const SKINS = [ /* name, price, ability mults: jp jump, fm fuel cap, cx coins/pickup, dr fuel drain, rn run, th thrust, mg pickup radius, st stranded timer, cn fuel can, lo lost timer, tu turn, cp speed cap, sc star score */
  ['CLASSIC', 0, {}], ['JUMPER', 15, { jp: 1.25 }], ['MARATHONER', 120, { jp: 1.25, fm: 2 }], ['COIN HUNTER', 20, { cx: 2 }],
  ['SPRINTER', 25, { rn: 1.3 }], ['ECONOMY', 30, { dr: 0.75 }], ['ROCKET', 35, { th: 1.25 }], ['MAGNET', 30, { mg: 1.8 }],
  ['CAMPER', 15, { st: 2 }], ['TANK', 60, { fm: 1.5 }], ['SCAVENGER', 25, { cn: 1.5 }], ['DRIFTER', 20, { lo: 1.5 }],
  ['PILOT', 20, { tu: 1.4 }], ['SPEEDSTER', 45, { cp: 1.2 }], ['STAR SCORER', 25, { sc: 2 }], ['BUNNY', 40, { jp: 1.4, rn: 0.9 }],
  ['HOVER', 50, { dr: 0.5, th: 0.85 }], ['VETERAN', 70, { rn: 1.15, dr: 0.85 }], ['COLLECTOR', 80, { mg: 1.5, cn: 1.25 }], ['FEATHER', 35, { jp: 1.15, dr: 0.9 }],
  ['BOOSTER', 55, { th: 1.4, dr: 1.2 }], ['MINER', 45, { cn: 2 }], ['PROSPECTOR', 150, { cx: 3 }], ['GHOST', 40, { lo: 2 }],
  ['ACE', 40, { tu: 1.6, th: 1.1 }], ['RUNNER PRO', 60, { rn: 1.5 }], ['ACROBAT', 45, { tu: 1.8, jp: 1.1 }], ['NOMAD', 65, { st: 3, lo: 1.5 }],
  ['COMET', 90, { th: 1.3, cp: 1.3 }], ['LUCKY', 100, { cx: 2, mg: 1.3 }], ['TITAN', 160, { fm: 1.5, th: 1.2 }], ['SAGE', 110, { dr: 0.6, mg: 1.4 }],
  ['ASTRO KING', 200, { jp: 1.2, th: 1.2, dr: 0.8, cx: 2 }],
].map(([n, c, a], i) => { const h = (i * 137.5 + 20) % 360, vis = ['#5ee7ff', '#ffd35c', '#ff5577', '#7dff8a'][i % 4];
  return i ? { n, c, a, W: `hsl(${h},75%,${72 + i % 3 * 6}%)`, B: `hsl(${h},55%,${38 + i % 2 * 8}%)`, C: vis } : { n, c, a, W: P.suit, B: P.suit2, C: P.visor }; });
const AB_LBL = { jp: 'JUMP', fm: 'FUEL', cx: 'COIN', dr: 'DRAIN', rn: 'RUN', th: 'THRUST', mg: 'MAGNET', st: 'STRAND TIME', cn: 'CAN', lo: 'LOST TIME', tu: 'TURN', cp: 'TOP SPEED', sc: 'STAR SCORE' };
const abTxt = k => Object.entries(k.a).map(([q, v]) => AB_LBL[q] + ' X' + v).join('  ') || 'NO ABILITY';
const ab = q => SKINS[skin].a[q] || 1; const fuelCap = () => 100 * ab('fm');
/* per-character look: pixels in base-grid coords (body 7x9 at 0,0; may extend -3..9 x, -3..9 y). ch: W/B/C suit/shade/visor, D accent, G gold, R red, Y white, K dark, O orange, E green.
   ops: L:ch recolor legs, F:ch foot pixel under each leg, T:ch toe pixel in front, H hover disk (no legs), S ghost hem, V:ch visor */
const DEC = [
  '', // CLASSIC
  'L:K F:D 2,-1,D', // JUMPER: spring legs + spring antenna
  '1,0,R 2,0,R 3,0,R 4,0,R 5,0,R 0,0,R -1,1,R -2,1,R 3,5,Y', // MARATHONER: headband + streamers + bib
  'V:G 0,3,G -1,4,G -1,5,G 0,4,G 0,5,G -1,3,K', // COIN HUNTER: gold visor + coin sack
  '3,4,G 4,5,G V:R T:R', // SPRINTER: bolt + red runners
  '3,-1,E 4,-2,E 2,-2,E', // ECONOMY: leaf sprout
  '3,-1,R 3,-2,R 2,-1,R 4,-1,R -1,4,R -1,6,R -1,5,K', // ROCKET: nose cone + fins
  '2,-1,R 2,-2,Y 4,-1,R 4,-2,Y 3,-1,R', // MAGNET: horseshoe magnet
  '2,-1,D 3,-1,D 4,-1,D 3,-2,Y -1,3,D -1,4,D -1,5,D -1,6,D 0,3,D', // CAMPER: beanie + big pack
  '-1,4,B -1,5,B -1,3,B 7,4,K 0,3,K 6,3,K', // TANK: double tank + pauldron
  'V:K 1,1,K 5,1,K 1,3,R 2,3,R 3,3,R 4,3,R 5,3,R 0,3,R', // SCAVENGER: goggles + scarf
  '1,3,D 2,3,D 3,3,D 4,3,D 5,3,D 0,3,D -1,4,D -2,4,D -3,5,D', // DRIFTER: long scarf
  '1,0,D 2,0,D 3,0,D 4,0,D 5,0,D 1,1,D 2,-1,C 4,-1,C 3,-1,D', // PILOT: leather cap + goggles up
  '1,0,D 0,0,D -1,1,D 0,1,D -2,1,D V:Y', // SPEEDSTER: swept fin
  '3,-1,K 3,-2,G 2,-3,G 3,-3,G 4,-3,G 3,-4,G 3,5,G', // STAR SCORER: star antenna + chest star
  '2,-1,W 2,-2,W 2,-3,W 4,-1,W 4,-2,W 4,-3,W 2,-2,R 4,-2,R 0,6,Y', // BUNNY: ears + tail
  'H', // HOVER: hover disk
  '1,-1,D 2,-1,D 3,-1,D 4,-1,D 0,0,D 4,5,G 4,4,R', // VETERAN: beret + medal
  '0,2,K -1,1,K -2,0,Y -3,0,Y -2,-1,Y -3,-1,Y -1,0,Y', // COLLECTOR: butterfly net
  '5,-1,D 6,-2,D 6,-3,D 5,-2,Y 7,-4,D', // FEATHER: plume
  '-1,4,K -1,5,K -1,6,K -2,6,K 0,7,K', // BOOSTER: twin nozzles
  '1,0,G 2,0,G 3,0,G 4,0,G 5,0,G 2,-1,G 3,-1,G 4,-1,G 5,-1,Y 6,-1,Y', // MINER: hard hat + lamp
  '0,0,D 1,0,D 2,0,D 3,0,D 4,0,D 5,0,D 6,0,D 2,-1,D 3,-1,K 4,-1,D 2,-2,D 3,-2,D 4,-2,D', // PROSPECTOR: cowboy hat
  'S V:K', // GHOST: sheet hem, dark eyes
  '-1,3,Y -2,3,Y -2,4,Y -3,4,Y -1,4,Y', // ACE: wings
  '1,0,G 2,0,G 3,0,G 4,0,G 5,0,G T:R F:Y', // RUNNER PRO: sweatband + sneakers
  '0,3,R -1,4,R -1,5,R -1,6,R -2,7,R 0,4,R 0,5,R', // ACROBAT: cape
  '1,0,D 2,0,D 3,0,D 4,0,D 5,0,D 1,1,D 5,1,D 2,-1,D 3,-1,D 4,-1,D 1,2,D 5,2,D', // NOMAD: hood
  '1,0,O 0,0,O 0,1,G -1,0,G -2,1,O -3,1,G -1,1,O', // COMET: blazing tail
  '3,-1,E 2,-2,E 4,-2,E 3,-3,E 3,-2,K', // LUCKY: clover
  '0,3,K 6,3,K -1,4,K 7,4,K 1,-1,Y 5,-1,Y 1,-2,Y 5,-2,Y', // TITAN: horns + pads
  '1,0,D 2,0,D 3,0,D 4,0,D 5,0,D 2,-1,D 3,-1,G 4,-1,D 3,-2,D 4,-2,D 4,-3,D 5,-4,D', // SAGE: wizard hat
  '1,-1,G 2,-1,G 3,-1,R 4,-1,G 5,-1,G 1,-2,G 3,-2,G 5,-2,G 0,4,R 0,5,R 0,6,R -1,6,R -1,7,R 0,7,R', // ASTRO KING: crown + cape
];
const DECC = ['', '#c8c8d8', '', '', '', '', '', '', '#e0703a', '', '', '#ff9f3a', '#8a5a3a', '#ffffff', '', '', '', '#c83a5a', '', '#ff5577', '', '', '#a0703a', '', '', '', '', '#d8b880', '', '', '', '#5a3ac8', ''];
const XC = { G: '#ffd35c', R: '#ff5577', Y: '#ffffff', K: '#3a3060', O: '#ff9f3a', E: '#4fd86a' };
const sprCache = {};
function sprite(name, sk = skin) { /* 14x15 canvas; body at +4,+4 (draw at -7,-9; 2x/4x for UI) */
  const key = name + sk; if (sprCache[key]) return sprCache[key]; const SC = SKINS[sk], m = SPR[name];
  const gd = new Map(), put = (x, y, c) => gd.set(x + ',' + y, c), has = (x, y) => gd.has(x + ',' + y);
  for (let y = 0; y < m.length; y++) for (let x = 0; x < 7; x++) if (m[y][x] !== '.') put(x, y, m[y][x]);
  let vis = SC.C;
  for (const tk of DEC[sk].split(' ').filter(Boolean)) {
    if (tk[1] === ':') { const c = tk.slice(2);
      if (tk[0] === 'V') vis = XC[c] || c;
      else if (tk[0] === 'L') { for (const [k2] of gd) { const [x, y] = k2.split(',').map(Number); if (y >= 7) put(x, y, c); } }
      else for (let x = 0; x < 7; x++) { let yy = -1; for (let y = 7; y < 9; y++) if (has(x, y)) yy = y; if (yy < 0) continue;
        if (tk[0] === 'F') put(x, yy + 1, c); else if (tk[0] === 'T' && !has(x + 1, yy)) put(x + 1, yy, c); }
    } else if (tk === 'H' || tk === 'S') { for (let x = 0; x < 7; x++) for (let y = 7; y < 9; y++) gd.delete(x + ',' + y);
      const f = name === 'run1' ? 1 : 0;
      if (tk === 'H') { for (let x = 1; x < 6; x++) put(x, 7, 'K'); for (let x = 2 - f; x < 5 + f; x++) put(x, 8, 'C'); }
      else { for (let x = 1; x < 6; x++) put(x, 7, 'W'); for (let x = 1 + f; x < 6; x += 2) put(x, 8, 'W'); }
    } else { const [x, y, c] = tk.split(','); put(+x, +y, c); }
  }
  const o = document.createElement('canvas'); o.width = 14; o.height = 15; const g = o.getContext('2d');
  g.fillStyle = '#1a1040'; for (const [k2] of gd) { const [x, y] = k2.split(',').map(Number); g.fillRect(x + 3, y + 3, 3, 3); } // outline
  for (const [k2, c] of gd) { const [x, y] = k2.split(',').map(Number); g.fillStyle = c === 'C' ? vis : c === 'D' ? (DECC[sk] || SC.B) : SC[c] || XC[c]; g.fillRect(x + 4, y + 4, 1, 1); }
  if (gd.get('2,2') === 'C') { g.fillStyle = '#ffffff'; g.fillRect(6, 6, 1, 1); } // visor glint
  return sprCache[key] = o;
}

// ---------- audio (Web Audio sfx) ----------
let AC = null, sfxG = null, thrG = null;
function audioInit() {
  if (!AC) { try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); sfxG = AC.createGain(); sfxG.gain.value = 0.18; sfxG.connect(AC.destination);
    // looping thrust: filtered noise, gain toggled while thrusting
    const nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = nb; src.loop = true; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
    thrG = AC.createGain(); thrG.gain.value = 0; src.connect(f); f.connect(thrG); thrG.connect(sfxG); src.start();
    const bz = AC.createOscillator(), bg = AC.createGain(); bz.type = 'sawtooth'; bz.frequency.value = 62; bg.gain.value = 0.12; bz.connect(bg); bg.connect(thrG); bz.start(); /* low engine buzz */
  } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
}
function tone(type, f0, f1, dur, vol = 1, delay = 0) {
  if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(sfxG); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  jump: () => tone('square', 220, 520, 0.12, 0.5),
  coin: () => { tone('square', 988, 988, 0.06, 0.35); tone('square', 1319, 1319, 0.12, 0.35, 0.06); },
  fuel: () => { tone('triangle', 523, 523, 0.07, 0.6); tone('triangle', 659, 659, 0.07, 0.6, 0.07); tone('triangle', 784, 784, 0.12, 0.6, 0.14); },
  land: () => tone('triangle', 140, 50, 0.1, 0.7),
};
let thrusting = false;
function thrustSound(on) { if (thrG) thrG.gain.setTargetAtTime(on ? 0.5 : 0, AC.currentTime, 0.04); }

// ---------- input ----------
const keys = {};
let cheatBuf = '', cheat = false, cheatNext = false;
addEventListener('keydown', e => { audioInit(); if (/^[a-z]$/i.test(e.key)) { cheatBuf = (cheatBuf + e.key.toUpperCase()).slice(-7); if (cheatBuf === 'INFFUEL') { if (state === 'play') cheat = true; else cheatNext = true; cheatBuf = ''; } }
  keys[e.code] = true; idleT = 0; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); onAny(e.code); });
addEventListener('keyup', e => keys[e.code] = false);
const touch = { l: false, r: false, j: false, d: false };
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.getElementById('touch').style.display = 'block';
for (const [id, k] of [['tl','l'],['tr','r'],['tj','j'],['td','d']]) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); touch[k] = true; idleT = 0; onAny('touch'); });
  for (const ev of ['pointerup','pointerleave','pointercancel']) el.addEventListener(ev, () => touch[k] = false);
}
cv.addEventListener('pointerdown', e => { audioInit();
  if (state === 'title') { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if (titleClick(x, y)) return; }
  onAny('touch'); });
const U = () => keys.Space || keys.ArrowUp || keys.KeyW || touch.j, Dn = () => keys.ArrowDown || keys.KeyS || touch.d;
const L = () => keys.ArrowLeft || keys.KeyA || touch.l, R = () => keys.ArrowRight || keys.KeyD || touch.r, J = U; // Space == W everywhere

// ---------- state ----------
let state = 'title', pl, cam, parts, score, stars, best = 0, lostT, msgT, tTitle = 0, jumpHeld = false;
function reset() {
  SEED = (Math.random() * 1e6) | 0; chunks.clear();
  pl = { x: 0, y: 60 - 46 - 5, vx: 0, vy: 0, ground: null, ang: 0, face: 1, fuel: fuelCap(), anim: 0, coyote: 0 };
  cheat = cheatNext; cheatNext = false; // INFFUEL lasts one run
  cam = { x: 0, y: 0 }; parts = []; score = 0; stars = 0; lostT = 0; msgT = 0; maxD = 0; idleT = 0; landT = 0;
}
const HOME = { x: 0, y: 60, r: 46 }; // green home planet (chunk 0,0)
/* distance from the home planet's surface: standing/walking on it (player center at r+4.5) reads 0 */
const homeDist = () => Math.max(0, Math.hypot(pl.x - HOME.x, pl.y - HOME.y) - (HOME.r + 4.5));
let maxD = 0, idleT = 0, landT = 0, endMsg = '';
/* saves go to BOTH localStorage and cookies (file:// has no cookies in Chrome; some browsers clear one or the other); on load the most recently stamped store wins */
const LS = (() => { try { localStorage.setItem('sr_probe', '1'); return localStorage; } catch (e) { return null; } })();
const ckRaw = k => { const m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; };
const lsRaw = k => { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } };
const useLS = lsRaw('sr_t') !== null && +lsRaw('sr_t') >= +(ckRaw('sr_t') || 0);
const rawGet = k => { const a = useLS ? lsRaw(k) : ckRaw(k); return a !== null ? a : useLS ? ckRaw(k) : lsRaw(k); };
function getCk(k) { const v = rawGet(k); return v !== null && /^\d+$/.test(v) ? +v : 0; }
function setCk(k, v) { const t = Date.now(), ex = '; max-age=31536000; expires=' + new Date(t + 31536e6).toUTCString() + '; path=/; SameSite=Lax';
  try { document.cookie = k + '=' + v + ex; document.cookie = 'sr_t=' + t + ex; } catch (e) {}
  try { if (LS) { LS.setItem(k, '' + v); LS.setItem('sr_t', '' + t); } } catch (e) {} }
let bestStars = getCk('sr_stars'); best = getCk('sr_best');
const getCkS = k => { const v = rawGet(k); return v !== null && /^[01]+$/.test(v) ? v : null; };
let coins = getCk('sr_coins'), skin = getCk('sr_skin'), skSel = 0, own = getCkS('sr_own'), migRefund = 0;
if (own === null) { const old = getCk('sr_owned'); [0, 20, 40, 70, 120].forEach((c, i) => { if (i && old >> i & 1) migRefund += c; }); /* old MANGO/MINT/ROSE/GOLD: refund */ coins += migRefund; skin = 0; own = '1'; }
own = own.padEnd(SKINS.length, '0').split('').map(Number); own[0] = 1; if (!own[skin]) skin = 0; skSel = skin; /* global coin wallet (not a best) + skins */
const saveCoins = () => { setCk('sr_coins', coins); setCk('sr_own', own.join('')); setCk('sr_skin', skin); };
if (migRefund || getCk('sr_owned')) { saveCoins(); document.cookie = 'sr_owned=; max-age=0; path=/'; try { LS && LS.removeItem('sr_owned'); } catch (e) {} }
function skinBuy() { /* explicit BUY / EQUIP only; selecting never buys */
  const i = skSel, k = SKINS[i];
  if (!own[i]) { if (coins < k.c) return; coins -= k.c; own[i] = 1; skin = i; sfx.fuel(); } /* BUY also equips */
  else skin = i;
  saveCoins();
}
const saveBest = () => { if (cheat) return; best = Math.max(best, score); setCk('sr_best', best); };
function bumpBest() { if (!cheat && score > best) { best = score; setCk('sr_best', best); } }
addEventListener('pagehide', () => { saveBest(); saveCoins(); }); addEventListener('beforeunload', () => { saveBest(); saveCoins(); }); addEventListener('visibilitychange', () => { if (document.hidden) { saveBest(); saveCoins(); } });
function endGame(msg) {
  state = 'over'; msgT = 0; endMsg = msg;
  if (cheat) return; // INFFUEL run: best not saved
  best = Math.max(best, score); bestStars = Math.max(bestStars, stars);
  setCk('sr_best', best); setCk('sr_stars', bestStars);
}
reset();
function onAny(code) {
  if (state === 'title') { const n = SKINS.length, c = tLay().cols;
    if (code === 'KeyA' || code === 'ArrowLeft') { skSel = (skSel + n - 1) % n; return; }
    if (code === 'KeyD' || code === 'ArrowRight') { skSel = (skSel + 1) % n; return; }
    if (code === 'ArrowUp' || code === 'KeyW') { skSel = Math.max(0, skSel - c); return; }
    if (code === 'ArrowDown' || code === 'KeyS') { skSel = Math.min(n - 1, skSel + c); return; }
    if (code === 'Enter' || code === 'KeyB') { skinBuy(); return; } }
  if (state === 'title' && (code === 'Space' || code === 'touch')) { reset(); state = 'play'; jumpHeld = true; }
  else if (state === 'over' && msgT > 0.8 && (code === 'Space' || code === 'Enter' || code === 'touch')) { reset(); state = 'play'; jumpHeld = true; }
}
function puff(x, y, vx, vy, col, life, n = 1, spread = 20) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: vx + (Math.random() - .5) * spread, vy: vy + (Math.random() - .5) * spread, col, life, max: life }); }

// ---------- physics ----------
function step(dt) {
  if (cheat) pl.fuel = fuelCap();
  const { pl: planets, it } = nearby(pl.x, pl.y);
  let ax = 0, ay = 0, best = null, bestA = 0;
  for (const p of planets) {
    if (pl.ground && p !== pl.ground) continue; /* standing on a planet: other planets don't pull */
    const dx = p.x - pl.x, dy = p.y - pl.y, d = Math.hypot(dx, dy);
    if (d > p.range) continue;
    const fall = 1 - Math.max(0, (d - p.r * 2.2) / (p.range - p.r * 2.2)); // fade at edge
    const a = p.g * Math.min(1, (p.r / Math.max(d, p.r)) ** 1.2) * fall;
    ax += dx / d * a; ay += dy / d * a;
    if (a > bestA) { bestA = a; best = p; }
  }
  // "up" direction
  let ux = 0, uy = -1;
  if (best) { const d = Math.hypot(pl.x - best.x, pl.y - best.y); ux = (pl.x - best.x) / d; uy = (pl.y - best.y) / d; }
  const tx = -uy, ty = ux; // tangent (right)
  const inp = (R() ? 1 : 0) - (L() ? 1 : 0);
  if (inp && pl.ground) pl.face = inp;
  if (!pl.ground) pl.ang += inp * 3.2 * ab('tu') * dt; // A/D rotate heading in air
  const g = pl.ground;
  if (g) {
    // run along surface
    let vt = pl.vx * tx + pl.vy * ty;
    vt += ((inp * 95 * ab('rn')) - vt) * Math.min(1, dt * (inp ? 9 : 12));
    pl.vx = tx * vt; pl.vy = ty * vt;
    pl.anim += Math.abs(vt) * dt * 0.12;
    if (Math.abs(vt) > 5) { furInit(g); g.furAct = 3; const n = g.fur.length, i0 = Math.round(Math.atan2(pl.y - g.y, pl.x - g.x) / 6.283 * n);
      for (let d = -4; d <= 4; d++) { const i = ((i0 + d) % n + n) % n; g.furV[i] += vt * 0.9 * (1 - Math.abs(d) / 5) * dt * 10; } }
    if (Math.abs(vt) > 20 && Math.random() < 0.3) puff(pl.x - ux * 4, pl.y - uy * 4, -tx * vt * .2, -ty * vt * .2, g.t.c[2], 0.35, 1, 10);
  } else if (pl.fuel > 0 && pl.jetDelay <= 0 && (U() || Dn())) {
    // ship-style flight: W/S thrust along heading (pl.ang)
    const th = (U() ? 1 : 0) - (Dn() ? 0.55 : 0);
    if (th) {
      let fx = Math.sin(pl.ang) * Math.sign(th), fy = -Math.cos(pl.ang) * Math.sign(th); const acc = 560 * ab('th') * Math.abs(th); /* x2 with gravity */
      pl.vx += fx * acc * dt; pl.vy += fy * acc * dt;
      const damp = Math.exp(-1.6 * dt); pl.vx *= damp; pl.vy *= damp;
      pl.fuel = Math.max(0, pl.fuel - 22 * ab('dr') * dt); pl.flying = true;
      if (Math.random() < 0.9) puff(pl.x - fx * 6, pl.y - fy * 6, -fx * 80 + pl.vx * .5, -fy * 80 + pl.vy * .5, Math.random() < .5 ? P.gold : P.gold2, 0.3, 1, 25);
    }
  }
  // on the ground, only the radial part of gravity applies (other planets' pull used to slide you along the surface)
  if (g) { const gd = Math.hypot(pl.x - g.x, pl.y - g.y), gx = (pl.x - g.x) / gd, gy = (pl.y - g.y) / gd, an = ax * gx + ay * gy; ax = gx * an; ay = gy * an; }
  pl.vx += ax * dt; pl.vy += ay * dt;
  // jump / jetpack
  if (J()) {
    if (!jumpHeld && (g || pl.coyote > 0)) {
      const jv = 212 * (1 + (ab('jp') - 1) * 0.2); pl.vx += ux * jv; pl.vy += uy * jv; /* jump height ~x jp (gravity falls off with height, so speed scales gently) */ /* x sqrt2: same jump height under 2x gravity */ pl.ground = null; pl.coyote = 0; jumpHeld = true; sfx.jump();
      puff(pl.x - ux * 4, pl.y - uy * 4, 0, 0, '#ffffff', 0.4, 8, 50);
    }
  }
  if (!g && !pl.flying && Math.hypot(pl.vx, pl.vy) > 30 && Math.random() < 0.25) puff(pl.x, pl.y, -pl.vx * .1, -pl.vy * .1, P.suit2, 0.5, 1, 6);
  thrusting = !!pl.flying; pl.flying = false;
  if (cheat) pl.fuel = fuelCap();
  if (!J()) jumpHeld = false;
  if (pl.ground) pl.jetDelay = 0.18; else pl.jetDelay -= dt;
  pl.coyote -= dt;
  // speed cap in free space & drag
  const sp = Math.hypot(pl.vx, pl.vy); const cap = 320 * ab('cp'); if (sp > cap) { pl.vx *= cap / sp; pl.vy *= cap / sp; }
  pl.x += pl.vx * dt; pl.y += pl.vy * dt;
  // collisions
  const wasG = pl.ground; let impact = 0;
  pl.ground = null;
  for (const p of planets) {
    const dx = pl.x - p.x, dy = pl.y - p.y, d = Math.hypot(dx, dy), R0 = p.r + 4.5;
    if (d < R0) {
      const nx = dx / d, ny = dy / d; pl.x = p.x + nx * R0; pl.y = p.y + ny * R0;
      const vn = pl.vx * nx + pl.vy * ny; if (vn < impact) impact = vn;
      if (vn < 0) { if (vn < -90) puff(pl.x - nx * 4, pl.y - ny * 4, 0, 0, p.t.c[3], 0.5, 10, 60); pl.vx -= nx * vn; pl.vy -= ny * vn; }
      if (p === best || !best) { pl.ground = p; pl.coyote = 0.1; }
      else pl.ground = p;
    }
  }
  if (!wasG && pl.ground && impact < -40) sfx.land();
  // orientation
  const target = best ? Math.atan2(uy, ux) + Math.PI / 2 : pl.ang;
  let da = target - pl.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (pl.ground) pl.ang += da * Math.min(1, dt * 18);
  // pickups
  for (const o of it) if (!o.got && Math.hypot(o.x - pl.x, o.y - pl.y) < 9 * ab('mg')) {
    o.got = true;
    if (o.k === 'star') { stars++; score += 25 * ab('sc'); if (!cheat) { coins += ab('cx'); setCk('sr_coins', coins); } /* 1 coin per star; INFFUEL earns none */ sfx.coin(); puff(o.x, o.y, 0, 0, P.gold, 0.5, 10, 70); }
    else { pl.fuel = Math.min(fuelCap(), pl.fuel + o.amt * ab('cn')); sfx.fuel(); puff(o.x, o.y, 0, 0, P.cyan, 0.6, 8 + o.tier * 6, 60 + o.tier * 20); }
  }
  const D = homeDist() / 10; if (D > maxD) { score += Math.floor(D) - Math.floor(maxD); maxD = D; }
  bumpBest(); // persist best as soon as it changes
  // lost in space
  if (!best && pl.fuel <= 0) lostT += dt; else if (!best) lostT += dt * 0.35; else lostT = Math.max(0, lostT - dt * 2);
  if (L() || R() || J() || Dn()) idleT = 0; else idleT += dt;
  if (pl.ground) landT += dt; else landT = 0;
  const stranded = pl.ground && pl.fuel <= 0 && !it.some(o => o.k === 'fuel' && !o.got && o.owner === pl.ground);
  if (lostT > 6 * ab('lo')) endGame('LOST IN SPACE');
  else if (stranded && idleT >= 3 * ab('st') && landT >= 3) endGame('STRANDED');
  pl.best = best;
  for (const p of planets) furStep(p, dt);
  // particles
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; q.life -= dt; }
  parts = parts.filter(q => q.life > 0);
  // camera (lead in velocity direction)
  const lx = pl.x + pl.vx * 0.25, ly = pl.y + pl.vy * 0.25;
  cam.x += (lx - cam.x) * Math.min(1, dt * 5); cam.y += (ly - cam.y) * Math.min(1, dt * 5);
}
const best_ = () => best;

// ---------- render ----------
const STAR_COLS = ['#ffffff', '#ffe9b0', '#b8d8ff', '#ffb8d8', '#8a7fb8'];
function starfield(t, cx, cy) {
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.bg0); gr.addColorStop(1, P.bg1);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // nebula blobs (very far, dithered)
  for (const [f, cell, dens, sz] of [[0.12, 48, 0.6, 0], [0.3, 40, 0.5, 1], [0.6, 56, 0.35, 2]]) {
    const ox = cx * f, oy = cy * f, x0 = Math.floor((ox - W / 2) / cell), y0 = Math.floor((oy - H / 2) / cell);
    for (let i = x0; i <= x0 + W / cell + 1; i++) for (let j = y0; j <= y0 + H / cell + 1; j++) {
      const h = hash(i, j, (f * 1000) | 0);
      if (h > dens) continue;
      const sx = Math.round(i * cell + hash(i, j, 7) * cell - ox + W / 2), sy = Math.round(j * cell + hash(i, j, 9) * cell - oy + H / 2);
      if (f === 0.04) { // nebula
        const c = ['#2a1a5a', '#3a1a4a', '#1a2a5a'][(h * 3) | 0], R = 24 + h * 50; ctx.fillStyle = c;
        for (let yy = -R; yy < R; yy += 2) for (let xx = -R; xx < R; xx += 2) { const q = (xx * xx + yy * yy) / (R * R); if (q < 1 && hash(xx + i * 99, yy + j * 99, 3) > q * 1.1 + .1) ctx.fillRect(sx + xx + ((yy / 2) & 1), sy + yy, 1, 1); }
        continue;
      }
      const tw = Math.sin(t * (1 + h * 3) + h * 50) * 0.5 + 0.5;
      ctx.fillStyle = STAR_COLS[(hash(i, j, 5) * STAR_COLS.length) | 0];
      ctx.globalAlpha = 0.45 + tw * 0.55;
      ctx.fillRect(sx, sy, 1, 1);
      if (sz >= 1 && tw > 0.7) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
      if (sz === 2 && tw > 0.9) { ctx.fillRect(sx - 2, sy, 5, 1); ctx.fillRect(sx, sy - 2, 1, 5); }
      ctx.globalAlpha = 1;
    }
  }
}
function drawWorld(t) {
  // integer player->camera offset with hysteresis: no 1px back-and-forth
  const tx = pl.x - cam.x, ty = pl.y - cam.y;
  if (cam.offX === undefined || Math.abs(tx - cam.offX) > 0.9) cam.offX = Math.round(tx);
  if (cam.offY === undefined || Math.abs(ty - cam.offY) > 0.9) cam.offY = Math.round(ty);
  const ox = Math.round(pl.x) - cam.offX - (W >> 1), oy = Math.round(pl.y) - cam.offY - (H >> 1);
  const { pl: planets, it } = nearby(cam.x, cam.y, 1);
  for (const p of planets) {
    const sx = Math.round(p.x - ox), sy = Math.round(p.y - oy), s = planetSprite(p);
    if (sx < -s.width || sx > W + s.width || sy < -s.height || sy > H + s.height) continue;
    // gravity field hint
    ctx.fillStyle = p.t.atm + '22';
    for (let a = 0; a < 6.283; a += 6 / p.range) { if (((a * 40 + t * 4) | 0) % 6) continue; ctx.fillRect(Math.round(sx + Math.cos(a) * p.range), Math.round(sy + Math.sin(a) * p.range), 1, 1); }
    if (p.rings) drawRings(p, sx, sy, false);
    ctx.drawImage(s, sx - (s.width >> 1), sy - (s.height >> 1));
    drawFur(p, sx, sy);
    if (p.rings) drawRings(p, sx, sy, true);
  }
  for (const o of it) {
    if (o.got) continue;
    const sx = Math.round(o.x - ox), sy = Math.round(o.y - oy + Math.sin(t * 3 + o.ph) * 1.5);
    if (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5) continue;
    if (o.k === 'star') {
      const b = (Math.sin(t * 5 + o.ph) > 0.6);
      ctx.fillStyle = P.gold2; ctx.fillRect(sx - 1, sy - 2, 3, 5); ctx.fillRect(sx - 2, sy - 1, 5, 3);
      ctx.fillStyle = P.gold; ctx.fillRect(sx, sy - 2, 1, 5); ctx.fillRect(sx - 2, sy, 5, 1); ctx.fillRect(sx - 1, sy - 1, 3, 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1, 1);
      if (b) { ctx.fillStyle = '#fff8'; ctx.fillRect(sx, sy - 4, 1, 1); ctx.fillRect(sx, sy + 4, 1, 1); ctx.fillRect(sx - 4, sy, 1, 1); ctx.fillRect(sx + 4, sy, 1, 1); }
    } else {
      const w = 3 + o.tier * 2, h = 5 + o.tier * 2, x0 = -(w >> 1), y0 = -(h >> 1), sx = 0;
      ctx.save(); ctx.translate(Math.round(o.x - ox), Math.round(o.y - oy)); ctx.rotate(o.rot);
      ctx.fillStyle = '#1a1040'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      ctx.fillStyle = P.cyan; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, y0 - 2, 3, 1); ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3);
      ctx.fillStyle = '#2a6fb0'; for (let k = 0; k <= o.tier; k++) ctx.fillRect(x0, y0 + h - 2 - k * 2, w, 1);
      ctx.restore();
    }
  }
  for (const q of parts) { ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - ox), Math.round(q.y - oy), 1, 1); }
  ctx.globalAlpha = 1;
  // player
  if (state !== 'title') {
    const name = pl.ground ? (Math.hypot(pl.vx, pl.vy) > 10 ? ((pl.anim | 0) % 2 ? 'run1' : 'run0') : 'idle') : 'air';
    const s = sprite(name), sx = Math.round(pl.x - ox), sy = Math.round(pl.y - oy);
    const a = Math.round(pl.ang / (Math.PI / 16)) * (Math.PI / 16); // snap to 32 steps: crisper
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a); ctx.scale(pl.face, 1); ctx.drawImage(s, -7, -9); ctx.restore();
  }
  return { ox, oy };
}
function hud(t) {
  const Wc = '#ffffff';
  // FUEL bar
  textS('FUEL', 6, 6, Wc);
  ctx.fillStyle = cheat ? P.gold : Wc; ctx.fillRect(24, 6, 52, 1); ctx.fillRect(24, 10, 52, 1); ctx.fillRect(24, 6, 1, 5); ctx.fillRect(75, 6, 1, 5); ctx.fillRect(25, 7, Math.round(Math.min(100, pl.fuel) / 2), 3); if (pl.fuel > 100 && !cheat) { ctx.fillStyle = '#4aa8ff'; ctx.fillRect(25, 7, Math.round((pl.fuel - 100) / 2), 3); } /* extra capacity: blue over white; INFFUEL stays all yellow */
  ctx.fillStyle = cheat ? P.gold : Wc; ctx.fillRect(76, 7, 1, 3); // battery terminal nub (1 wide x 3 tall)
  // SCORE
  textS('SCORE ' + score, 6, 14, Wc);
  // HOME + hollow arrow (rotates around its own center)
  textS('COIN ' + coins, 6, 22, Wc);
  textS('HOME', 6, 30, Wc);
  const a = Math.atan2(HOME.y - pl.y, HOME.x - pl.x), cx = 29, cy = 32, ca = Math.cos(a), sa = Math.sin(a);
  // thin 1px '->' arrow: rotate endpoints about the arrow center, round, then Bresenham (always exactly 1px)
  ctx.fillStyle = Wc; const seen = new Set();
  const rot = (u, v) => [Math.round(u * ca - v * sa), Math.round(u * sa + v * ca)];
  const line = (u0, v0, u1, v1) => { let [x0, y0] = rot(u0, v0); const [x1, y1] = rot(u1, v1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (;;) { const key = x0 + ',' + y0; if (!seen.has(key)) { seen.add(key); ctx.fillRect(cx + x0, cy + y0, 1, 1); }
      if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } };
  line(-3, 0, 3, 0); line(3, 0, 2, -1); line(3, 0, 2, 1);
}
/* start screen: left = character grid, right = selected character panel, bottom-right START */
let hits = []; // clickable rects rebuilt every title frame
function tLay() {
  const pw = Math.max(96, Math.min(150, Math.floor(W * 0.36))), gx0 = 6, gx1 = W - pw - 8, gy0 = 26, gy1 = H - 14;
  const cw = 30, ch = 40, cols = Math.max(2, Math.floor((gx1 - gx0) / cw)), rows = Math.max(1, Math.floor((gy1 - gy0 - 10) / ch)), per = cols * rows;
  return { pw, px: W - pw - 4, gx0, gx1, gy0, cw, ch, cols, rows, per, pg: Math.floor(skSel / per), npg: Math.ceil(SKINS.length / per) };
}
function box(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
function btn(lbl, x, y, w, h, col, act) { box(x, y, w, h, col); textS(lbl, x + Math.floor(w / 2), y + Math.floor((h - 5) / 2), col, 1, true); hits.push({ x, y, w, h, act }); }
function titleClick(x, y) { for (const h of hits) if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.act(); return true; } return true; /* empty clicks never start/buy */ }
function title(t) {
  cam.x = t * 30; cam.y = Math.sin(t * .2) * 40; hits = [];
  const L = tLay(), WH = '#ffffff';
  ctx.fillStyle = '#0b0820c8'; ctx.fillRect(0, 0, W, H);
  // header: logo left, BEST / COIN right
  text('SPACE-RUNNER', 7, 7, '#1a1040', 2); text('SPACE-RUNNER', 6, 6, P.gold, 2);
  textS((best ? 'BEST ' + best + '  ' : '') + 'COIN ' + coins, W - 6 - ((best ? 'BEST ' + best + '  ' : '') + 'COIN ' + coins).length * 4 + 1, 8, P.gold);
  ctx.fillStyle = '#ffffff22'; ctx.fillRect(4, 21, W - 8, 1);
  // character grid
  for (let j = 0; j < L.per; j++) { const i = L.pg * L.per + j; if (i >= SKINS.length) break;
    const cx = L.gx0 + (j % L.cols) * L.cw, cy = L.gy0 + Math.floor(j / L.cols) * L.ch, k = SKINS[i], ow = own[i];
    ctx.drawImage(sprite('idle', i), cx + 1, cy + 1, 28, 30);
    if (i === skSel) box(cx, cy, L.cw - 1, L.ch - 2, WH);
    textS(i === skin ? 'ON' : ow ? 'OWN' : '' + k.c, cx + 15, cy + 31, i === skin ? WH : ow ? P.dim : coins >= k.c ? P.gold : P.red, 1, true);
    hits.push({ x: cx, y: cy, w: L.cw - 1, h: L.ch - 2, act: () => { skSel = i; } }); }
  if (L.npg > 1) { const yb = H - 22, mid = Math.floor((L.gx0 + L.gx1) / 2);
    textS((L.pg + 1) + '/' + L.npg, mid, yb + 3, P.dim, 1, true);
    btn('PREV', mid - 46, yb, 30, 11, WH, () => { skSel = ((L.pg + L.npg - 1) % L.npg) * L.per; });
    btn('NEXT', mid + 16, yb, 30, 11, WH, () => { skSel = Math.min(SKINS.length - 1, ((L.pg + 1) % L.npg) * L.per); }); }
  // right panel: selected character
  const px = L.px, pw = L.pw, k = SKINS[skSel], ow = own[skSel], mx = px + Math.floor(pw / 2);
  ctx.fillStyle = '#1a104088'; ctx.fillRect(px, 26, pw, H - 30); box(px, 26, pw, H - 30, '#ffffff44');
  const sc = H - 30 > 150 ? 4 : 3; ctx.drawImage(sprite(((t * 4 | 0) % 2) ? 'run0' : 'run1', skSel), mx - 7 * sc, 30, 14 * sc, 15 * sc);
  let y = 32 + 15 * sc;
  textS(k.n, mx, y, WH, 1, true); y += 9;
  textS(k.c ? 'PRICE ' + k.c + ' COIN' : 'FREE', mx, y, ow ? P.dim : coins >= k.c ? P.gold : P.red, 1, true); y += 11;
  const ent = Object.entries(k.a); if (!ent.length) { textS('NO ABILITY', mx, y, P.dim, 1, true); y += 8; }
  for (const [q, v] of ent) { textS(AB_LBL[q] + ' X' + v, mx, y, P.gold, 1, true); y += 8; }
  const bx = px + 6, bw = pw - 12, sy = H - 4 - 6 - 14; // buttons span the panel width; START sits on the panel's bottom inset
  const lbl = skSel === skin ? 'EQUIPPED' : ow ? 'EQUIP' : 'BUY ' + k.c, can = ow || coins >= k.c;
  btn(lbl, bx, sy - 6 - 11, bw, 11, skSel === skin ? P.dim : can ? WH : P.red, skinBuy);
  btn('START', bx, sy, bw, 14, (t * 2 | 0) % 2 ? WH : P.gold, () => { reset(); state = 'play'; jumpHeld = true; });
}
let last = performance.now(), acc = 0, T = 0;
function frame(now) {
  let dt = Math.min(0.1, (now - last) / 1000); last = now; T += dt;
  if (state === 'play') { acc += dt; while (acc > 1 / 120) { step(1 / 120); acc -= 1 / 120; } }
  else if (state === 'over') { msgT += dt; for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } }
  thrustSound(state === 'play' && thrusting);
  starfield(T, cam.x, cam.y);
  drawWorld(T);
  if (state === 'title') title(T);
  else {
    hud(T);
    if (state === 'over') {
      ctx.globalAlpha = 1; const pw = Math.min(W - 8, 200), px = Math.floor((W - pw) / 2), py = Math.floor(H / 2) - 42;
      ctx.fillStyle = '#1a1040'; ctx.fillRect(px - 1, py - 1, pw + 2, 74); ctx.fillStyle = '#0b0820'; ctx.fillRect(px, py, pw, 72);
      const textS = (a, b, c, d, e, f) => { text(a, b + e, c + e, '#000000', e, f); text(a, b, c, d, e, f); };
      textS(endMsg, W / 2, H / 2 - 34, P.red, 3, true);
      textS('SCORE ' + score, W / 2, H / 2 - 8, P.ink, 1, true);
      textS('BEST SCORE ' + best, W / 2, H / 2 + 4, P.gold, 1, true);
      textS('COIN ' + coins, W / 2, H / 2 + 12, P.ink, 1, true);
      if (msgT > 0.8 && (T * 2 | 0) % 2) textS('SPACE / TAP TO RESTART', W / 2, H / 2 + 20, P.ink, 1, true);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__sr = { cam: () => cam, homeDist: () => homeDist(), homeAng: () => Math.atan2(HOME.y - pl.y, HOME.x - pl.x), get cheat() { return cheat; }, get best() { return best; }, get AC() { return AC; }, get thrusting() { return thrusting; }, get nParts() { return parts.length; }, get suitParts() { return parts.filter(q => q.col === P.suit2).length; }, get thrGain() { return thrG && thrG.gain.value; }, get stars() { return stars; }, get maxD() { return maxD; }, get state() { return state; }, get landT() { return landT; }, get idleT() { return idleT; }, get endMsg() { return endMsg; }, get score() { return score; }, get coins() { return coins; }, get own() { return own.join(''); }, get skSel() { return skSel; }, get migRefund() { return migRefund; }, fuelCap, get skin() { return skin; }, get pl() { return pl; }, keys, nearby, sprite, get hits() { return hits; } };
})();
