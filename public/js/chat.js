const Chat = (() => {
  const el = {
    messages: document.getElementById('chat-messages'),
    input:    document.getElementById('chat-input'),
    sendBtn:  document.getElementById('chat-send'),
    counter:  document.getElementById('char-counter'),
  };

  const MAX        = 120;
  let canSend      = true;
  let cooldownTimer = null;

  function init() {
    el.input.addEventListener('input',   _onInput);
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
    });
    el.sendBtn.addEventListener('click', _send);
  }

  function _onInput() {
    const len = el.input.value.length;
    el.counter.textContent = `${len}/${MAX}`;
    el.counter.classList.toggle('warn', len > MAX * 0.85);
    if (len > MAX) el.input.value = el.input.value.slice(0, MAX);
  }

  function _send() {
    const text = el.input.value.trim();
    if (!text || !canSend) return;

    WS.send({ type: 'chat', message: text });

    el.input.value         = '';
    el.counter.textContent = `0/${MAX}`;
    _setCooldown(2100);
  }

  function _setCooldown(ms) {
    canSend               = false;
    el.sendBtn.disabled   = true;
    el.sendBtn.classList.add('cooldown');
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      canSend               = true;
      el.sendBtn.disabled   = false;
      el.sendBtn.classList.remove('cooldown');
    }, ms);
  }

  function addMessage({ nickname, message, timestamp }) {
    const time = new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const div  = document.createElement('div');
    div.className = 'msg';
    div.innerHTML =
      `<span class="msg-time">${time}</span>` +
      `<span class="msg-nick">${nickname}</span>` +
      `<span class="msg-sep">›</span>` +
      `<span class="msg-text">${message}</span>`;
    _append(div);
  }

  function addSystem(message) {
    const div = document.createElement('div');
    div.className = 'msg msg--system';
    div.innerHTML = `<span class="msg-system-icon">◆</span><span>${message}</span>`;
    _append(div);
  }

  function addError(message) {
    const div = document.createElement('div');
    div.className = 'msg msg--error';
    div.textContent = `⚠ ${message}`;
    _append(div);
  }

  function _append(node) {
    el.messages.appendChild(node);
    while (el.messages.children.length > 120) {
      el.messages.removeChild(el.messages.firstChild);
    }
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  return { init, addMessage, addSystem, addError };
})();
