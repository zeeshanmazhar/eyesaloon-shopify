(() => {
  const blocks = document.querySelectorAll("[data-eyesaloon-tryon]");

  blocks.forEach((block) => {
    const button = block.querySelector(".eyesaloon-tryon__button");
    const modal = block.querySelector("[data-eyesaloon-tryon-modal]");
    const closeButtons = block.querySelectorAll("[data-eyesaloon-tryon-close]");
    const status = block.querySelector("[data-eyesaloon-tryon-status]");
    let previousFocus = null;

    if (!button) return;

    const openModal = () => {
      previousFocus = document.activeElement;

      if (modal) {
        modal.hidden = false;
        modal.querySelector("[data-eyesaloon-tryon-close]")?.focus();
      }

      if (status) {
        status.textContent = block.dataset.modelUrl
          ? "Preparing your private try-on preview."
          : "Add a 3D model file to enable try-on for this frame.";
      }
    };

    const closeModal = () => {
      if (modal) modal.hidden = true;

      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
    };

    button.addEventListener("click", () => {
      openModal();

      block.dispatchEvent(
        new CustomEvent("eyesaloon:tryon", {
          bubbles: true,
          detail: {
            modelUrl: block.dataset.modelUrl || "",
            productId: block.dataset.productId || "",
          },
        }),
      );
    });

    closeButtons.forEach((closeButton) => {
      closeButton.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal && !modal.hidden) {
        closeModal();
      }
    });
  });
})();
