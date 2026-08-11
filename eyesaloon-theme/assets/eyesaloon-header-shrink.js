(function () {
  var header = document.querySelector('.section-header .header');
  if (!header) return;

  function onScroll() {
    header.classList.toggle('shrink', window.scrollY > 20);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
