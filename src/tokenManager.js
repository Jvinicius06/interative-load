const { v4: uuidv4 } = require('uuid');

const tokens = new Map();
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos

function createToken(identifier, nickname) {
  _cleanExpired();
  const token = uuidv4();
  tokens.set(token, { identifier, nickname, createdAt: Date.now() });
  return token;
}

function validateToken(token) {
  const data = tokens.get(token);
  if (!data) return null;
  if (Date.now() - data.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return null;
  }
  return data;
}

function invalidateToken(token) {
  tokens.delete(token);
}

function _cleanExpired() {
  const now = Date.now();
  for (const [t, d] of tokens) {
    if (now - d.createdAt > TOKEN_TTL_MS) tokens.delete(t);
  }
}

setInterval(_cleanExpired, 60_000);

module.exports = { createToken, validateToken, invalidateToken };
