document.addEventListener(
  'submit',
  async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector('[data-eyesaloon-rx]')) return;

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
