const MAX   = 250;
const MAP_W = 20;
const MAP_H = 20;

const players = new Map(); // ws → { nickname, identifier, joinedAt, gx, gy }

const _spawnX = () => 1.5 + Math.random() * (MAP_W - 3);
const _spawnY = () => 1.5 + Math.random() * (MAP_H - 3);

const addPlayer = (ws, nickname, identifier) => {
  if (players.size >= MAX) return false;
  players.set(ws, {
    nickname,
    identifier,
    joinedAt: Date.now(),
    gx: _spawnX(),
    gy: _spawnY(),
  });
  return true;
};

const removePlayer = (ws) => players.delete(ws);
const getPlayer    = (ws) => players.get(ws);
const getCount     = ()   => players.size;

const broadcast = (message, excludeWs = null) => {
  const data = JSON.stringify(message);
  for (const [ws] of players) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
};

const sendTo = (ws, message) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
};

const getAllGamePlayers = () => {
  const list = [];
  for (const [, p] of players) list.push({ nickname: p.nickname, x: p.gx, y: p.gy });
  return list;
};

module.exports = { addPlayer, removePlayer, getPlayer, getCount, broadcast, sendTo, getAllGamePlayers };
