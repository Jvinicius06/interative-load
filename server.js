require('dotenv').config();

const express  = require('express');
const http     = require('http');
const path     = require('path');
const { WebSocketServer } = require('ws');

const wsHandler    = require('./src/wsHandler');
const tokenManager = require('./src/tokenManager');
const room         = require('./src/roomManager');
const config       = require('./config/config');
const { randomNick }  = require('./src/names');
const webhook         = require('./src/webhook');
const playerRegistry  = require('./src/playerRegistry');

const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.SERVER_SECRET || '';

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, maxPayload: 1024 });

app.set('trust proxy', true); // lê X-Forwarded-For do Traefik
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rotas HTTP ────────────────────────────────────────────────────────────────

// FiveM (server-side Lua) chama este endpoint para gerar um token para o player
app.post('/api/token', (req, res) => {
  if (SECRET && req.headers['x-server-secret'] !== SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { identifier } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ error: 'identifier é obrigatório' });
  }

  const nick  = randomNick();
  const token = tokenManager.createToken(String(identifier), nick);

  res.json({ token });
});

// FiveM (server.lua) registra entrada do jogador para log de moderação
app.post('/api/player-log', (req, res) => {
  if (SECRET && req.headers['x-server-secret'] !== SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { fivemName, identifier, ip } = req.body || {};
  if (!identifier || !ip) return res.status(400).json({ error: 'identifier e ip são obrigatórios' });

  const cleanIp   = String(ip).slice(0, 45);
  const cleanId   = String(identifier).slice(0, 64);
  const cleanName = String(fivemName || 'Desconhecido').slice(0, 64);

  playerRegistry.register(cleanIp, cleanId, cleanName);
  webhook.sendConnectionLog(cleanName, cleanId, cleanIp);

  res.json({ ok: true });
});

// Frontend busca configurações (estações de rádio, slides da TV)
app.get('/api/config', (req, res) => {
  res.json({
    serverName:    config.serverName,
    radioStations: config.radioStations,
    tvSlides:      config.tvSlides,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', players: room.getCount(), uptime: Math.floor(process.uptime()) });
});

// ─── WebSocket ─────────────────────────────────────────────────────────────────

wss.on('connection', (ws, req) => wsHandler.handleConnection(ws, req));

// ─── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[WaitingRoom] Rodando em http://localhost:${PORT}`);
  console.log(`[WaitingRoom] DEV_MODE = ${process.env.DEV_MODE || 'false'}`);
  console.log(`[WaitingRoom] Servidor: ${config.serverName}`);
});
