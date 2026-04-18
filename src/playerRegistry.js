// Mapeamento temporário IP → dados do jogador FiveM
// Preenchido pelo /api/player-log (Lua) antes da WS conectar
const TTL = 5 * 60 * 1000; // 5 minutos

const registry = new Map();

function normalizeIp(ip) {
  return String(ip || '').replace(/^::ffff:/, '').trim();
}

function register(ip, identifier, fivemName) {
  registry.set(normalizeIp(ip), {
    identifier,
    fivemName,
    expires: Date.now() + TTL,
  });
}

function lookup(ip) {
  const key   = normalizeIp(ip);
  const entry = registry.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { registry.delete(key); return null; }
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of registry) if (now > v.expires) registry.delete(k);
}, 60_000);

module.exports = { register, lookup, normalizeIp };
