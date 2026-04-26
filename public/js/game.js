// game.js — Sala de espera isométrica para FiveM
//
// REGRAS DE ARTE (FiveM/CEF roda em CPU):
//   Proibido: globalAlpha, shadowBlur, shadowColor, gradientes no canvas
//   Permitido: fillRect, beginPath/fill, quadraticCurveTo — apenas cores sólidas

// ═══ CONSTANTES ══════════════════════════════════════════════════════════════
const TILE_W  = 64;
const TILE_H  = 32;
const TILE_D  = 12;
const TW2     = TILE_W / 2;
const TH2     = TILE_H / 2;
const MAP_W   = 20;
const MAP_H   = 20;
const SPEED          = 0.07;
const SYNC_MS        = 50;
const INTERP         = 0.22;
const SLIME_RADIUS   = 0.65; // distância de colisão em tiles
const KNOCKBACK      = 0.38; // impulso inicial
const FRICTION       = 0.80; // decay de velocidade por frame
const KNOCKBACK_CD   = 700;  // ms de cooldown após cada arremesso

const SLIME_MAX_HP   = 3;
const SLIME_SPEED    = 0.014; // tiles/frame (≈ 20 % da velocidade do jogador)
const BALL_SPEED     = 0.18;  // tiles/frame
const BALL_MAX_AGE   = 90;    // frames antes de sumir
const BALL_HIT_R     = 0.72;  // raio de hit em tiles
const EXPL_FRAMES    = 26;    // duração da animação de explosão
const SHOOT_CD       = 350;   // ms entre tiros

// ═══ TILES ═══════════════════════════════════════════════════════════════════
const T = { SAND: 0, DARK: 1, ROCK: 2 };

const TILE_COL = {
  [T.SAND]: { top: '#c8a85a', r: '#a88838', l: '#b89848' },
  [T.DARK]: { top: '#b09040', r: '#906828', l: '#a07830' },
  [T.ROCK]: { top: '#8a7a5e', r: '#6a5a3e', l: '#7a6a4e' },
};

// ═══ MAPA (seed fixo — igual para todos os jogadores) ════════════════════════
function makeMap() {
  let seed = 0xdeadbeef;
  const rng = () => {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };
  const m = [];
  for (let x = 0; x < MAP_W; x++) {
    m[x] = [];
    for (let y = 0; y < MAP_H; y++) {
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) {
        m[x][y] = T.ROCK;
      } else {
        const r = rng();
        m[x][y] = r < 0.55 ? T.SAND : r < 0.82 ? T.DARK : T.ROCK;
      }
    }
  }
  return m;
}

const MAP = makeMap();

// ═══ GOSMAS (móveis, sincronizadas por tempo determinístico) ══════════════════
// baseTx/baseTy = centro do território; freq/phase garantem movimentos únicos
const SLIMES = [
  { baseTx: 4,  baseTy: 3,  color: '#c8b020', sz: 14 },
  { baseTx: 9,  baseTy: 2,  color: '#3a9ac8', sz: 12 },
  { baseTx: 14, baseTy: 6,  color: '#5ec832', sz: 16 },
  { baseTx: 6,  baseTy: 13, color: '#9a32c8', sz: 13 },
  { baseTx: 17, baseTy: 4,  color: '#c83232', sz: 11 },
  { baseTx: 3,  baseTy: 9,  color: '#32c8a8', sz: 15 },
  { baseTx: 13, baseTy: 15, color: '#c86432', sz: 12 },
  { baseTx: 10, baseTy: 10, color: '#c832a0', sz: 10 },
].map((s, i) => ({
  ...s,
  hp:    SLIME_MAX_HP,
  wx:    s.baseTx + 0.5,   // posição atual (atualizada a cada frame)
  wy:    s.baseTy + 0.5,
  freq:  0.00048 + i * 0.000022,
  phase: i * (Math.PI * 2 / 8),
}));

// Retorna a posição atual da gosma (atualizada via IA no update)
function getSlimePos(sl) {
  return { wx: sl.wx, wy: sl.wy };
}

// ═══ CORES DOS JOGADORES ═════════════════════════════════════════════════════
const PALETTE = [
  '#e84848', '#4898e8', '#48d848', '#e8c838',
  '#e848b0', '#48e8c8', '#e88038', '#9848e8',
];

function nickToColor(name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function darken(hex, f = 0.62) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const h = n => Math.max(0, Math.round(n * f)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// ═══ CANVAS ══════════════════════════════════════════════════════════════════
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ═══ PROJEÇÃO ════════════════════════════════════════════════════════════════
function toScreen(wx, wy) {
  return { sx: (wx - wy) * TW2, sy: (wx + wy) * TH2 };
}

// ═══ ESTADO ══════════════════════════════════════════════════════════════════
let local        = null;
let remote       = new Map();
let keys         = {};
let animF        = 0;
let lastSync     = 0;
let serverName   = 'SERVIDOR';
let chatBarOpen  = false;
let powerBalls   = [];  // { wx, wy, vx, vy, age }
let explosions   = [];  // { wx, wy, frame, maxF }
let lastShot     = 0;
let scoreboard   = [];  // [{ nickname, kills }] ordenado por kills desc

// ═══ INPUT ═══════════════════════════════════════════════════════════════════
window.addEventListener('keydown', (e) => {
  if (chatBarOpen) return;
  if (e.key === 'Enter') { e.preventDefault(); openChatBar(); return; }
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// Clique → atirar bola de poder
canvas.style.cursor        = 'crosshair';
canvas.style.pointerEvents = 'auto'; // o canvas estava com pointer-events:none no CSS
canvas.addEventListener('click', (e) => {
  if (!local || chatBarOpen) return;
  const now = Date.now();
  if (now - lastShot < SHOOT_CD) return;
  lastShot = now;

  // Converte clique para coordenadas de mundo (projeção isométrica inversa)
  const { sx: psx, sy: psy } = toScreen(local.wx, local.wy);
  const ox = canvas.width  / 2 - psx;
  const oy = canvas.height / 2 - psy;
  const a  = (e.clientX - ox) / TW2;
  const b  = (e.clientY - oy) / TH2;
  const tw = (a + b) / 2;
  const ty = (b - a) / 2;

  const ddx = tw - local.wx;
  const ddy = ty - local.wy;
  const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
  if (len < 0.3) return;

  const vx = (ddx / len) * BALL_SPEED;
  const vy = (ddy / len) * BALL_SPEED;
  powerBalls.push({
    wx: local.wx, wy: local.wy,
    vx, vy,
    age: 0,
    ownerNick: local.nickname,
  });
  gameWS.send({ type: 'game_ball_spawn', wx: local.wx, wy: local.wy, vx, vy });
});

// ═══ DESENHO: TILE ════════════════════════════════════════════════════════════
function drawTile(ox, oy, tx, ty) {
  const { sx, sy } = toScreen(tx, ty);
  const x = ox + sx;
  const y = oy + sy;

  if (x < -TILE_W || x > canvas.width + TILE_W ||
      y < -(TILE_H + TILE_D) || y > canvas.height + TILE_H + TILE_D) return;

  const col = TILE_COL[MAP[tx][ty]];

  ctx.fillStyle = col.top;
  ctx.beginPath();
  ctx.moveTo(x,       y - TH2);
  ctx.lineTo(x + TW2, y);
  ctx.lineTo(x,       y + TH2);
  ctx.lineTo(x - TW2, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = col.r;
  ctx.beginPath();
  ctx.moveTo(x + TW2, y);
  ctx.lineTo(x + TW2, y + TILE_D);
  ctx.lineTo(x,       y + TH2 + TILE_D);
  ctx.lineTo(x,       y + TH2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = col.l;
  ctx.beginPath();
  ctx.moveTo(x - TW2, y);
  ctx.lineTo(x - TW2, y + TILE_D);
  ctx.lineTo(x,       y + TH2 + TILE_D);
  ctx.lineTo(x,       y + TH2);
  ctx.closePath();
  ctx.fill();
}

// ═══ DESENHO: GOSMA ══════════════════════════════════════════════════════════
function drawBlob(cx, cy, color, sz) {
  const pts = [
    [cx,           cy - sz],
    [cx + sz*0.88, cy - sz*0.42],
    [cx + sz*1.12, cy + sz*0.28],
    [cx + sz*0.72, cy + sz*0.82],
    [cx,           cy + sz*0.64],
    [cx - sz*0.72, cy + sz*0.82],
    [cx - sz*1.12, cy + sz*0.28],
    [cx - sz*0.88, cy - sz*0.42],
  ];

  ctx.fillStyle = color;
  ctx.beginPath();
  const m0 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const n = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();

  const dk = darken(color, 0.58);
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.moveTo(cx - sz*0.35, cy + sz*0.60);
  ctx.lineTo(cx - sz*0.12, cy + sz*0.60);
  ctx.lineTo(cx - sz*0.23, cy + sz*1.06);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + sz*0.12, cy + sz*0.62);
  ctx.lineTo(cx + sz*0.38, cy + sz*0.62);
  ctx.lineTo(cx + sz*0.22, cy + sz*1.13);
  ctx.closePath();
  ctx.fill();

  const ew = Math.max(2, Math.floor(sz * 0.22));
  const eh = Math.max(2, Math.floor(sz * 0.30));
  const ex1 = Math.round(cx - sz * 0.37);
  const ex2 = Math.round(cx + sz * 0.15);
  const ey  = Math.round(cy - sz * 0.10);

  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(ex1, ey, ew, eh);
  ctx.fillRect(ex2, ey, ew, eh);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ex1, ey, Math.max(1, ew >> 1), Math.max(1, eh >> 1));
  ctx.fillRect(ex2, ey, Math.max(1, ew >> 1), Math.max(1, eh >> 1));

  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(Math.round(cx - sz*0.20), Math.round(cy + sz*0.22),
               Math.round(sz * 0.40), Math.max(1, Math.round(sz * 0.09)));
}


// ═══ DESENHO: PERSONAGEM ══════════════════════════════════════════════════════
function drawChar(x, y, color, nickname, frame, moving, isLocal) {
  const bx = Math.round(x);
  const by = Math.round(y);
  const leg = moving ? Math.round(Math.sin(frame * 0.22) * 4) : 0;

  // Pernas
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(bx - 5, by + 6, 4, 10 + Math.max(0, leg));
  ctx.fillRect(bx + 1,  by + 6, 4, 10 - Math.min(0, leg));

  // Corpo
  ctx.fillStyle = color;
  ctx.fillRect(bx - 7, by - 4, 14, 12);

  // Cinto
  ctx.fillStyle = darken(color, 0.52);
  ctx.fillRect(bx - 7, by + 5, 14, 2);

  // Cabeça
  ctx.fillStyle = '#f5c88a';
  ctx.fillRect(bx - 6, by - 16, 12, 13);

  // Cabelo
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(bx - 6, by - 16, 12, 4);

  // Olhos
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx - 4, by - 11, 3, 2);
  ctx.fillRect(bx + 1,  by - 11, 3, 2);

  // Boca
  ctx.fillStyle = '#c07050';
  ctx.fillRect(bx - 2, by - 6, 4, 1);

  // Seta acima do jogador local
  if (isLocal) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 1, by - 24, 2, 5);
    ctx.fillRect(bx - 3, by - 24, 6, 2);
  }

  // Nome (painel sólido)
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(nickname).width;
  ctx.fillStyle = '#08080f';
  ctx.fillRect(Math.round(bx - tw / 2 - 4), by - 38, Math.round(tw + 8), 14);
  ctx.fillStyle = isLocal ? '#00e8ff' : '#ccdde8';
  ctx.fillText(nickname, bx, by - 27);
}

// ═══ DESENHO: BALÃO DE FALA ══════════════════════════════════════════════════
function drawBubble(x, y, text, isTyping) {
  const bx = Math.round(x);
  const by = Math.round(y);

  const MAX_CH = 26;
  let display = String(text);
  if (display.length > MAX_CH) display = display.slice(0, MAX_CH - 1) + '…';

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const tw = Math.ceil(ctx.measureText(display).width);

  const padX   = 7;
  const bw     = tw + padX * 2;
  const bh     = 16;
  const tailH  = 7;

  // Balloon sits above the nametag (nametag top ≈ by - 38)
  const tailTipY   = by - 44;
  const boxBottomY = tailTipY - tailH;
  const boxTopY    = boxBottomY - bh;
  const boxLeftX   = Math.round(bx - bw / 2);

  const borderCol = isTyping ? '#2a5a6a' : '#00e8ff';
  const bgCol     = '#0a0a14';
  const textCol   = isTyping ? '#3a7080' : '#deeef8';

  // Border
  ctx.fillStyle = borderCol;
  ctx.fillRect(boxLeftX - 1, boxTopY - 1, bw + 2, bh + 2);

  // Background
  ctx.fillStyle = bgCol;
  ctx.fillRect(boxLeftX, boxTopY, bw, bh);

  // Tail (solid, border color)
  ctx.fillStyle = borderCol;
  ctx.beginPath();
  ctx.moveTo(bx - 5, boxBottomY);
  ctx.lineTo(bx + 5, boxBottomY);
  ctx.lineTo(bx,     tailTipY);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.fillStyle = textCol;
  ctx.fillText(display, bx, boxBottomY - 5);
}

// ═══ DESENHO: BARRA DE HP DA GOSMA ════════════════════════════════════════════
function drawSlimeHP(cx, cy, sz, hp) {
  const bw = 8, bh = 4, gap = 2;
  const totalW = SLIME_MAX_HP * (bw + gap) - gap;
  let bx = Math.round(cx - totalW / 2);
  const by = Math.round(cy - sz - 16);
  for (let i = 0; i < SLIME_MAX_HP; i++) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = i < hp ? '#48e848' : '#2a2a2a';
    ctx.fillRect(bx, by, bw, bh);
    bx += bw + gap;
  }
}

// ═══ DESENHO: BOLA DE PODER ═══════════════════════════════════════════════════
function drawBall(cx, cy) {
  const rx = Math.round(cx), ry = Math.round(cy);
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.arc(rx, ry, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffdd00';
  ctx.beginPath();
  ctx.arc(rx, ry, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rx - 1, ry - 2, 2, 2);
}

// ═══ DESENHO: PLACAR ══════════════════════════════════════════════════════════
function drawScoreboard() {
  if (!scoreboard.length) return;

  const MAX_ROWS = Math.min(scoreboard.length, 10);
  const ROW_H    = 15;
  const PAD_X    = 8;
  const PAD_Y    = 6;
  const W        = 170;
  const TITLE_H  = 16;
  const H        = PAD_Y * 2 + TITLE_H + MAX_ROWS * ROW_H + 2;
  const rx       = canvas.width - 12;  // direita
  const ry       = 12;                  // topo

  // Borda
  ctx.fillStyle = '#1e3a4a';
  ctx.fillRect(rx - W - 1, ry - 1, W + 2, H + 2);

  // Fundo
  ctx.fillStyle = '#08080f';
  ctx.fillRect(rx - W, ry, W, H);

  // Título
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdd00';
  ctx.fillText('SLIMES MORTOS', rx - W / 2, ry + PAD_Y + 9);

  // Separador
  ctx.fillStyle = '#1e3a4a';
  ctx.fillRect(rx - W + PAD_X, ry + PAD_Y + TITLE_H, W - PAD_X * 2, 1);

  // Linhas
  ctx.font = '10px monospace';
  for (let i = 0; i < MAX_ROWS; i++) {
    const s    = scoreboard[i];
    const ly   = ry + PAD_Y + TITLE_H + 4 + i * ROW_H;
    const self = local && s.nickname === local.nickname;

    // Destaque do jogador local
    if (self) {
      ctx.fillStyle = '#0a1a2a';
      ctx.fillRect(rx - W + 2, ly, W - 4, ROW_H - 1);
    }

    // Posição
    ctx.fillStyle = i === 0 ? '#ffdd00' : '#506070';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}.`, rx - W + PAD_X, ly + 10);

    // Nome
    ctx.fillStyle = self ? '#00e8ff' : '#c8d8e0';
    ctx.fillText(s.nickname, rx - W + PAD_X + 18, ly + 10);

    // Kills
    ctx.textAlign = 'right';
    ctx.fillStyle = s.kills > 0 ? '#48e848' : '#3a5040';
    ctx.fillText(String(s.kills), rx - PAD_X, ly + 10);
  }
}

// ═══ DESENHO: EXPLOSÃO ════════════════════════════════════════════════════════
function drawExplosion(cx, cy, frame, maxF) {
  const progress = frame / maxF;
  const r   = progress * 40;
  const sz  = Math.max(1, Math.round(8 * (1 - progress)));
  const COL = ['#ffee00', '#ff9900', '#ff4400', '#ff2020'];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const ex = Math.round(cx + Math.cos(angle) * r);
    const ey = Math.round(cy + Math.sin(angle) * r);
    ctx.fillStyle = COL[i % COL.length];
    ctx.fillRect(ex - sz, ey - sz, sz * 2, sz * 2);
  }
  // Núcleo piscando
  if (frame < maxF * 0.4) {
    ctx.fillStyle = '#ffffff';
    const cs = Math.round(6 * (1 - progress / 0.4));
    ctx.fillRect(Math.round(cx) - cs, Math.round(cy) - cs, cs * 2, cs * 2);
  }
}

// ═══ UPDATE ══════════════════════════════════════════════════════════════════
function update(now) {
  if (!local) return;

  const t = Date.now();

  // ── Aplica knockback (velocidade decai por fricção) ──────────────────────────
  if (local.vx !== 0 || local.vy !== 0) {
    local.wx = Math.max(1.0, Math.min(MAP_W - 1.5, local.wx + local.vx));
    local.wy = Math.max(1.0, Math.min(MAP_H - 1.5, local.wy + local.vy));
    local.vx *= FRICTION;
    local.vy *= FRICTION;
    if (Math.abs(local.vx) < 0.001) local.vx = 0;
    if (Math.abs(local.vy) < 0.001) local.vy = 0;
    local.moving = true;
    animF++;
  }

  // ── Movimento do jogador ─────────────────────────────────────────────────────
  let dx = 0, dy = 0;
  if (!chatBarOpen) {
    if (keys['w'] || keys['W'] || keys['ArrowUp'])    { dx -= 1; dy -= 1; }
    if (keys['s'] || keys['S'] || keys['ArrowDown'])  { dx += 1; dy += 1; }
    if (keys['a'] || keys['A'] || keys['ArrowLeft'])  { dx -= 1; dy += 1; }
    if (keys['d'] || keys['D'] || keys['ArrowRight']) { dx += 1; dy -= 1; }
  }

  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const len = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
    local.wx = Math.max(1.0, Math.min(MAP_W - 1.5, local.wx + (dx / len) * SPEED));
    local.wy = Math.max(1.0, Math.min(MAP_H - 1.5, local.wy + (dy / len) * SPEED));
    local.moving = true;
    animF++;
  } else if (local.vx === 0 && local.vy === 0) {
    local.moving = false;
  }

  if (local.moving && now - lastSync > SYNC_MS) {
    lastSync = now;
    gameWS.send({ type: 'game_move', x: local.wx, y: local.wy });
  }

  // ── Colisão com gosmas (explosão + knockback) ────────────────────────────────
  if (t > local.knockbackUntil) {
    for (let i = 0; i < SLIMES.length; i++) {
      const sl  = SLIMES[i];
      const sp  = getSlimePos(sl);
      const dx2 = local.wx - sp.wx;
      const dy2 = local.wy - sp.wy;
      const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist < SLIME_RADIUS) {
        const len = dist < 0.01 ? 0.01 : dist;
        local.vx += (dx2 / len) * KNOCKBACK;
        local.vy += (dy2 / len) * KNOCKBACK;
        local.knockbackUntil = t + KNOCKBACK_CD;
        // Explosion visual local imediata (o server confirmará o respawn)
        explosions.push({ wx: sp.wx, wy: sp.wy, frame: 0, maxF: EXPL_FRAMES });
        gameWS.send({ type: 'game_slime_touch', slimeIndex: i });
        break;
      }
    }
  }

  // ── IA das gosmas: perseguição ao jogador mais próximo ──────────────────────
  for (const sl of SLIMES) {
    let nearDist = Infinity, nearWx = sl.wx, nearWy = sl.wy;
    if (local) {
      const d = Math.hypot(local.wx - sl.wx, local.wy - sl.wy);
      if (d < nearDist) { nearDist = d; nearWx = local.wx; nearWy = local.wy; }
    }
    for (const [, p] of remote) {
      const d = Math.hypot(p.wx - sl.wx, p.wy - sl.wy);
      if (d < nearDist) { nearDist = d; nearWx = p.wx; nearWy = p.wy; }
    }
    if (nearDist > 0.05) {
      sl.wx += ((nearWx - sl.wx) / nearDist) * SLIME_SPEED;
      sl.wy += ((nearWy - sl.wy) / nearDist) * SLIME_SPEED;
      sl.wx  = Math.max(0.5, Math.min(MAP_W - 0.5, sl.wx));
      sl.wy  = Math.max(0.5, Math.min(MAP_H - 0.5, sl.wy));
    }
  }

  // ── Bolas de poder ───────────────────────────────────────────────────────────
  const nowT = Date.now();
  const alive = [];
  for (const b of powerBalls) {
    b.wx += b.vx;
    b.wy += b.vy;
    b.age++;
    if (b.age >= BALL_MAX_AGE || b.wx < 0.5 || b.wx > MAP_W - 0.5 ||
                                  b.wy < 0.5 || b.wy > MAP_H - 0.5) continue;
    let hit = false;
    for (let i = 0; i < SLIMES.length; i++) {
      const sp = getSlimePos(SLIMES[i]);
      if (Math.hypot(b.wx - sp.wx, b.wy - sp.wy) < BALL_HIT_R) {
        explosions.push({ wx: sp.wx, wy: sp.wy, frame: 0, maxF: Math.round(EXPL_FRAMES * 0.6) });
        if (b.ownerNick === local.nickname) gameWS.send({ type: 'game_shoot', slimeIndex: i });
        hit = true;
        break;
      }
    }
    if (!hit) alive.push(b);
  }
  powerBalls = alive;

  // ── Explosões (animação) ─────────────────────────────────────────────────────
  explosions = explosions.filter(e => { e.frame++; return e.frame < e.maxF; });

  // ── Interpola posições remotas ───────────────────────────────────────────────
  for (const [, p] of remote) {
    const ddx = p.tx - p.wx;
    const ddy = p.ty - p.wy;
    if (Math.abs(ddx) > 0.001 || Math.abs(ddy) > 0.001) {
      p.wx += ddx * INTERP;
      p.wy += ddy * INTERP;
      p.moving = true;
      p.animF  = (p.animF || 0) + 1;
    } else {
      p.moving = false;
    }
  }
}

// ═══ RENDER ═══════════════════════════════════════════════════════════════════
function render() {
  const W = canvas.width;
  const H = canvas.height;

  // Fundo vem do CSS do body (#281408) — canvas é transparente fora dos tiles
  ctx.clearRect(0, 0, W, H);

  if (!local) {
    ctx.fillStyle = '#c8a850';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Conectando...', W / 2, H / 2);
    return;
  }

  const { sx: psx, sy: psy } = toScreen(local.wx, local.wy);
  const ox = Math.round(W / 2 - psx);
  const oy = Math.round(H / 2 - psy);

  // ─── PASSO 1: tiles apenas ───────────────────────────────────────────────────
  for (let row = 0; row < MAP_W + MAP_H - 1; row++) {
    const iMin = Math.max(0, row - MAP_H + 1);
    const iMax = Math.min(row, MAP_W - 1);
    for (let i = iMin; i <= iMax; i++) drawTile(ox, oy, i, row - i);
  }

  // ─── PASSO 2: gosmas + jogadores ordenados por profundidade (wx+wy) ──────────
  const nowMs = Date.now();
  const renderList = [];

  for (let i = 0; i < SLIMES.length; i++) {
    const sl  = SLIMES[i];
    const pos = getSlimePos(sl, nowMs);
    renderList.push({ kind: 'slime', sl, idx: i, wx: pos.wx, wy: pos.wy });
  }
  renderList.push({ kind: 'player', ref: local, wx: local.wx, wy: local.wy, animF, isLocal: true });
  for (const [, p] of remote) renderList.push({ kind: 'player', ref: p, wx: p.wx, wy: p.wy, animF: p.animF || 0, isLocal: false });

  renderList.sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy));

  for (const entry of renderList) {
    const { sx, sy } = toScreen(entry.wx, entry.wy);
    const px = ox + sx;
    const py = oy + sy - TILE_D;

    if (entry.kind === 'slime') {
      drawBlob(px, py, entry.sl.color, entry.sl.sz);
      drawSlimeHP(px, py, entry.sl.sz, entry.sl.hp);
    } else {
      const p = entry.ref;
      drawChar(px, py, p.color, p.nickname, entry.animF, p.moving || false, entry.isLocal);
      if (p.bubble) {
        if (nowMs - p.bubble.born > 6000 && !p.bubble.typing) {
          p.bubble = null;
        } else {
          drawBubble(px, py, p.bubble.text, p.bubble.typing || false);
        }
      }
    }
  }

  // ─── PASSO 3: bolas de poder ─────────────────────────────────────────────────
  for (const b of powerBalls) {
    const { sx, sy } = toScreen(b.wx, b.wy);
    drawBall(ox + sx, oy + sy - TILE_D);
  }

  // ─── PASSO 4: explosões ───────────────────────────────────────────────────────
  for (const expl of explosions) {
    const { sx, sy } = toScreen(expl.wx, expl.wy);
    drawExplosion(ox + sx, oy + sy - TILE_D, expl.frame, expl.maxF);
  }

  // ─── PASSO 5: placar ─────────────────────────────────────────────────────────
  drawScoreboard();
}

function gameLoop(now) {
  update(now);
  render();
  requestAnimationFrame(gameLoop);
}

// ═══ HUD DOM ═════════════════════════════════════════════════════════════════
function updateHUD() {
  const elServer = document.getElementById('hud-server');
  const elInfo   = document.getElementById('hud-info');
  if (elServer) elServer.textContent = `[ ${serverName} ]`;
  if (elInfo && local) {
    elInfo.textContent = `${1 + remote.size} ONLINE  •  ${local.nickname}`;
  }
}

// ═══ CHAT BALLOON ═════════════════════════════════════════════════════════════
const chatBar   = document.getElementById('chat-bar');
const chatInput = document.getElementById('chat-input');
let chatCooldown = false;
let chatTimer    = null;

function openChatBar() {
  if (chatCooldown) return;
  chatBarOpen = true;
  chatBar.classList.add('open');
  chatInput.value = '';
  chatInput.focus();
  if (local) local.bubble = { text: '...', born: Date.now(), typing: true };
}

function closeChatBar(clearBubble) {
  chatBarOpen = false;
  chatBar.classList.remove('open');
  chatInput.blur();
  keys = {}; // clear held keys so character doesn't keep walking
  if (clearBubble && local && local.bubble?.typing) local.bubble = null;
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) { closeChatBar(true); return; }
  gameWS.send({ type: 'chat', message: text });
  if (local) local.bubble = { text, born: Date.now(), typing: false };
  closeChatBar(false);
  chatCooldown = true;
  clearTimeout(chatTimer);
  chatTimer = setTimeout(() => { chatCooldown = false; }, 2100);
}

chatInput.addEventListener('input', () => {
  if (!local || !chatBarOpen) return;
  const text = chatInput.value;
  local.bubble = { text: text || '...', born: Date.now(), typing: true };
});

chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter')  { e.preventDefault(); sendChat(); }
  if (e.key === 'Escape') { closeChatBar(true); }
});


// ═══ WEBSOCKET ════════════════════════════════════════════════════════════════
const gameWS = (() => {
  let socket  = null;
  let retries = 0;
  const MAX   = 5;

  function connect() {
    const p     = new URLSearchParams(window.location.search);
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}`);

    socket.addEventListener('open', () => {
      retries = 0;
      socket.send(JSON.stringify({
        type:  'auth',
        token: p.get('token') || '',
      }));
    });

    socket.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      handle(msg);
    });

    socket.addEventListener('close', (ev) => {
      if ([4001, 4003, 4004, 4005].includes(ev.code)) return;
      if (retries++ < MAX) setTimeout(connect, 3000);
    });

    socket.addEventListener('error', () => {});
  }

  function handle(msg) {
    switch (msg.type) {
      case 'auth_ok':
        local = {
          nickname: msg.nickname,
          color:           nickToColor(msg.nickname),
          wx: msg.gx ?? (MAP_W / 2),
          wy: msg.gy ?? (MAP_H / 2),
          moving: false,
          bubble: null,
          vx: 0, vy: 0,
          knockbackUntil: 0,
        };
        socket.send(JSON.stringify({ type: 'game_request_state' }));
        updateHUD();
        break;

      case 'game_state':
        for (const p of msg.players) {
          if (p.nickname === local?.nickname) continue;
          remote.set(p.nickname, {
            nickname: p.nickname, color: nickToColor(p.nickname),
            wx: p.x, wy: p.y, tx: p.x, ty: p.y, moving: false, animF: 0, bubble: null,
          });
        }
        updateHUD();
        break;

      case 'game_player_update': {
        if (msg.nickname === local?.nickname) break;
        const ex = remote.get(msg.nickname);
        if (ex) {
          ex.tx = msg.x; ex.ty = msg.y;
        } else {
          remote.set(msg.nickname, {
            nickname: msg.nickname, color: nickToColor(msg.nickname),
            wx: msg.x, wy: msg.y, tx: msg.x, ty: msg.y, moving: false, animF: 0, bubble: null,
          });
          updateHUD();
        }
        break;
      }

      case 'game_player_leave':
        remote.delete(msg.nickname);
        updateHUD();
        break;

      case 'chat': {
        // Local player bubble is set directly on send; only update remotes here
        if (msg.nickname !== local?.nickname) {
          const sender = remote.get(msg.nickname);
          if (sender) sender.bubble = { text: msg.message, born: Date.now(), typing: false };
        }
        break;
      }

      case 'system':
      case 'player_count':
        updateHUD();
        break;

      case 'game_scoreboard':
        scoreboard = msg.scores || [];
        break;

      case 'game_ball_spawn':
        if (msg.ownerNick === local?.nickname) break;
        powerBalls.push({
          wx: +msg.wx, wy: +msg.wy,
          vx: +msg.vx, vy: +msg.vy,
          age: 0,
          ownerNick: msg.ownerNick,
        });
        break;

      case 'game_slime_state':
        for (const s of msg.slimes) {
          const sl = SLIMES[s.index];
          if (!sl) continue;
          sl.hp     = s.hp;
          sl.baseTx = s.baseTx;
          sl.baseTy = s.baseTy;
          sl.wx     = s.baseTx + 0.5;
          sl.wy     = s.baseTy + 0.5;
        }
        break;

      case 'game_slime_hp': {
        const sl = SLIMES[msg.slimeIndex];
        if (sl) sl.hp = msg.hp;
        break;
      }

      case 'game_slime_respawn': {
        const sl = SLIMES[msg.slimeIndex];
        if (!sl) break;
        explosions.push({ wx: sl.wx, wy: sl.wy, frame: 0, maxF: EXPL_FRAMES });
        sl.hp     = SLIME_MAX_HP;
        sl.baseTx = msg.baseTx;
        sl.baseTy = msg.baseTy;
        sl.wx     = msg.baseTx + 0.5;
        sl.wy     = msg.baseTy + 0.5;
        break;
      }

      case 'error':
        break;
    }
  }

  function send(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  return { connect, send };
})();

// ═══ BOOT ════════════════════════════════════════════════════════════════════
(async () => {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    serverName = cfg.serverName || 'SERVIDOR';
    document.getElementById('hud-server').textContent = `[ ${serverName} ]`;
  } catch {}

  gameWS.connect();
  requestAnimationFrame(gameLoop);
})();
