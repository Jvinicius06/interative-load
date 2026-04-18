const limits = new Map(); // ws → { count, windowStart }
const MAX    = 1;
const WINDOW = 2000; // ms

const isAllowed = (ws) => {
  const now   = Date.now();
  const entry = limits.get(ws);

  if (!entry || now - entry.t >= WINDOW) {
    limits.set(ws, { count: 1, t: now });
    return true;
  }

  if (entry.count >= MAX) return false;
  entry.count++;
  return true;
};

const remove = (ws) => limits.delete(ws);

module.exports = { isAllowed, remove };
