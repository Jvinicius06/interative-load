const room           = require('./roomManager');
const tokens         = require('./tokenManager');
const rl             = require('./rateLimiter');
const { randomNick } = require('./names');
const webhook        = require('./webhook');
const registry       = require('./playerRegistry');
const slimes         = require('./slimeManager');

const MAX_PAYLOAD  = 512;
const MAX_MSG      = 120;
const AUTH_TIMEOUT = 10_000;
const GAME_BOUNDS  = 20;

const kills = new Map(); // nickname → kill count

function _buildScoreboard() {
  const scores = [];
  for (const [nick, k] of kills) scores.push({ nickname: nick, kills: k });
  scores.sort((a, b) => b.kills - a.kills);
  return scores;
}

function _broadcastScoreboard() {
  room.broadcast({ type: 'game_scoreboard', scores: _buildScoreboard() });
}

const sanitize = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim();

function _realIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || 'desconhecido';
}

function handleConnection(ws, req) {
  ws._auth     = false;
  ws._clientIp = _realIp(req);
  ws._regEntry = registry.lookup(ws._clientIp); // identidade FiveM (pode ser null)

  const authTimer = setTimeout(() => {
    if (!ws._auth) ws.close(4001, 'Auth timeout');
  }, AUTH_TIMEOUT);

  ws.on('message', (raw) => {
    if (raw.length > MAX_PAYLOAD) { ws.close(4002, 'Payload too large'); return; }

    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!ws._auth) {
      if (msg.type === 'auth') _handleAuth(ws, msg, authTimer);
      return;
    }

    switch (msg.type) {
      case 'chat':               _handleChat(ws, msg);           break;
      case 'game_move':          _handleGameMove(ws, msg);       break;
      case 'game_request_state': _handleGameRequestState(ws);    break;
      case 'game_shoot':         _handleGameShoot(ws, msg);      break;
      case 'game_slime_touch':   _handleGameSlimeTouch(ws, msg); break;
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimer);
    const player = room.getPlayer(ws);
    if (player) {
      kills.delete(player.nickname);
      room.removePlayer(ws);
      rl.remove(ws);
      room.broadcast({ type: 'system',            message: `${player.nickname} saiu da sala` });
      room.broadcast({ type: 'player_count',      count: room.getCount() });
      room.broadcast({ type: 'game_player_leave', nickname: player.nickname });
      _broadcastScoreboard();
    }
  });

  ws.on('error', () => {});
}

function _handleAuth(ws, msg, timer) {
  const { token } = msg;
  let nick, identifier;

  if (!token) {
    nick       = randomNick();
    identifier = ws._regEntry?.identifier || 'anon';
  } else {
    const data = tokens.validateToken(token);
    if (!data) {
      room.sendTo(ws, { type: 'auth_error', message: 'Token inválido ou expirado' });
      ws.close(4004);
      return;
    }
    nick       = data.nickname;
    identifier = data.identifier;
  }

  clearTimeout(timer);

  if (!room.addPlayer(ws, nick, identifier)) {
    room.sendTo(ws, { type: 'auth_error', message: 'Sala cheia' });
    ws.close(4005);
    return;
  }

  ws._auth     = true;
  const player = room.getPlayer(ws);

  room.sendTo(ws, {
    type:        'auth_ok',
    nickname:    nick,
    playerCount: room.getCount(),
    gx:          player.gx,
    gy:          player.gy,
  });

  // Sincroniza estado das gosmas e placar para o novo jogador
  room.sendTo(ws, { type: 'game_slime_state', slimes: slimes.getState() });
  kills.set(nick, 0);
  room.sendTo(ws, { type: 'game_scoreboard', scores: _buildScoreboard() });
  _broadcastScoreboard();

  room.broadcast({ type: 'system',       message: `${nick} entrou na sala` }, ws);
  room.broadcast({ type: 'player_count', count: room.getCount() });

  // Announce new player's game position to others
  room.broadcast({ type: 'game_player_update', nickname: nick, x: player.gx, y: player.gy }, ws);
}

function _handleChat(ws, msg) {
  if (!rl.isAllowed(ws)) {
    room.sendTo(ws, { type: 'error', message: 'Aguarde antes de enviar outra mensagem' });
    return;
  }

  const raw = String(msg.message || '').slice(0, MAX_MSG);
  if (!raw.trim()) return;

  const player = room.getPlayer(ws);
  if (!player) return;

  const clean = sanitize(raw);

  room.broadcast({
    type:      'chat',
    nickname:  player.nickname,
    message:   clean,
    timestamp: Date.now(),
  });

  webhook.sendChatLog(player.nickname, player.identifier, ws._clientIp, clean);
}

function _handleGameMove(ws, msg) {
  const x = +msg.x, y = +msg.y;
  if (!isFinite(x) || !isFinite(y)) return;

  const cx = Math.max(0.5, Math.min(GAME_BOUNDS - 0.5, x));
  const cy = Math.max(0.5, Math.min(GAME_BOUNDS - 0.5, y));

  const player = room.getPlayer(ws);
  if (!player) return;

  player.gx = cx;
  player.gy = cy;

  room.broadcast({ type: 'game_player_update', nickname: player.nickname, x: cx, y: cy }, ws);
}

function _handleGameRequestState(ws) {
  const players = room.getAllGamePlayers();
  const player  = room.getPlayer(ws);
  const others  = player ? players.filter(p => p.nickname !== player.nickname) : players;
  room.sendTo(ws, { type: 'game_state', players: others });
}

function _handleGameShoot(ws, msg) {
  const idx = parseInt(msg.slimeIndex);
  if (!isFinite(idx) || idx < 0 || idx > 7) return;

  const result = slimes.shoot(idx);
  if (!result) return;

  if (result.event === 'damage') {
    room.broadcast({ type: 'game_slime_hp', slimeIndex: idx, hp: result.hp });
  } else {
    const player = room.getPlayer(ws);
    if (player) {
      kills.set(player.nickname, (kills.get(player.nickname) || 0) + 1);
      _broadcastScoreboard();
    }
    room.broadcast({ type: 'game_slime_respawn', slimeIndex: idx, baseTx: result.baseTx, baseTy: result.baseTy });
  }
}

function _handleGameSlimeTouch(ws, msg) {
  const idx = parseInt(msg.slimeIndex);
  if (!isFinite(idx) || idx < 0 || idx > 7) return;

  const result = slimes.touch(idx);
  if (!result) return;

  // Vítima perde 1 kill (mínimo 0)
  const player = room.getPlayer(ws);
  if (player) {
    kills.set(player.nickname, Math.max(0, (kills.get(player.nickname) || 0) - 1));
    _broadcastScoreboard();
  }

  room.broadcast({ type: 'game_slime_respawn', slimeIndex: idx, baseTx: result.baseTx, baseTy: result.baseTy });
}

module.exports = { handleConnection };
