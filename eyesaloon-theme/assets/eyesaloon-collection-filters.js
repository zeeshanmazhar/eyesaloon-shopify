const filterNames = ['shape', 'material', 'gender', 'face'];

const getFilterInputs = (form) => [...form.querySelectorAll('[data-eyesaloon-collection-filter]')];

const getCriteria = (form) =>
  Object.fromEntries(getFilterInputs(form).map((input) => [input.name, input.value]));

const updateUrl = (criteria) => {
  const url = new URL(window.location.href);
  filterNames.forEach((name) => {
    if (criteria[name]) {
      url.searchParams.set(name, criteria[name]);
    } else {
      url.searchParams.delete(name);
    }
  });
  window.history.replaceState({}, '', url);
};

const renderActiveFilters = (form, criteria) => {
  const active = form.querySelector('[data-eyesaloon-active-filters]');
  const reset = form.querySelector('[data-eyesaloon-filter-reset]');
  if (!active) return;

  active.replaceChildren();

  getFilterInputs(form).forEach((input) => {
    if (!criteria[input.name]) return;

    const option = input.selectedOptions[0];
    const chip = document.createElement('button');
    chip.className = 'eyesaloon-active-filter';
    chip.type = 'button';
    chip.dataset.eyesaloonFilterRemove = input.name;
    chip.textContent = `${input.dataset.label}: ${option?.textContent?.trim() || input.value}`;
    active.append(chip);
  });

  if (reset) reset.hidden = active.childElementCount === 0;
};

const applyFilters = (form, shouldUpdateUrl = true) => {
  const grid = document.querySelector('[data-eyesaloon-filter-grid]');
  if (!grid) return;

  const criteria = getCriteria(form);
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

  renderActiveFilters(form, criteria);
  if (shouldUpdateUrl) updateUrl(criteria);
};

const hydrateFiltersFromUrl = (form) => {
  const params = new URLSearchParams(window.location.search);
  let hasFilters = false;

  getFilterInputs(form).forEach((input) => {
    const value = params.get(input.name);
    if (!value) return;
    if ([...input.options].some((option) => option.value === value)) {
      input.value = value;
      hasFilters = true;
    }
  });

  applyFilters(form, false);
  if (hasFilters) updateUrl(getCriteria(form));
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-eyesaloon-collection-filters]').forEach(hydrateFiltersFromUrl);
});

document.addEventListener('input', (event) => {
  const filter = event.target.closest('[data-eyesaloon-collection-filter]');
  if (!filter) return;

  const form = filter.closest('[data-eyesaloon-collection-filters]');
  if (form) applyFilters(form);
});

document.addEventListener('change', (event) => {
  const filter = event.target.closest('[data-eyesaloon-collection-filter]');
  if (!filter) return;

  const form = filter.closest('[data-eyesaloon-collection-filters]');
  if (form) applyFilters(form);
});

document.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-eyesaloon-filter-remove]');
  if (remove) {
    const form = remove.closest('[data-eyesaloon-collection-filters]');
    const input = form?.querySelector(`[name="${remove.dataset.eyesaloonFilterRemove}"]`);
    if (form && input) {
      input.value = '';
      applyFilters(form);
    }
    return;
  }

  const reset = event.target.closest('[data-eyesaloon-filter-reset]');
  if (!reset) return;

  const form = reset.closest('[data-eyesaloon-collection-filters]');
  if (!form) return;

  getFilterInputs(form).forEach((input) => {
    input.value = '';
  });
  applyFilters(form);
});
