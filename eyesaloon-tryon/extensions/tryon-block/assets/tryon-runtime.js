(() => {
  const LANDMARKS = {
    rightEyeOuter: 33,
    rightEyeInner: 133,
    leftEyeInner: 362,
    leftEyeOuter: 263,
    noseBridge: 168,
    noseTip: 1,
    faceLeft: 234,
    faceRight: 454,
  };

  let faceLandmarkerPromise = null;
  let frameRendererPromise = null;

  const fetchTrackingManifest = async (manifestUrl) => {
    if (!manifestUrl) return { ready: false };

    try {
      const response = await fetch(manifestUrl, {
        credentials: "omit",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return { ready: false };

      const manifest = await response.json();
      return {
        manifest,
        ready: manifest.status === "ready",
      };
    } catch {
      return { ready: false };
    }
  };

  const joinAssetUrl = (basePath, assetPath) => {
    if (!basePath || !assetPath) return "";
    return `${basePath.replace(/\/$/, "")}/${assetPath.replace(/^\//, "")}`;
  };

  const toNumber = (value) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const midpoint = (a, b) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2,
  });

  const lerp = (from, to, amount) => from + (to - from) * amount;

  const smoothFit = (previous, next) => {
    if (!previous) return next;

    const amount = 0.34;
    return {
      bridgeWidth: lerp(previous.bridgeWidth, next.bridgeWidth, amount),
      centerX: lerp(previous.centerX, next.centerX, amount),
      centerY: lerp(previous.centerY, next.centerY, amount),
      height: lerp(previous.height, next.height, amount),
      lensWidth: lerp(previous.lensWidth, next.lensWidth, amount),
      roll: lerp(previous.roll, next.roll, amount),
      width: lerp(previous.width, next.width, amount),
    };
  };

  const getAssetPath = (manifest, key) => manifest?.files?.[key]?.path || "";

  const loadFrameRenderer = (src) => {
    if (window.EyesaloonTryOnFrameRenderer) return Promise.resolve(window.EyesaloonTryOnFrameRenderer);
    if (!src) return Promise.reject(new Error("Missing try-on renderer URL."));
    if (frameRendererPromise) return frameRendererPromise;

    frameRendererPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.onload = () => {
        if (window.EyesaloonTryOnFrameRenderer) {
          resolve(window.EyesaloonTryOnFrameRenderer);
        } else {
          reject(new Error("Try-on renderer did not initialize."));
        }
      };
      script.onerror = () => reject(new Error("Try-on renderer failed to load."));
      document.head.append(script);
    });

    return frameRendererPromise;
  };

  const loadFaceLandmarker = async (manifest) => {
    if (faceLandmarkerPromise) return faceLandmarkerPromise;

    faceLandmarkerPromise = (async () => {
      const assetBasePath = manifest.assetBasePath || "";
      const visionBundleUrl = joinAssetUrl(assetBasePath, getAssetPath(manifest, "visionBundle"));
      const modelUrl = joinAssetUrl(assetBasePath, getAssetPath(manifest, "faceLandmarkerModel"));

      if (!visionBundleUrl || !modelUrl) {
        throw new Error("Missing MediaPipe vision bundle or face landmarker model URL.");
      }

      const { FaceLandmarker, FilesetResolver } = await import(visionBundleUrl);
      const vision = await FilesetResolver.forVisionTasks(joinAssetUrl(assetBasePath, "wasm"));

      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: "CPU",
        },
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: "VIDEO",
      });
    })();

    return faceLandmarkerPromise;
  };

  const pointToCanvas = (landmark, width, height) => ({
    x: landmark.x * width,
    y: landmark.y * height,
    z: landmark.z || 0,
  });

  const getMeasuredFit = ({ height, landmarks, measurements, width }) => {
    const rightOuter = pointToCanvas(landmarks[LANDMARKS.rightEyeOuter], width, height);
    const leftOuter = pointToCanvas(landmarks[LANDMARKS.leftEyeOuter], width, height);
    const rightInner = pointToCanvas(landmarks[LANDMARKS.rightEyeInner], width, height);
    const leftInner = pointToCanvas(landmarks[LANDMARKS.leftEyeInner], width, height);
    const faceLeft = pointToCanvas(landmarks[LANDMARKS.faceLeft], width, height);
    const faceRight = pointToCanvas(landmarks[LANDMARKS.faceRight], width, height);
    const bridgePoint = landmarks[LANDMARKS.noseBridge]
      ? pointToCanvas(landmarks[LANDMARKS.noseBridge], width, height)
      : midpoint(rightInner, leftInner);
    const noseTip = landmarks[LANDMARKS.noseTip]
      ? pointToCanvas(landmarks[LANDMARKS.noseTip], width, height)
      : bridgePoint;

    const eyeOuterDistance = distance(rightOuter, leftOuter);
    const faceWidth = distance(faceLeft, faceRight);
    const roll = Math.atan2(leftOuter.y - rightOuter.y, leftOuter.x - rightOuter.x);
    const lensWidthMm = toNumber(measurements.lensWidthMm);
    const bridgeMm = toNumber(measurements.bridgeMm);
    const lensHeightMm = toNumber(measurements.lensHeightMm);
    const measuredFrontMm = lensWidthMm && bridgeMm ? lensWidthMm * 2 + bridgeMm : 0;
    const baseWidth = measuredFrontMm ? eyeOuterDistance * (measuredFrontMm / 92) : eyeOuterDistance * 1.48;
    const widthFromFace = faceWidth ? faceWidth * 0.86 : baseWidth;
    const frameWidth = Math.min(Math.max(baseWidth, eyeOuterDistance * 1.28), widthFromFace * 1.08);
    const lensGapRatio = lensWidthMm && bridgeMm ? bridgeMm / (lensWidthMm * 2 + bridgeMm) : 0.14;
    const lensWidth = (frameWidth * (1 - lensGapRatio)) / 2;
    const bridgeWidth = frameWidth * lensGapRatio;
    const frameHeight = lensHeightMm && lensWidthMm ? lensWidth * (lensHeightMm / lensWidthMm) : lensWidth * 0.58;
    const center = midpoint(rightOuter, leftOuter);
    const bridgeBias = 0.36;

    return {
      bridgeWidth,
      centerX: lerp(center.x, bridgePoint.x, 0.32),
      centerY: lerp(center.y + frameHeight * 0.08, noseTip.y - frameHeight * bridgeBias, 0.42),
      height: frameHeight,
      lensWidth,
      roll,
      width: frameWidth,
    };
  };

  const drawFallbackOverlay = ({ context, height, width }) => {
    const centerX = width / 2;
    const centerY = height * 0.44;
    const lensWidth = width * 0.22;
    const lensHeight = lensWidth * 0.55;
    const gap = width * 0.045;

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.88)";
    context.lineWidth = Math.max(2, width * 0.004);
    context.shadowColor = "rgba(0, 0, 0, 0.28)";
    context.shadowBlur = Math.max(4, width * 0.01);

    context.beginPath();
    context.ellipse(centerX - lensWidth / 2 - gap, centerY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
    context.ellipse(centerX + lensWidth / 2 + gap, centerY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
    context.moveTo(centerX - gap, centerY);
    context.lineTo(centerX + gap, centerY);
    context.stroke();
    context.restore();
  };

  const drawTrackedFrame = ({ context, fit, width }) => {
    const lensRadiusX = fit.lensWidth / 2;
    const lensRadiusY = fit.height / 2;
    const leftCenterX = -fit.bridgeWidth / 2 - lensRadiusX;
    const rightCenterX = fit.bridgeWidth / 2 + lensRadiusX;
    const lineWidth = Math.max(2.4, width * 0.006);

    context.save();
    context.translate(fit.centerX, fit.centerY);
    context.rotate(fit.roll);
    context.strokeStyle = "rgba(41, 69, 255, 0.94)";
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = "rgba(0, 0, 0, 0.28)";
    context.shadowBlur = Math.max(5, width * 0.012);

    context.beginPath();
    context.ellipse(leftCenterX, 0, lensRadiusX, lensRadiusY, 0, 0, Math.PI * 2);
    context.ellipse(rightCenterX, 0, lensRadiusX, lensRadiusY, 0, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.moveTo(-fit.bridgeWidth / 2, -fit.height * 0.08);
    context.quadraticCurveTo(0, -fit.height * 0.23, fit.bridgeWidth / 2, -fit.height * 0.08);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.42)";
    context.lineWidth = Math.max(1.2, lineWidth * 0.42);
    context.beginPath();
    context.ellipse(leftCenterX, 0, lensRadiusX * 0.86, lensRadiusY * 0.82, 0, 0, Math.PI * 2);
    context.ellipse(rightCenterX, 0, lensRadiusX * 0.86, lensRadiusY * 0.82, 0, 0, Math.PI * 2);
    context.stroke();

    context.restore();
  };

  const runtimeApi = {
    create({ block, canvas, measurements = {}, modelUrl, rendererCanvas, rendererSrc, trackingManifestUrl, video }) {
      let animationFrame = 0;
      let destroyed = false;
      let faceLandmarker = null;
      let lastVideoTime = -1;
      let modelRenderer = null;
      let modelRendererReady = false;
      let smoothedFit = null;
      let trackingManifest = null;
      const context = canvas?.getContext("2d", { alpha: true });

      const resizeCanvas = () => {
        if (!canvas || !video) return false;

        const width = video.videoWidth || video.clientWidth;
        const height = video.videoHeight || video.clientHeight;

        if (!width || !height) return false;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          smoothedFit = null;
        }

        if (rendererCanvas) {
          if (rendererCanvas.width !== width || rendererCanvas.height !== height) {
            rendererCanvas.width = width;
            rendererCanvas.height = height;
          }
        }

        return true;
      };

      const loadModelRenderer = async () => {
        if (!rendererCanvas || !modelUrl) return false;

        const rendererLibrary = await loadFrameRenderer(rendererSrc);

        modelRenderer = rendererLibrary.createFrameRenderer({
          canvas: rendererCanvas,
          modelUrl,
        });

        modelRendererReady = await modelRenderer.load();
        return modelRendererReady;
      };

      const draw = () => {
        if (destroyed || !context || !resizeCanvas()) {
          animationFrame = window.requestAnimationFrame(draw);
          return;
        }

        const { width, height } = canvas;
        context.clearRect(0, 0, width, height);

        if (!faceLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          drawFallbackOverlay({ context, height, width });
          animationFrame = window.requestAnimationFrame(draw);
          return;
        }

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          let landmarks = null;

          try {
            const result = faceLandmarker.detectForVideo(video, performance.now());
            landmarks = result.faceLandmarks?.[0] || null;
          } catch {
            landmarks = null;
          }

          if (landmarks?.[LANDMARKS.rightEyeOuter] && landmarks?.[LANDMARKS.leftEyeOuter]) {
            const nextFit = getMeasuredFit({ height, landmarks, measurements, width });
            smoothedFit = smoothFit(smoothedFit, nextFit);
          }
        }

        if (smoothedFit) {
          const renderedModel = modelRendererReady
            ? modelRenderer.renderFit(smoothedFit, {
                height,
                width,
              })
            : false;

          if (!renderedModel) {
            drawTrackedFrame({ context, fit: smoothedFit, width });
          } else {
            context.clearRect(0, 0, width, height);
          }
        } else {
          modelRenderer?.clear();
          drawFallbackOverlay({ context, height, width });
        }

        animationFrame = window.requestAnimationFrame(draw);
      };

      return {
        async start() {
          if (!canvas || !video || !context) return false;

          const trackingAssets = await fetchTrackingManifest(trackingManifestUrl);
          trackingManifest = trackingAssets.manifest || null;

          if (trackingAssets.ready) {
            faceLandmarker = await loadFaceLandmarker(trackingAssets.manifest);
          }

          if (faceLandmarker) {
            try {
              await loadModelRenderer();
            } catch (error) {
              console.warn("Eyesaloon try-on 3D model failed to load.", {
                error,
                modelUrl,
                rendererSrc,
              });
              modelRendererReady = false;
              modelRenderer?.destroy();
              modelRenderer = null;
              block?.dispatchEvent(
                new CustomEvent("eyesaloon:tryon-model-error", {
                  bubbles: true,
                  detail: {
                    message: error?.message || "Model renderer failed to load.",
                    modelUrl,
                  },
                }),
              );
            }
          }

          destroyed = false;
          canvas.hidden = false;
          if (rendererCanvas) rendererCanvas.hidden = !modelRendererReady;
          draw();

          return {
            modelReady: modelRendererReady,
            ready: true,
            trackingAssetsReady: Boolean(faceLandmarker),
          };
        },
        destroy() {
          destroyed = true;
          window.cancelAnimationFrame(animationFrame);
          modelRenderer?.destroy();
          modelRenderer = null;
          modelRendererReady = false;
          smoothedFit = null;

          if (context && canvas) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.hidden = true;
          }

          if (rendererCanvas) {
            rendererCanvas.hidden = true;
          }
        },
        getTrackingManifest() {
          return trackingManifest;
        },
      };
    },
  };

  window.EyesaloonTryOnRuntime = runtimeApi;
})();
