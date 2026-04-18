// ─── WebSocket client ──────────────────────────────────────────────────────────
const WS = (() => {
  let socket       = null;
  const MAX_RETRY  = 5;
  const RETRY_MS   = 3000;
  let retries      = 0;

  function _params() {
    const p = new URLSearchParams(window.location.search);
    return {
      token:    p.get('token') || '',
      nickname: p.get('nick') || p.get('nickname') || `Player_${Math.floor(Math.random() * 9999)}`,
    };
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}`);

    socket.addEventListener('open', () => {
      retries = 0;
      const { token, nickname } = _params();
      socket.send(JSON.stringify({ type: 'auth', token, nickname }));
    });

    socket.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      _handle(msg);
    });

    socket.addEventListener('close', (e) => {
      // Falhas de auth não reconectam
      if ([4001, 4003, 4004, 4005].includes(e.code)) {
        UI.setStatus('Falha na autenticação', 'error');
        return;
      }
      if (retries < MAX_RETRY) {
        retries++;
        UI.setStatus(`Reconectando... (${retries}/${MAX_RETRY})`, 'warn');
        setTimeout(connect, RETRY_MS);
      } else {
        UI.setStatus('Conexão perdida', 'error');
      }
    });

    socket.addEventListener('error', () => {});
  }

  function _handle(msg) {
    switch (msg.type) {
      case 'auth_ok':
        UI.setNickname(msg.nickname);
        UI.setPlayerCount(msg.playerCount);
        UI.setStatus('Conectado', 'ok');
        Chat.addSystem(`Bem-vindo, ${msg.nickname}!`);
        break;
      case 'auth_error':
        UI.setStatus(msg.message, 'error');
        break;
      case 'chat':
        Chat.addMessage(msg);
        break;
      case 'system':
        Chat.addSystem(msg.message);
        break;
      case 'player_count':
        UI.setPlayerCount(msg.count);
        break;
      case 'error':
        Chat.addError(msg.message);
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

// ─── UI state ─────────────────────────────────────────────────────────────────
const UI = (() => {
  const el = {
    playerCount: document.getElementById('player-count'),
    nickname:    document.getElementById('player-nickname'),
    statusDot:   document.getElementById('status-dot'),
    statusText:  document.getElementById('status-text'),
    clock:       document.getElementById('clock'),
    serverName:  document.getElementById('server-name'),
  };

  function setPlayerCount(n)  { if (el.playerCount) el.playerCount.textContent = n; }
  function setNickname(name)  { if (el.nickname)    el.nickname.textContent = name; }

  function setStatus(text, type = 'ok') {
    if (el.statusText) el.statusText.textContent = text;
    if (el.statusDot)  {
      el.statusDot.className = `status-dot status-dot--${type}`;
    }
  }

  function _updateClock() {
    if (el.clock) {
      el.clock.textContent = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
  }

  function init() {
    setInterval(_updateClock, 1000);
    _updateClock();
  }

  return { init, setPlayerCount, setNickname, setStatus };
})();

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  UI.init();
  Chat.init();

  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    if (cfg.serverName && UI.el) {
      document.getElementById('server-name').textContent = cfg.serverName;
    }
    TV.init(cfg.tvSlides    || []);
    Radio.init(cfg.radioStations || []);
  } catch {
    TV.init([{
      id: 1, title: 'AGUARDANDO', subtitle: 'Conectando ao servidor...',
      body: '', tag: 'INFO', accent: '#00e8ff',
    }]);
    Radio.init([]);
  }

  WS.connect();
});
