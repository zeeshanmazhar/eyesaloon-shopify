document.querySelectorAll('[data-eyesaloon-hero-carousel]').forEach((root) => {
  const track = root.querySelector('[data-hero-track]');
  const slides = Array.from(root.querySelectorAll('[data-hero-slide]'));
  const dots = Array.from(root.querySelectorAll('[data-hero-dot]'));
  const prevButton = root.querySelector('[data-hero-prev]');
  const nextButton = root.querySelector('[data-hero-next]');

  if (!track || slides.length < 2) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const autoplayEnabled = root.dataset.autoplay === 'true' && !reducedMotion;
  const autoplayInterval = parseInt(root.dataset.autoplayInterval, 10) || 5000;

  let current = slides.findIndex((slide) => slide.classList.contains('is-active'));
  if (current < 0) current = 0;
  let timer = null;

  function setActive(index, { userInitiated } = {}) {
    const next = (index + slides.length) % slides.length;
    if (next === current && !userInitiated) return;

    const outgoing = slides[current];
    const incoming = slides[next];

    outgoing.classList.remove('is-active');
    outgoing.setAttribute('aria-hidden', 'true');
    outgoing.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));

    incoming.classList.add('is-active');
    incoming.removeAttribute('aria-hidden');
    incoming.querySelectorAll('a, button').forEach((el) => el.removeAttribute('tabindex'));

    if (dots[current]) {
      dots[current].classList.remove('is-active');
      dots[current].setAttribute('aria-selected', 'false');
    }
    if (dots[next]) {
      dots[next].classList.add('is-active');
      dots[next].setAttribute('aria-selected', 'true');
    }

    current = next;

    if (userInitiated) {
      track.setAttribute('aria-live', 'polite');
    }
  }

  function next(options) {
    setActive(current + 1, options);
  }

  function prev(options) {
    setActive(current - 1, options);
  }

  function start() {
    if (!autoplayEnabled || document.hidden) return;
    stop();
    track.setAttribute('aria-live', 'off');
    timer = window.setInterval(next, autoplayInterval);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function resetAutoplay() {
    stop();
    start();
  }

  if (autoplayEnabled) start();

  track.addEventListener('mouseenter', stop);
  track.addEventListener('mouseleave', start);
  track.addEventListener('focusin', stop);
  track.addEventListener('focusout', start);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      next({ userInitiated: true });
      resetAutoplay();
    });
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      prev({ userInitiated: true });
      resetAutoplay();
    });
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = parseInt(dot.dataset.index, 10);
      setActive(index, { userInitiated: true });
      resetAutoplay();
    });
  });

  let touchStartX = 0;
  track.addEventListener(
    'touchstart',
    (event) => {
      touchStartX = event.touches[0].clientX;
    },
    { passive: true }
  );
  track.addEventListener(
    'touchend',
    (event) => {
      const delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40) {
        setActive(current + (delta < 0 ? 1 : -1), { userInitiated: true });
        resetAutoplay();
      }
    },
    { passive: true }
  );
});
