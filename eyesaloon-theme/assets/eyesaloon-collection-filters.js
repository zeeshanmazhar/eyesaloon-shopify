document.addEventListener('input', (event) => {
  const filter = event.target.closest('[data-eyesaloon-collection-filter]');
  if (!filter) return;

  const form = filter.closest('[data-eyesaloon-collection-filters]');
  const grid = document.querySelector('[data-eyesaloon-filter-grid]');
  if (!form || !grid) return;

  const criteria = Object.fromEntries(
    [...form.querySelectorAll('[data-eyesaloon-collection-filter]')].map((input) => [input.name, input.value]),
  );
  let visibleCount = 0;

  grid.querySelectorAll('[data-eyesaloon-filter-item]').forEach((item) => {
    const matches = Object.entries(criteria).every(([key, value]) => {
      if (!value) return true;
      const values = (item.dataset[key] || '').split(',').filter(Boolean);
      return values.includes(value);
    });
    item.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  const count = form.querySelector('[data-eyesaloon-filter-count]');
  if (count) {
    count.textContent = count.dataset.template.replace('[count]', String(visibleCount));
  }

  const empty = document.querySelector('[data-eyesaloon-filter-empty]');
  if (empty) empty.hidden = visibleCount > 0;
});

document.addEventListener('click', (event) => {
  const reset = event.target.closest('[data-eyesaloon-filter-reset]');
  if (!reset) return;

  const form = reset.closest('[data-eyesaloon-collection-filters]');
  if (!form) return;

  form.querySelectorAll('[data-eyesaloon-collection-filter]').forEach((input) => {
    input.value = '';
  });
  form.querySelector('[data-eyesaloon-collection-filter]')?.dispatchEvent(new Event('input', { bubbles: true }));
});
