"use strict";

(() => {
  const blocks = document.querySelectorAll("[data-eyesaloon-tryon]");
  const TRYON_PARAM = "tryon";
  let qrPromise = null;
  let runtimePromise = null;

  const supportsWebGL = () => {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  };

  const isMobileTryOnDevice = () => window.matchMedia("(max-width:749px),(pointer:coarse)").matches;

  const loadGlobalScript = (src, globalName, existingPromise) => {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!src) return Promise.reject(new Error(`Missing ${globalName}.`));
    if (existingPromise) return existingPromise;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.onload = () => {
        if (window[globalName]) {
          resolve(window[globalName]);
        } else {
          reject(new Error(`${globalName} unavailable.`));
        }
      };
      script.onerror = () => reject(new Error(`${globalName} failed.`));
      document.head.append(script);
    });
  };

  const loadQr = (src) => {
    qrPromise = loadGlobalScript(src, "qrcode", qrPromise);
    return qrPromise;
  };

  const loadRuntime = (src) => {
    runtimePromise = loadGlobalScript(src, "EyesaloonTryOnRuntime", runtimePromise);
    return runtimePromise;
  };

  const withTimeout = (promise, timeoutMs, message) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);

  const versionedUrl = (src, version) => {
    if (!src || !version) return src;
    const url = new URL(src, window.location.href);
    url.searchParams.set("eyesaloon_tryon_v", version);
    return url.toString();
  };

  const parsePd = (value) => {
    const pd = Number.parseFloat(value);
    return Number.isFinite(pd) && pd >= 45 && pd <= 80 ? String(pd) : "";
  };

  const parseProfile = (value) => {
    if (!value) return null;

    try {
      const profile = JSON.parse(value);
      return profile?.version === 1 && Number.isFinite(Number(profile.faceWidthMm)) ? profile : null;
    } catch {
      return null;
    }
  };

  const emitTelemetry = (block, eventName, detail = {}) => {
    const payload = {
      event: `eyesaloon_tryon_${eventName}`,
      mode: block?.dataset.tryonMode || "unavailable",
      product_id: block?.dataset.productId || "",
      product_url: block?.dataset.productUrl || window.location.pathname,
      source: new URLSearchParams(window.location.search).get("source") || "",
      ...detail,
    };

    window.dispatchEvent(
      new CustomEvent("eyesaloon:tryon-telemetry", {
        detail: payload,
      }),
    );

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
  };

  blocks.forEach((block) => {
    const openButton = block.querySelector(".eyesaloon-tryon__button");
    const modal = block.querySelector("[data-eyesaloon-tryon-modal]");
    const closeButtons = block.querySelectorAll("[data-eyesaloon-tryon-close]");
    const status = block.querySelector("[data-eyesaloon-tryon-status]");
    const video = block.querySelector("[data-eyesaloon-tryon-video]");
    const canvas = block.querySelector("[data-eyesaloon-tryon-canvas]");
    const rendererCanvas = block.querySelector("[data-eyesaloon-tryon-renderer]");
    const desktop = block.querySelector("[data-eyesaloon-tryon-desktop]");
    const qr = block.querySelector("[data-eyesaloon-tryon-qr]");
    const cameraButton = block.querySelector("[data-eyesaloon-tryon-camera]");
    const copyButton = block.querySelector("[data-eyesaloon-tryon-copy]");
    const pdInput = block.querySelector("[data-eyesaloon-tryon-pd]");
    const backdrop = modal?.querySelector(".eyesaloon-tryon-modal__backdrop");
    const panel = modal?.querySelector(".eyesaloon-tryon-modal__panel");
    const selfieControl = block.querySelector("[data-eyesaloon-tryon-selfie]");
    const selfieInput = selfieControl?.querySelector("input");
    const selfiePreview = block.querySelector("[data-eyesaloon-tryon-selfie-preview]");
    let stream = null;
    let runtime = null;
    let lastQrUrl = "";
    let hasViewed = false;
    let savedProfile = null;

    const activeCameraStates = ["active-camera", "model-active", "model-error", "fit-active", "tracking-assets-missing"];
    const selfieStates = ["no-camera", "unsupported", "selfie-preview"];
    const measurements = {
      bridgeMm: block.dataset.bridgeMm || "",
      fitScale: block.dataset.fitScale || "",
      frameWidthMm: block.dataset.frameWidthMm || "",
      lensHeightMm: block.dataset.lensHeightMm || "",
      lensWidthMm: block.dataset.lensWidthMm || "",
      pdMm: "",
      templeMm: block.dataset.templeMm || "",
      xOffsetPct: block.dataset.fitXOffsetPct || "",
      yOffsetPct: block.dataset.fitYOffsetPct || "",
    };
    const profileStorageKey = block.dataset.profileStorageKey || "eyesaloon_tryon_profile_v1";
    const pdStorageKey = block.dataset.pdStorageKey || "eyesaloon_tryon_pd_mm";

    if (!openButton) return;

    if ("IntersectionObserver" in window) {
      const viewObserver = new IntersectionObserver(
        (entries) => {
          if (hasViewed || !entries.some((entry) => entry.isIntersecting)) return;
          hasViewed = true;
          emitTelemetry(block, "block_viewed");
          viewObserver.disconnect();
        },
        { threshold: 0.35 },
      );
      viewObserver.observe(block);
    } else {
      hasViewed = true;
      emitTelemetry(block, "block_viewed");
    }

    if (modal?.parentElement !== document.body) {
      document.body.append(modal);
    }

    const syncPdValue = (value, shouldStore = true) => {
      const pd = parsePd(value);
      measurements.pdMm = pd;

      if (pdInput && pdInput.value !== pd && value !== "") {
        pdInput.value = pd;
      }

      if (!shouldStore) return;

      try {
        if (pd) {
          window.localStorage.setItem(pdStorageKey, pd);
        } else {
          window.localStorage.removeItem(pdStorageKey);
        }
      } catch {
        // Local storage is optional; try-on still works without it.
      }
    };

    if (pdInput) {
      try {
        savedProfile = parseProfile(window.localStorage.getItem(profileStorageKey));
        const savedPd = savedProfile?.pdMm || window.localStorage.getItem(pdStorageKey);
        if (savedPd) syncPdValue(savedPd, false);
      } catch {
        // Ignore blocked storage.
      }

      pdInput.addEventListener("input", () => {
        measurements.pdMm = parsePd(pdInput.value);
      });

      pdInput.addEventListener("change", () => {
        syncPdValue(pdInput.value);
      });
    }

    const saveMeasurementProfile = (profile) => {
      if (!profile) return;

      savedProfile = {
        ...profile,
        productId: block.dataset.productId || "",
        productUrl: block.dataset.productUrl || window.location.pathname,
      };

      try {
        window.localStorage.setItem(profileStorageKey, JSON.stringify(savedProfile));
        if (savedProfile.pdMm) {
          window.localStorage.setItem(pdStorageKey, String(savedProfile.pdMm));
        }
      } catch {
        // Profile reuse is a convenience layer; fitting still works if storage is blocked.
      }

      if (status) {
        status.textContent = block.dataset.statusProfileReady || "Fit profile saved on this phone.";
      }
    };

    const getMobileUrl = () => {
      const productUrl = block.dataset.productUrl || window.location.pathname;
      const url = new URL(productUrl, window.location.origin);
      const previewThemeId = new URLSearchParams(location.search).get("preview_theme_id");
      const pd = parsePd(measurements.pdMm || pdInput?.value || "");

      if (previewThemeId) url.searchParams.set("preview_theme_id", previewThemeId);
      if (pd) url.searchParams.set("pd", pd);
      if (savedProfile?.createdAt) url.searchParams.set("profile", "1");
      url.searchParams.set(TRYON_PARAM, "1");

      return url.toString();
    };

    const getStatusText = (state) => {
      const key = `status${state
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")}`;
      return block.dataset[key] || block.dataset.statusReady || "";
    };

    const renderQr = async () => {
      if (!qr) return;
      const url = getMobileUrl();

      if (lastQrUrl === url) return;

      qr.innerHTML = "";
      qr.classList.add("is-loading");

      try {
        const qrcode = await loadQr(versionedUrl(block.dataset.qrSrc, block.dataset.buildVersion));
        const code = qrcode(0, "M");
        code.addData(url);
        code.make();
        qr.innerHTML = code.createSvgTag({
          alt: block.dataset.qrLabel || "Mobile try-on QR code",
          cellSize: 4,
          margin: 3,
          scalable: true,
        });
        lastQrUrl = url;
        emitTelemetry(block, "qr_rendered");
      } catch {
        setState("qr-error");
      } finally {
        qr.classList.remove("is-loading");
      }
    };

    const setState = (state) => {
      block.dataset.tryonState = state;
      if (modal) modal.dataset.tryonState = state;
      if (status) status.textContent = getStatusText(state);
      if (copyButton) copyButton.hidden = state !== "desktop";
      if (cameraButton) cameraButton.hidden = state !== "camera-permission";
      if (video) video.hidden = !activeCameraStates.includes(state);
      if (canvas) canvas.hidden = !activeCameraStates.includes(state);
      if (rendererCanvas) rendererCanvas.hidden = state !== "model-active";
      if (selfieControl) selfieControl.hidden = !selfieStates.includes(state);
      if (selfiePreview) selfiePreview.hidden = state !== "selfie-preview";
      if (qr) qr.hidden = state !== "desktop";
      if (desktop) desktop.hidden = state !== "desktop";
      if (state === "desktop") renderQr();
    };

    const getCapabilities = () => ({
      camera: Boolean(navigator.mediaDevices?.getUserMedia),
      secureContext: window.isSecureContext,
      wasm: typeof WebAssembly === "object",
      webgl: supportsWebGL(),
    });

    const getInitialState = () => {
      const mode = block.dataset.tryonMode || "unavailable";
      if (mode === "unavailable") return "no-model";

      const capabilities = getCapabilities();
      if (!capabilities.secureContext || !capabilities.wasm || (mode === "3d" && !capabilities.webgl)) return "unsupported";

      if (isMobileTryOnDevice()) {
        return capabilities.camera ? "camera-permission" : "no-camera";
      }

      return "desktop";
    };

    const stopRuntime = () => {
      runtime?.destroy();
      runtime = null;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      if (video) {
        video.pause();
        video.srcObject = null;
        video.hidden = true;
      }

      if (canvas) canvas.hidden = true;
      if (rendererCanvas) rendererCanvas.hidden = true;
    };

    const startRuntime = async () => {
      const runtimeApi = await loadRuntime(versionedUrl(block.dataset.runtimeSrc, block.dataset.buildVersion));
      runtime = runtimeApi.create({
        block,
        canvas,
        frameImageUrl: block.dataset.frameImageUrl || "",
        measurements: {
          ...measurements,
          profileFaceWidthMm: savedProfile?.faceWidthMm || "",
          profileNoseLengthMm: savedProfile?.noseLengthMm || "",
        },
        mode: block.dataset.tryonMode || "unavailable",
        modelUrl: block.dataset.modelUrl || "",
        rendererCanvas,
        rendererSrc: versionedUrl(block.dataset.rendererSrc, block.dataset.buildVersion) || "",
        trackingManifestUrl: block.dataset.trackingManifestUrl || "",
        video,
      });

      return runtime.start();
    };

    block.addEventListener("eyesaloon:tryon-profile-ready", (event) => {
      saveMeasurementProfile(event.detail?.profile);
    });

    ["scan-started", "scan-completed", "overlay-rendered"].forEach((eventName) => {
      block.addEventListener(`eyesaloon:tryon-${eventName}`, (event) => {
        emitTelemetry(block, eventName.replace(/-/g, "_"), {
          mode: event.detail?.mode || block.dataset.tryonMode || "unavailable",
          scale_source: event.detail?.scaleSource || "",
        });
      });
    });

    block.addEventListener("eyesaloon:tryon-model-error", () => {
      emitTelemetry(block, "model_error");
    });

    const openModal = (state = getInitialState()) => {
      if (modal) {
        modal.style.cssText =
          "align-items:center!important;background:transparent!important;box-sizing:border-box!important;display:grid!important;height:100dvh!important;inset:0!important;justify-items:center!important;margin:0!important;max-height:none!important;max-width:none!important;padding:2rem!important;position:fixed!important;transform:none!important;width:100vw!important;z-index:2147483647!important";

        if (backdrop) {
          backdrop.style.cssText =
            "background:rgba(0,0,0,.42)!important;border:0!important;cursor:pointer!important;height:100dvh!important;inset:0!important;padding:0!important;position:fixed!important;width:100vw!important;z-index:0!important";
        }

        if (panel) panel.style.zIndex = "1";

        modal.hidden = false;
        modal.querySelector("[data-eyesaloon-tryon-close]")?.focus();
      }

      setState(state);
      emitTelemetry(block, "modal_opened", { state });
      document.body.classList.add("eyesaloon-tryon-modal-open");
    };

    const closeModal = () => {
      stopRuntime();
      if (modal) {
        modal.hidden = true;
        modal.style.setProperty("display", "none", "important");
      }
      setState("ready");
      emitTelemetry(block, "modal_closed");
      document.body.classList.remove("eyesaloon-tryon-modal-open");
    };

    openButton.addEventListener("click", () => {
      openModal();
    });

    copyButton?.addEventListener("click", async () => {
      const mobileUrl = getMobileUrl();

      try {
        await navigator.clipboard.writeText(mobileUrl);
        if (status) status.textContent = block.dataset.copySuccess || mobileUrl;
        emitTelemetry(block, "qr_copied");
      } catch {
        if (status) status.textContent = block.dataset.copyError || mobileUrl;
      }
    });

    selfieInput?.addEventListener("change", () => {
      const file = selfieInput.files?.[0];
      if (!file || !selfiePreview) return;

      const existingUrl = selfiePreview.dataset.objectUrl;
      if (existingUrl) URL.revokeObjectURL(existingUrl);

      const objectUrl = URL.createObjectURL(file);
      selfiePreview.dataset.objectUrl = objectUrl;
      selfiePreview.src = objectUrl;
      setState("selfie-preview");
      if (status) status.textContent = block.dataset.statusSelfiePreview || "";
      emitTelemetry(block, "selfie_uploaded");
    });

    cameraButton?.addEventListener("click", async () => {
      const capabilities = getCapabilities();

      if (!capabilities.camera || !capabilities.secureContext) {
        setState("no-camera");
        emitTelemetry(block, "camera_unavailable", {
          secure_context: capabilities.secureContext,
        });
        return;
      }

      syncPdValue(pdInput?.value || measurements.pdMm);
      setState("loading");
      emitTelemetry(block, "camera_requested");

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            height: { ideal: 720 },
            width: { ideal: 960 },
          },
        });

        if (video) {
          video.srcObject = stream;
          setState("active-camera");
          await withTimeout(video.play(), 5000, "Camera preview timed out.");
          emitTelemetry(block, "camera_granted");
        }

        const result = await withTimeout(startRuntime(), 12000, "Try-on runtime timed out.");
        if (!result?.ready) throw new Error("Try-on runtime could not start.");

        if (result.trackingAssetsReady) {
          if (result.mode === "3d" && !result.modelReady) {
            setState("model-error");
          } else {
            setState(result.modelReady ? "model-active" : "fit-active");
          }
        } else {
          setState("tracking-assets-missing");
        }
      } catch {
        const hadStream = Boolean(stream);
        stopRuntime();
        setState(hadStream ? "runtime-error" : "no-camera");
        emitTelemetry(block, hadStream ? "runtime_error" : "camera_denied");
      }
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeModal);
    });

    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal && !modal.hidden) closeModal();
    });

    const searchParams = new URLSearchParams(window.location.search);
    const urlPd = parsePd(searchParams.get("pd") || "");
    if (urlPd) syncPdValue(urlPd);

    if (searchParams.get(TRYON_PARAM) === "1") {
      openModal();
    }
  });
})();
