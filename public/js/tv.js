const TV = (() => {
  let slides       = [];
  let currentIndex = 0;
  let timer        = null;
  const INTERVAL   = 12_000;

  const el = {
    tag:      document.getElementById('tv-tag'),
    title:    document.getElementById('tv-title'),
    subtitle: document.getElementById('tv-subtitle'),
    body:     document.getElementById('tv-body'),
    dots:     document.getElementById('tv-dots'),
    panel:    document.getElementById('tv-panel'),
    counter:  document.getElementById('tv-counter'),
  };

  function init(data) {
    slides = data;
    _renderDots();
    _showSlide(0);
    _startTimer();
  }

  function _renderDots() {
    el.dots.innerHTML = slides
      .map((_, i) => `<button class="tv-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`)
      .join('');

    el.dots.addEventListener('click', (e) => {
      const btn = e.target.closest('.tv-dot');
      if (btn) {
        _showSlide(parseInt(btn.dataset.i, 10));
        _resetTimer();
      }
    });
  }

  function _showSlide(i) {
    const slide = slides[i];
    if (!slide) return;
    currentIndex = i;

    el.panel.classList.remove('slide-in');
    void el.panel.offsetWidth;
    el.panel.classList.add('slide-in');

    const accent = slide.accent || '#00e8ff';
    el.panel.style.setProperty('--slide-accent', accent);

    el.tag.textContent       = slide.tag || '';
    el.tag.style.color       = accent;
    el.tag.style.borderColor = accent;
    el.title.textContent     = slide.title    || '';
    el.subtitle.textContent  = slide.subtitle || '';
    el.body.textContent      = slide.body     || '';
    el.counter.textContent   = `${i + 1} / ${slides.length}`;

    el.dots.querySelectorAll('.tv-dot').forEach((d, j) => {
      d.classList.toggle('active', j === i);
    });
  }

  function _startTimer() {
    timer = setInterval(() => _showSlide((currentIndex + 1) % slides.length), INTERVAL);
  }

  function _resetTimer() {
    clearInterval(timer);
    _startTimer();
  }

  return { init };
})();
