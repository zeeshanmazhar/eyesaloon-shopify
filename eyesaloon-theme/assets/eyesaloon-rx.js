const RX_SELECTOR = '[data-eyesaloon-rx]';
const RX_MODAL_SELECTOR = '[data-eyesaloon-rx-modal]';

function rxModal(rx) {
  if (!rx?.dataset.rxId) return rx?.querySelector(RX_MODAL_SELECTOR);
  return document.querySelector(`${RX_MODAL_SELECTOR}[data-rx-owner="${rx.dataset.rxId}"]`) || rx.querySelector(RX_MODAL_SELECTOR);
}

function queryRx(rx, selector) {
  return rx?.querySelector(selector) || rxModal(rx)?.querySelector(selector);
}

function queryAllRx(rx, selector) {
  return [...(rx?.querySelectorAll(selector) || []), ...(rxModal(rx)?.querySelectorAll(selector) || [])];
}

function formForRx(rx) {
  return rx?.closest('form') || document.getElementById(rx?.dataset.rxFormId);
}

function selectedOrderType(form) {
  return form.querySelector('[data-eyesaloon-order-type]:checked')?.dataset.eyesaloonOrderType || 'frame_only';
}

function selectedRxMethod(form) {
  const rx = form.querySelector(RX_SELECTOR);
  return queryRx(rx, '[data-eyesaloon-rx-method]:checked')?.dataset.eyesaloonRxMethod || 'whatsapp';
}

function rxRootFromElement(element) {
  const rx = element.closest?.(RX_SELECTOR);
  if (rx) return rx;

  const modal = element.closest?.(RX_MODAL_SELECTOR);
  if (!modal?.dataset.rxOwner) return null;
  return document.querySelector(`${RX_SELECTOR}[data-rx-id="${modal.dataset.rxOwner}"]`);
}

function setInputsDisabled(container, disabled) {
  container?.querySelectorAll('input, select, textarea').forEach((input) => {
    input.disabled = disabled;
  });
}

function setRequired(container, required) {
  container?.querySelectorAll('[data-rx-required]').forEach((input) => {
    input.required = required;
  });
}

function rxMessages(rx) {
  return {
    required: rx?.dataset.validationRequired || 'Please complete the required prescription fields.',
    upload: rx?.dataset.validationUpload || 'Please upload your prescription file.',
  };
}

function syncRxForm(form) {
  const rx = form.querySelector(RX_SELECTOR);
  if (!rx) return;

  const isFrameOnly = selectedOrderType(form) === 'frame_only';
  const method = selectedRxMethod(form);
  const panel = queryRx(rx, '[data-eyesaloon-rx-panel]');

  if (panel) {
    panel.hidden = isFrameOnly;
    setInputsDisabled(panel, isFrameOnly);
  }

  queryAllRx(rx, '[data-eyesaloon-rx-fields]').forEach((group) => {
    const isActive = !isFrameOnly && group.dataset.eyesaloonRxFields === method;
    group.hidden = !isActive;
    setInputsDisabled(group, !isActive);
    setRequired(group, isActive && method === 'typed');
  });

  const uploadFile = queryRx(rx, '[data-rx-upload-file]');
  if (uploadFile) {
    uploadFile.required = !isFrameOnly && method === 'upload';
  }
}

function firstInvalidRxInput(form) {
  const rx = form.querySelector(RX_SELECTOR);
  if (!rx || selectedOrderType(form) === 'frame_only') return null;

  const method = selectedRxMethod(form);
  if (method === 'typed') {
    const requiredInputs = queryAllRx(rx, '[data-eyesaloon-rx-fields="typed"] [data-rx-required]');
    return requiredInputs.find((input) => !input.value || !input.checkValidity()) || null;
  }

  if (method === 'upload') {
    const uploadFile = queryRx(rx, '[data-rx-upload-file]');
    if (!uploadFile?.files?.length) return uploadFile || null;
  }

  return null;
}

function validationMessageForInput(input, rx) {
  if (input?.matches('[data-rx-upload-file]')) return rxMessages(rx).upload;
  return rxMessages(rx).required;
}

function typedPrescriptionSummary(rx) {
  const typedGroup = queryRx(rx, '[data-eyesaloon-rx-fields="typed"]');
  if (!typedGroup) return '';

  const values = [...typedGroup.querySelectorAll('label')].flatMap((label) => {
    const input = label.querySelector('input');
    const labelText = label.querySelector('span')?.textContent?.trim();
    if (!input?.value || !labelText) return [];
    return [`${labelText}: ${input.value}`];
  });

  return values.join(' | ');
}

function openRxModal(rx) {
  const modal = rxModal(rx);
  const dialog = modal?.querySelector('.eyesaloon-rx__dialog');
  if (!modal) return;

  modal.hidden = false;
  document.documentElement.classList.add('overflow-hidden');
  dialog?.focus();
}

function closeRxModal(rx) {
  const modal = rxModal(rx);
  if (!modal) return;

  modal.hidden = true;
  document.documentElement.classList.remove('overflow-hidden');
}

function updateRxSummary(form) {
  const rx = form.querySelector(RX_SELECTOR);
  const summary = rx?.querySelector('[data-eyesaloon-rx-summary]');
  const editButton = rx?.querySelector('[data-eyesaloon-rx-open]');
  if (!rx || !summary) return;

  const isFrameOnly = selectedOrderType(form) === 'frame_only';
  const method = selectedRxMethod(form);
  const uploadFile = queryRx(rx, '[data-rx-upload-file]');

  if (isFrameOnly) {
    summary.textContent = rx.dataset.summaryFrame || 'Frame only selected';
    editButton?.setAttribute('hidden', 'hidden');
    return;
  }

  editButton?.removeAttribute('hidden');

  if (method === 'typed') {
    summary.textContent = typedPrescriptionSummary(rx) || rx.dataset.summaryPrescription || 'Prescription values selected';
  } else if (method === 'upload' && uploadFile?.files?.length) {
    summary.textContent = `${rx.dataset.summaryUpload || 'Prescription file selected'}: ${uploadFile.files[0].name}`;
  } else if (method === 'upload') {
    summary.textContent = rx.dataset.summaryUpload || 'Prescription file selected';
  } else {
    summary.textContent = rx.dataset.summaryWhatsapp || 'Prescription will be confirmed on WhatsApp';
  }
}

function initializeRx(rx, index) {
  const form = rx.closest('form');
  if (!(form instanceof HTMLFormElement)) return;

  if (!form.id) form.id = `EyesaloonProductForm-${Date.now()}-${index}`;
  rx.dataset.rxId = rx.dataset.rxId || `eyesaloon-rx-${Date.now()}-${index}`;
  rx.dataset.rxFormId = form.id;

  const modal = rx.querySelector(RX_MODAL_SELECTOR);
  if (modal) {
    modal.dataset.rxOwner = rx.dataset.rxId;
    modal.querySelectorAll('input, select, textarea').forEach((input) => {
      input.setAttribute('form', form.id);
    });
    document.body.appendChild(modal);
  }

  syncRxForm(form);
  updateRxSummary(form);
}

document.querySelectorAll(`form ${RX_SELECTOR}`).forEach((rx, index) => {
  initializeRx(rx, index);
});

document.addEventListener('change', (event) => {
  const rx = rxRootFromElement(event.target);
  if (!rx) return;
  event.target.setCustomValidity?.('');
  const form = formForRx(rx);
  if (!(form instanceof HTMLFormElement)) return;

  syncRxForm(form);
  updateRxSummary(form);

  if (event.target.matches('[data-eyesaloon-order-type]')) {
    if (selectedOrderType(form) === 'frame_only') {
      closeRxModal(rx);
    } else {
      openRxModal(rx);
    }
  }
});

document.addEventListener('input', (event) => {
  const input = event.target;
  if (!rxRootFromElement(input) || !input.matches?.('input')) return;
  const rx = rxRootFromElement(input);
  const form = formForRx(rx);
  input.setCustomValidity('');
  if (form instanceof HTMLFormElement) updateRxSummary(form);
});

document.addEventListener('click', (event) => {
  const openButton = event.target.closest?.('[data-eyesaloon-rx-open]');
  if (openButton) {
    const rx = rxRootFromElement(openButton);
    if (rx) openRxModal(rx);
    return;
  }

  const saveButton = event.target.closest?.('[data-eyesaloon-rx-save]');
  if (saveButton) {
    const rx = rxRootFromElement(saveButton);
    const form = formForRx(rx);
    if (!(form instanceof HTMLFormElement)) return;

    const invalidInput = firstInvalidRxInput(form);
    if (invalidInput) {
      invalidInput.setCustomValidity(validationMessageForInput(invalidInput, rx));
      invalidInput.reportValidity();
      return;
    }

    updateRxSummary(form);
    closeRxModal(rx);
    return;
  }

  const closeButton = event.target.closest?.('[data-eyesaloon-rx-close]');
  if (closeButton) {
    const rx = rxRootFromElement(closeButton);
    if (rx) closeRxModal(rx);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll(`${RX_MODAL_SELECTOR}:not([hidden])`).forEach((modal) => {
    closeRxModal(rxRootFromElement(modal));
  });
});

document.addEventListener(
  'submit',
  async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector(RX_SELECTOR)) return;

    syncRxForm(form);
    if (selectedOrderType(form) === 'frame_only') return;

    const invalidInput = firstInvalidRxInput(form);
    if (invalidInput) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const rx = form.querySelector(RX_SELECTOR);
      openRxModal(rx);
      invalidInput.setCustomValidity(validationMessageForInput(invalidInput, rx));
      invalidInput.reportValidity();
      return;
    }

    const rx = form.querySelector(RX_SELECTOR);
    const packageSelect = queryRx(rx, '[data-eyesaloon-lens-package]');
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
    formData.set('quantity', quantity);
    formData.set('properties[_config_id]', configId);
    formData.set('properties[Lens Package Variant]', packageVariantGid);

    const packageVariantId = packageVariantGid.split('/').pop();
    const packagePayload = {
      id: Number(packageVariantId),
      quantity,
      properties: {
        _config_id: configId,
        _lens_package_for: String(frameVariantId),
        'Lens Package': selectedPackage.value,
      },
    };

    try {
      const frameResponse = await fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });
      const frameJson = await frameResponse.json();
      if (!frameResponse.ok || frameJson.status) {
        throw new Error(frameJson.description || frameJson.message || 'Unable to add frame');
      }

      const packageResponse = await fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(packagePayload),
      });
      const packageJson = await packageResponse.json();
      if (!packageResponse.ok || packageJson.status) {
        throw new Error(packageJson.description || packageJson.message || 'Unable to add lenses');
      }

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
