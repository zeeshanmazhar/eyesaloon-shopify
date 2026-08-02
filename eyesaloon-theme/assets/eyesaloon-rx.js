const RX_SELECTOR = '[data-eyesaloon-rx]';

function selectedOrderType(form) {
  return form.querySelector('[data-eyesaloon-order-type]:checked')?.dataset.eyesaloonOrderType || 'frame_only';
}

function selectedRxMethod(form) {
  return form.querySelector('[data-eyesaloon-rx-method]:checked')?.dataset.eyesaloonRxMethod || 'whatsapp';
}

function setInputsDisabled(container, disabled) {
  container?.querySelectorAll('input, select, textarea').forEach((input) => {
    input.disabled = disabled;
  });
}

function syncRxForm(form) {
  const rx = form.querySelector(RX_SELECTOR);
  if (!rx) return;

  const isFrameOnly = selectedOrderType(form) === 'frame_only';
  const method = selectedRxMethod(form);
  const panel = rx.querySelector('[data-eyesaloon-rx-panel]');

  if (panel) {
    panel.hidden = isFrameOnly;
    setInputsDisabled(panel, isFrameOnly);
  }

  rx.querySelectorAll('[data-eyesaloon-rx-fields]').forEach((group) => {
    const isActive = !isFrameOnly && group.dataset.eyesaloonRxFields === method;
    group.hidden = !isActive;
    setInputsDisabled(group, !isActive);
  });
}

document.querySelectorAll(`form ${RX_SELECTOR}`).forEach((rx) => {
  const form = rx.closest('form');
  if (form instanceof HTMLFormElement) syncRxForm(form);
});

document.addEventListener('change', (event) => {
  if (!event.target.closest?.(RX_SELECTOR)) return;
  const form = event.target.closest('form');
  if (form instanceof HTMLFormElement) syncRxForm(form);
});

document.addEventListener(
  'submit',
  async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector(RX_SELECTOR)) return;

    syncRxForm(form);
    if (selectedOrderType(form) === 'frame_only') return;

    const packageSelect = form.querySelector('[data-eyesaloon-lens-package]');
    const selectedPackage = packageSelect?.selectedOptions?.[0];
    const packageVariantGid = selectedPackage?.dataset.hiddenVariantId;
    if (!packageVariantGid) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const productForm = form.closest('product-form');
    const submitButton = productForm?.querySelector('[type="submit"]');
    const errorMessage = productForm?.querySelector('.product-form__error-message');
    const errorWrapper = productForm?.querySelector('.product-form__error-message-wrapper');

    submitButton?.setAttribute('aria-disabled', 'true');
    submitButton?.classList.add('loading');
    errorWrapper?.setAttribute('hidden', 'hidden');

    const formData = new FormData(form);
    const frameVariantId = formData.get('id');
    const quantity = Number(formData.get('quantity') || 1);
    const configId = `rx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const frameProperties = {};

    for (const [key, value] of formData.entries()) {
      const match = String(key).match(/^properties\\[(.+)]$/);
      if (!match || value === '') continue;
      frameProperties[match[1]] = value;
    }

    frameProperties._config_id = configId;
    frameProperties['Lens Package Variant'] = packageVariantGid;

    const packageVariantId = packageVariantGid.split('/').pop();
    const payload = {
      items: [
        {
          id: Number(frameVariantId),
          quantity,
          properties: frameProperties,
        },
        {
          id: Number(packageVariantId),
          quantity,
          properties: {
            _config_id: configId,
            _lens_package_for: String(frameVariantId),
            'Lens Package': selectedPackage.value,
          },
        },
      ],
    };

    try {
      const response = await fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || json.status) throw new Error(json.description || json.message || 'Unable to add lenses');
      window.location = window.routes.cart_url;
    } catch (error) {
      if (errorMessage) errorMessage.textContent = error.message;
      errorWrapper?.removeAttribute('hidden');
      submitButton?.removeAttribute('aria-disabled');
      submitButton?.classList.remove('loading');
    }
  },
  true,
);
