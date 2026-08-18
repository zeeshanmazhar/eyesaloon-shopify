(() => {
  const blocks = document.querySelectorAll("[data-eyesaloon-tryon]");
  const AUTO_OPEN_PARAM = "tryon";
  let qrLibraryPromise = null;
  let runtimeLibraryPromise = null;

  const canUseWebGL = () => {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  };

  const isMobileViewport = () =>
    window.matchMedia("(max-width: 749px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;

  const loadQrLibrary = (src) => {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!src) return Promise.reject(new Error("Missing QR library URL."));
    if (qrLibraryPromise) return qrLibraryPromise;

    qrLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.onload = () => {
        if (window.qrcode) {
          resolve(window.qrcode);
        } else {
          reject(new Error("QR library did not expose window.qrcode."));
        }
      };
      script.onerror = () => reject(new Error("QR library failed to load."));
      document.head.append(script);
    });

    return qrLibraryPromise;
  };

  const loadRuntimeLibrary = (src) => {
    if (window.EyesaloonTryOnRuntime) return Promise.resolve(window.EyesaloonTryOnRuntime);
    if (!src) return Promise.reject(new Error("Missing try-on runtime URL."));
    if (runtimeLibraryPromise) return runtimeLibraryPromise;

    runtimeLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.onload = () => {
        if (window.EyesaloonTryOnRuntime) {
          resolve(window.EyesaloonTryOnRuntime);
        } else {
          reject(new Error("Try-on runtime did not initialize."));
        }
      };
      script.onerror = () => reject(new Error("Try-on runtime failed to load."));
      document.head.append(script);
    });

    return runtimeLibraryPromise;
  };

  blocks.forEach((block) => {
    const button = block.querySelector(".eyesaloon-tryon__button");
    const modal = block.querySelector("[data-eyesaloon-tryon-modal]");
    const closeButtons = block.querySelectorAll("[data-eyesaloon-tryon-close]");
    const status = block.querySelector("[data-eyesaloon-tryon-status]");
    const video = block.querySelector("[data-eyesaloon-tryon-video]");
    const canvas = block.querySelector("[data-eyesaloon-tryon-canvas]");
    const rendererCanvas = block.querySelector("[data-eyesaloon-tryon-renderer]");
    const framePreview = block.querySelector(".eyesaloon-tryon-modal__frame");
    const qrContainer = block.querySelector("[data-eyesaloon-tryon-qr]");
    const cameraButton = block.querySelector("[data-eyesaloon-tryon-camera]");
    const copyButton = block.querySelector("[data-eyesaloon-tryon-copy]");
    let previousFocus = null;
    let cameraStream = null;
    let runtime = null;
    let qrRenderedForUrl = "";
    const cameraStates = ["active-camera", "model-active", "model-error", "tracking-assets-missing"];

    if (!button) return;

    const getTryOnUrl = () => {
      const productUrl = block.dataset.productUrl || window.location.pathname;
      const url = new URL(productUrl, window.location.origin);
      url.searchParams.set(AUTO_OPEN_PARAM, "1");
      url.searchParams.set("source", "qr");
      return url.toString();
    };

    const getStatusText = (state) => {
      const key = `status${state
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")}`;

      return block.dataset[key] || block.dataset.statusReady || "";
    };

    const setState = (state) => {
      block.dataset.tryonState = state;

      if (status) {
        status.textContent = getStatusText(state);
      }

      if (copyButton) {
        copyButton.hidden = state !== "desktop" && state !== "unsupported" && state !== "no-camera";
      }

      if (cameraButton) {
        cameraButton.hidden = state !== "camera-permission";
      }

      if (video) {
        video.hidden = !cameraStates.includes(state);
      }

      if (canvas) {
        canvas.hidden = !cameraStates.includes(state);
      }

      if (rendererCanvas) {
        rendererCanvas.hidden = state !== "model-active";
      }

      if (framePreview) {
        framePreview.hidden = state === "desktop";
      }

      if (qrContainer) {
        qrContainer.hidden = state !== "desktop";
      }

      if (state === "desktop") {
        renderQrCode();
      }
    };

    const renderQrCode = async () => {
      if (!qrContainer) return;

      const tryOnUrl = getTryOnUrl();
      if (qrRenderedForUrl === tryOnUrl) return;

      qrContainer.innerHTML = "";
      qrContainer.classList.add("is-loading");

      try {
        const createQrCode = await loadQrLibrary(block.dataset.qrSrc);
        const qr = createQrCode(0, "M");
        qr.addData(tryOnUrl);
        qr.make();

        qrContainer.innerHTML = qr.createSvgTag({
          alt: block.dataset.qrLabel || "Mobile try-on QR code",
          cellSize: 4,
          margin: 3,
          scalable: true,
        });
        qrRenderedForUrl = tryOnUrl;
      } catch {
        setState("qr-error");
      } finally {
        qrContainer.classList.remove("is-loading");
      }
    };

    const getSupport = () => ({
      camera: Boolean(navigator.mediaDevices?.getUserMedia),
      secureContext: window.isSecureContext,
      wasm: typeof WebAssembly === "object",
      webgl: canUseWebGL(),
    });

    const chooseInitialState = () => {
      if (!block.dataset.modelUrl) return "no-model";

      const support = getSupport();
      if (!support.secureContext || !support.wasm || !support.webgl) return "unsupported";

      if (!isMobileViewport()) return "desktop";
      if (!support.camera) return "no-camera";

      return "camera-permission";
    };

    const stopCamera = () => {
      runtime?.destroy();
      runtime = null;

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
      }

      if (video) {
        video.pause();
        video.srcObject = null;
        video.hidden = true;
      }

      if (canvas) {
        canvas.hidden = true;
      }

      if (rendererCanvas) {
        rendererCanvas.hidden = true;
      }
    };

    const startRuntime = async () => {
      const runtimeLibrary = await loadRuntimeLibrary(block.dataset.runtimeSrc);
      runtime = runtimeLibrary.create({
        block,
        canvas,
        measurements: {
          bridgeMm: block.dataset.bridgeMm || "",
          lensHeightMm: block.dataset.lensHeightMm || "",
          lensWidthMm: block.dataset.lensWidthMm || "",
          templeMm: block.dataset.templeMm || "",
        },
        modelUrl: block.dataset.modelUrl || "",
        rendererCanvas,
        rendererSrc: block.dataset.rendererSrc || "",
        trackingManifestUrl: block.dataset.trackingManifestUrl || "",
        video,
      });

      return runtime.start();
    };

    const openModal = () => {
      previousFocus = document.activeElement;

      if (modal) {
        if (modal.parentNode !== document.body) {
          document.body.append(modal);
        }

        modal.classList.add("is-portal");
        modal.hidden = false;
        modal.querySelector("[data-eyesaloon-tryon-close]")?.focus();
      }

      setState(chooseInitialState());
      document.body.classList.add("eyesaloon-tryon-modal-open");
    };

    const closeModal = () => {
      stopCamera();

      if (modal) modal.hidden = true;
      document.body.classList.remove("eyesaloon-tryon-modal-open");

      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
    };

    button.addEventListener("click", () => {
      openModal();
    });

    copyButton?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(getTryOnUrl());
        if (status) status.textContent = block.dataset.copySuccess || getTryOnUrl();
      } catch {
        if (status) status.textContent = block.dataset.copyError || getTryOnUrl();
      }
    });

    cameraButton?.addEventListener("click", async () => {
      const support = getSupport();

      if (!support.camera || !support.secureContext) {
        setState("no-camera");
        return;
      }

      setState("loading");

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            height: { ideal: 720 },
            width: { ideal: 960 },
          },
        });

        if (video) {
          video.srcObject = cameraStream;
          await video.play();
        }

        const runtimeStatus = await startRuntime();

        if (!runtimeStatus?.ready) {
          throw new Error("Try-on runtime could not start.");
        }

        if (!runtimeStatus.trackingAssetsReady) {
          setState("tracking-assets-missing");
        } else {
          setState(runtimeStatus.modelReady ? "model-active" : "model-error");
        }
      } catch {
        const hadCameraStream = Boolean(cameraStream);
        stopCamera();
        setState(hadCameraStream ? "runtime-error" : "no-camera");
      }
    });

    closeButtons.forEach((closeButton) => {
      closeButton.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal && !modal.hidden) {
        closeModal();
      }
    });

    if (new URLSearchParams(window.location.search).get(AUTO_OPEN_PARAM) === "1") {
      openModal();
    }
  });
})();
