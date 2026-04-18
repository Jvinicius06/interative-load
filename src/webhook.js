const https = require('https');
const http  = require('http');

const WEBHOOK_URL  = process.env.DISCORD_WEBHOOK_URL || '';
const FLUSH_MS     = 3000; // intervalo de envio (3s — Discord: max 30 req/min)
const MAX_EMBEDS   = 10;   // Discord aceita até 10 embeds por mensagem

const queue = [];

// ─── Fila ─────────────────────────────────────────────────────────────────────

function sendChatLog(nickname, identifier, ip, message) {
  if (!WEBHOOK_URL) return;
  queue.push({
    color:       0x00e8ff,
    author:      { name: `💬  ${nickname}` },
    description: `\`\`\`${message}\`\`\``,
    fields: [
      { name: 'Identifier', value: identifier, inline: true },
      { name: 'IP',         value: ip,         inline: true },
    ],
    timestamp: new Date().toISOString(),
  });
}

function sendConnectionLog(fivemName, identifier, ip) {
  if (!WEBHOOK_URL) return;
  queue.push({
    color:  0x48d848,
    author: { name: `🔗  ${fivemName}` },
    fields: [
      { name: 'Identifier', value: identifier, inline: true },
      { name: 'IP',         value: ip,         inline: true },
    ],
    footer:    { text: 'Entrou na sala de espera' },
    timestamp: new Date().toISOString(),
  });
}

// ─── Flush em lote ────────────────────────────────────────────────────────────

function _flush() {
  if (!WEBHOOK_URL || queue.length === 0) return;

  // Envia em grupos de MAX_EMBEDS para não estourar o limite do Discord
  while (queue.length > 0) {
    const batch = queue.splice(0, MAX_EMBEDS);
    _post(JSON.stringify({ embeds: batch }));
  }
}

setInterval(_flush, FLUSH_MS);

// ─── HTTP ─────────────────────────────────────────────────────────────────────

function _post(payload) {
  let url;
  try { url = new URL(WEBHOOK_URL); } catch { return; }

  const lib     = url.protocol === 'https:' ? https : http;
  const options = {
    hostname: url.hostname,
    path:     url.pathname + url.search,
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = lib.request(options);
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

module.exports = { sendChatLog, sendConnectionLog };
