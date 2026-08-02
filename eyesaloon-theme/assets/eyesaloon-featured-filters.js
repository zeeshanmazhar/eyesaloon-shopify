document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-eyesaloon-featured-filter]');
  if (!button) return;

  const section = button.closest('[data-eyesaloon-featured]');
  if (!section) return;

  const tag = button.dataset.eyesaloonFeaturedFilter;
  section.querySelectorAll('[data-eyesaloon-featured-filter]').forEach((candidate) => {
    candidate.classList.toggle('is-selected', candidate === button);
    candidate.setAttribute('aria-pressed', String(candidate === button));
  });

  section.querySelectorAll('[data-eyesaloon-product-tags]').forEach((item) => {
    const tags = item.dataset.eyesaloonProductTags.split(',');
    item.hidden = tag !== 'all' && !tags.includes(tag);
  });
});
