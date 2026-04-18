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
const SPEED   = 0.07;
const SYNC_MS = 50;
const INTERP  = 0.22;

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

// ═══ GOSMAS (objetos estáticos) ═══════════════════════════════════════════════
const SLIMES = [
  { tx: 4,  ty: 3,  color: '#c8b020', sz: 14 },
  { tx: 9,  ty: 2,  color: '#3a9ac8', sz: 12 },
  { tx: 14, ty: 6,  color: '#5ec832', sz: 16 },
  { tx: 6,  ty: 13, color: '#9a32c8', sz: 13 },
  { tx: 17, ty: 4,  color: '#c83232', sz: 11 },
  { tx: 3,  ty: 9,  color: '#32c8a8', sz: 15 },
  { tx: 13, ty: 15, color: '#c86432', sz: 12 },
  { tx: 10, ty: 10, color: '#c832a0', sz: 10 },
];

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
let local      = null;
let remote     = new Map();
let keys       = {};
let animF      = 0;
let lastSync   = 0;
let serverName = 'SERVIDOR';
let chatBarOpen = false;

// ═══ INPUT ═══════════════════════════════════════════════════════════════════
window.addEventListener('keydown', (e) => {
  if (chatBarOpen) return; // chat input captures all keys
  if (e.key === 'Enter') { e.preventDefault(); openChatBar(); return; }
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

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

function drawSlimeOnTile(ox, oy, slime) {
  const { sx, sy } = toScreen(slime.tx + 0.5, slime.ty + 0.5);
  drawBlob(ox + sx, oy + sy - TILE_D, slime.color, slime.sz);
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

// ═══ UPDATE ══════════════════════════════════════════════════════════════════
function update(now) {
  if (!local) return;

  let dx = 0, dy = 0;
  if (!chatBarOpen) {
    if (keys['w'] || keys['W'] || keys['ArrowUp'])    { dx -= 1; dy -= 1; }
    if (keys['s'] || keys['S'] || keys['ArrowDown'])  { dx += 1; dy += 1; }
    if (keys['a'] || keys['A'] || keys['ArrowLeft'])  { dx -= 1; dy += 1; }
    if (keys['d'] || keys['D'] || keys['ArrowRight']) { dx += 1; dy -= 1; }
  }

  const moving = dx !== 0 || dy !== 0;
  local.moving = moving;

  if (moving) {
    const len = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
    local.wx = Math.max(1.0, Math.min(MAP_W - 1.5, local.wx + (dx / len) * SPEED));
    local.wy = Math.max(1.0, Math.min(MAP_H - 1.5, local.wy + (dy / len) * SPEED));
    animF++;

    if (now - lastSync > SYNC_MS) {
      lastSync = now;
      gameWS.send({ type: 'game_move', x: local.wx, y: local.wy });
    }
  }

  // Interpola posições remotas
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

  // ─── PASSO 1: todos os tiles + gosmas em ordem isométrica ───────────────────
  // Para terreno plano nunca há tile que deva cobrir um personagem —
  // fazer dois passes separados é a única forma de garantir isso.
  for (let row = 0; row < MAP_W + MAP_H - 1; row++) {
    const iMin = Math.max(0, row - MAP_H + 1);
    const iMax = Math.min(row, MAP_W - 1);

    for (let i = iMin; i <= iMax; i++) {
      const j = row - i;
      drawTile(ox, oy, i, j);

      for (const sl of SLIMES) {
        if (sl.tx === i && sl.ty === j) drawSlimeOnTile(ox, oy, sl);
      }
    }
  }

  // ─── PASSO 2: jogadores ordenados por profundidade (wx+wy crescente) ────────
  const renderList = [{ ref: local,  wx: local.wx, wy: local.wy, animF, isLocal: true }];
  for (const [, p] of remote) renderList.push({ ref: p, wx: p.wx, wy: p.wy, animF: p.animF || 0, isLocal: false });
  renderList.sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy));

  const nowMs = Date.now();
  for (const entry of renderList) {
    const p = entry.ref;
    const { sx, sy } = toScreen(entry.wx, entry.wy);
    const px = ox + sx;
    const py = oy + sy - TILE_D;
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
          color:    nickToColor(msg.nickname),
          wx: msg.gx ?? (MAP_W / 2),
          wy: msg.gy ?? (MAP_H / 2),
          moving: false,
          bubble: null,
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
