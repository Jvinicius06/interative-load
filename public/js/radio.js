const Radio = (() => {
  let stations     = [];
  let currentIndex = 0;
  let playing      = false;

  const audio = new Audio();
  audio.preload = 'none';

  const el = {
    name:     document.getElementById('radio-name'),
    genre:    document.getElementById('radio-genre'),
    playBtn:  document.getElementById('radio-play'),
    prevBtn:  document.getElementById('radio-prev'),
    nextBtn:  document.getElementById('radio-next'),
    volume:   document.getElementById('radio-volume'),
    volValue: document.getElementById('vol-value'),
    bars:     document.querySelectorAll('.eq-bar'),
    list:     document.getElementById('station-list'),
    status:   document.getElementById('radio-status'),
  };

  function init(data) {
    stations = data;
    if (!stations.length) return;
    _renderList();
    _loadStation(0);
    _bindEvents();
  }

  function _renderList() {
    el.list.innerHTML = stations
      .map((s, i) =>
        `<button class="station-item${i === 0 ? ' active' : ''}" data-i="${i}">
          <span class="station-name">${s.name}</span>
          <span class="station-genre">${s.genre}</span>
        </button>`)
      .join('');

    el.list.addEventListener('click', (e) => {
      const btn = e.target.closest('.station-item');
      if (btn) _selectStation(parseInt(btn.dataset.i, 10));
    });
  }

  function _loadStation(i) {
    const s = stations[i];
    if (!s) return;
    currentIndex         = i;
    el.name.textContent  = s.name;
    el.genre.textContent = s.genre;

    el.list.querySelectorAll('.station-item').forEach((b, j) => {
      b.classList.toggle('active', j === i);
    });

    if (playing) {
      audio.src = s.url;
      audio.play().catch(() => _setStatus('Erro ao carregar stream'));
    }
  }

  function _selectStation(i) {
    _loadStation(i);
    if (!playing) _toggle();
  }

  function _toggle() {
    if (playing) {
      audio.pause();
      audio.src = '';
      playing             = false;
      el.playBtn.textContent = '▶';
      el.playBtn.setAttribute('aria-label', 'Play');
      _setAnimating(false);
      _setStatus('Pausado');
    } else {
      const s = stations[currentIndex];
      if (!s) return;
      audio.src = s.url;
      _setStatus('Conectando...');
      audio.play()
        .then(() => {
          playing                = true;
          el.playBtn.textContent = '⏸';
          el.playBtn.setAttribute('aria-label', 'Pause');
          _setAnimating(true);
          _setStatus('Ao vivo');
        })
        .catch(() => {
          _setStatus('Erro ao reproduzir');
          playing = false;
        });
    }
  }

  function _setAnimating(on) {
    el.bars.forEach((b) => b.classList.toggle('active', on));
  }

  function _setStatus(text) {
    if (el.status) el.status.textContent = text;
  }

  function _bindEvents() {
    el.playBtn.addEventListener('click', _toggle);
    el.prevBtn.addEventListener('click', () => _loadStation((currentIndex - 1 + stations.length) % stations.length));
    el.nextBtn.addEventListener('click', () => _loadStation((currentIndex + 1) % stations.length));

    el.volume.addEventListener('input', (e) => {
      audio.volume = e.target.value / 100;
      if (el.volValue) el.volValue.textContent = e.target.value;
    });

    audio.addEventListener('error',   () => _setStatus('Erro no stream'));
    audio.addEventListener('waiting', () => _setStatus('Bufferizando...'));
    audio.addEventListener('playing', () => _setStatus('Ao vivo'));
  }

  return { init };
})();
