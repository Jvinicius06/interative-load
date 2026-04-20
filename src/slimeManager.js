// Gerencia estado autoritativo das gosmas no servidor
const SLIME_COUNT      = 8;
const MAX_HP           = 3;
const TOUCH_COOLDOWN   = 2000; // ms entre explosões da mesma gosma

const state = Array.from({ length: SLIME_COUNT }, (_, i) => ({
  hp:        MAX_HP,
  lastTouch: 0,
  baseTx:    0,
  baseTy:    0,
}));

// Posições originais — devem ser iguais ao array SLIMES do client
const ORIG = [
  { baseTx: 4,  baseTy: 3  },
  { baseTx: 9,  baseTy: 2  },
  { baseTx: 14, baseTy: 6  },
  { baseTx: 6,  baseTy: 13 },
  { baseTx: 17, baseTy: 4  },
  { baseTx: 3,  baseTy: 9  },
  { baseTx: 13, baseTy: 15 },
  { baseTx: 10, baseTy: 10 },
];
ORIG.forEach((b, i) => { state[i].baseTx = b.baseTx; state[i].baseTy = b.baseTy; });

function _newBase(excludeIndex) {
  for (let tries = 0; tries < 20; tries++) {
    const bx = 2 + Math.floor(Math.random() * 16);
    const by = 2 + Math.floor(Math.random() * 16);
    const tooClose = state.some((s, i) => {
      if (i === excludeIndex) return false;
      return Math.hypot(s.baseTx - bx, s.baseTy - by) < 3;
    });
    if (!tooClose) return { baseTx: bx, baseTy: by };
  }
  return { baseTx: 2 + Math.floor(Math.random() * 16), baseTy: 2 + Math.floor(Math.random() * 16) };
}

function _doRespawn(index) {
  const s     = state[index];
  s.hp        = MAX_HP;
  const base  = _newBase(index);
  s.baseTx    = base.baseTx;
  s.baseTy    = base.baseTy;
  return base;
}

function shoot(index) {
  if (index < 0 || index >= SLIME_COUNT) return null;
  const s = state[index];
  if (s.hp <= 0) return null;
  s.hp -= 1;
  if (s.hp <= 0) {
    const base = _doRespawn(index);
    return { event: 'respawn', ...base };
  }
  return { event: 'damage', hp: s.hp };
}

function touch(index) {
  if (index < 0 || index >= SLIME_COUNT) return null;
  const s   = state[index];
  const now = Date.now();
  if (now - s.lastTouch < TOUCH_COOLDOWN) return null;
  s.lastTouch = now;
  const base  = _doRespawn(index);
  return { event: 'respawn', ...base };
}

function getState() {
  return state.map((s, i) => ({
    index: i, hp: s.hp, baseTx: s.baseTx, baseTy: s.baseTy,
  }));
}

module.exports = { shoot, touch, getState };
