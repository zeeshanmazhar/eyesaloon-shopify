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
  const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150,
    136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  ];
  const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
  const LEFT_EYE = [362, 385, 387, 263, 373, 380];

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
      debug: next.debug,
      height: lerp(previous.height, next.height, amount),
      lensWidth: lerp(previous.lensWidth, next.lensWidth, amount),
      roll: lerp(previous.roll, next.roll, amount),
      width: lerp(previous.width, next.width, amount),
    };
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
    x: (1 - landmark.x) * width,
    y: landmark.y * height,
    z: landmark.z || 0,
  });

  const getLandmarkPath = (landmarks, indices, width, height) =>
    indices
      .map((index) => landmarks[index])
      .filter(Boolean)
      .map((landmark) => pointToCanvas(landmark, width, height));

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
    const frameWidthMm = toNumber(measurements.frameWidthMm);
    const fitScale = toNumber(measurements.fitScale) || 1;
    const xOffset = Number.parseFloat(measurements.xOffsetPct) || 0;
    const yOffset = Number.parseFloat(measurements.yOffsetPct) || 0;
    const measuredFrontMm = frameWidthMm || (lensWidthMm && bridgeMm ? lensWidthMm * 2 + bridgeMm + 12 : 0);
    const baseWidth = measuredFrontMm ? eyeOuterDistance * (measuredFrontMm / 92) : eyeOuterDistance * 1.48;
    const minWidth = eyeOuterDistance * 1.26;
    const maxWidth = faceWidth ? faceWidth * 0.98 : baseWidth * 1.18;
    const frameWidth = clamp(baseWidth * fitScale, Math.min(minWidth, maxWidth), Math.max(minWidth, maxWidth));
    const lensGapRatio = lensWidthMm && bridgeMm ? bridgeMm / (lensWidthMm * 2 + bridgeMm) : 0.14;
    const lensWidth = (frameWidth * (1 - lensGapRatio)) / 2;
    const bridgeWidth = frameWidth * lensGapRatio;
    const frameHeight = lensHeightMm && lensWidthMm ? lensWidth * (lensHeightMm / lensWidthMm) : lensWidth * 0.58;
    const center = midpoint(rightOuter, leftOuter);
    const bridgeBias = 0.36;
    const centerX = lerp(center.x, bridgePoint.x, 0.32) + frameWidth * (xOffset / 100);
    const centerY =
      lerp(center.y + frameHeight * 0.08, noseTip.y - frameHeight * bridgeBias, 0.42) + frameHeight * (yOffset / 100);

    return {
      bridgeWidth,
      centerX,
      centerY,
      debug: {
        bridgeMm,
        bridgePoint,
        eyeCenterDistance: distance(midpoint(rightInner, rightOuter), midpoint(leftInner, leftOuter)),
        eyeOuterDistance,
        faceLeft,
        faceRight,
        faceWidth,
        frameWidthMm: measuredFrontMm,
        mmPerPx: eyeOuterDistance ? 92 / eyeOuterDistance : 0,
        faceOval: getLandmarkPath(landmarks, FACE_OVAL, width, height),
        lensHeightMm,
        lensWidthMm,
        leftEye: getLandmarkPath(landmarks, LEFT_EYE, width, height),
        leftEyeCenter: midpoint(leftInner, leftOuter),
        leftInner,
        leftOuter,
        noseLength: distance(bridgePoint, noseTip),
        noseTip,
        rightEye: getLandmarkPath(landmarks, RIGHT_EYE, width, height),
        rightEyeCenter: midpoint(rightInner, rightOuter),
        rightInner,
        rightOuter,
      },
      height: frameHeight,
      lensWidth,
      roll,
      width: frameWidth,
    };
  };

  const drawCalibrationGrid = ({ context, height, width }) => {
    const majorStep = width / 4;
    const minorStep = width / 8;

    context.save();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(255, 255, 255, 0.22)";

    for (let x = minorStep; x < width; x += minorStep) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let y = minorStep; y < height; y += minorStep) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.strokeStyle = "rgba(41, 69, 255, 0.55)";
    context.lineWidth = 2;

    for (let x = majorStep; x < width; x += majorStep) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let y = height / 4; y < height; y += height / 4) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.restore();
  };

  const drawPoint = (context, point, label) => {
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fill();

    if (label) {
      context.fillText(label, point.x + 7, point.y - 7);
    }
  };

  const drawPath = (context, points, close = false) => {
    if (!points?.length) return;

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => {
      context.lineTo(point.x, point.y);
    });

    if (close) context.closePath();
    context.stroke();
  };

  const drawFaceLighting = ({ context, fit }) => {
    if (!fit?.debug?.faceLeft || !fit?.debug?.faceRight || !fit?.debug?.bridgePoint) return;

    const { bridgePoint, faceLeft, faceRight } = fit.debug;
    const faceWidth = distance(faceLeft, faceRight);
    const centerX = (faceLeft.x + faceRight.x) / 2;
    const centerY = bridgePoint.y + faceWidth * 0.2;
    const radiusX = faceWidth * 0.94;
    const radiusY = faceWidth * 1.12;

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = `blur(${Math.max(12, faceWidth * 0.08)}px)`;

    const glow = context.createRadialGradient(centerX, centerY - radiusY * 0.14, radiusX * 0.08, centerX, centerY, radiusY);
    glow.addColorStop(0, "rgba(255, 250, 238, 0.14)");
    glow.addColorStop(0.6, "rgba(255, 238, 212, 0.07)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");

    context.fillStyle = glow;
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();

    context.globalCompositeOperation = "soft-light";
    context.filter = `blur(${Math.max(18, faceWidth * 0.12)}px)`;
    context.fillStyle = "rgba(255, 236, 205, 0.08)";
    context.beginPath();
    context.ellipse(centerX, centerY + radiusY * 0.04, radiusX * 0.92, radiusY * 0.82, 0, 0, Math.PI * 2);
    context.fill();

    context.restore();
  };

  const drawCalibrationMeasurements = ({ context, fit, height, width }) => {
    if (!fit?.debug) return;

    const {
      bridgePoint,
      eyeCenterDistance,
      eyeOuterDistance,
      faceOval,
      faceLeft,
      faceRight,
      faceWidth,
      frameWidthMm,
      leftEye,
      leftEyeCenter,
      leftInner,
      leftOuter,
      mmPerPx,
      noseLength,
      noseTip,
      rightEye,
      rightEyeCenter,
      rightInner,
      rightOuter,
    } = fit.debug;
    const toMm = (value) => (mmPerPx ? Math.round(value * mmPerPx) : 0);
    const labelX = 12;
    const labelY = Math.max(20, height - 128);
    const rows = [
      `Face width: ${toMm(faceWidth)} mm (${Math.round(faceWidth)} px)`,
      `Eye outer: ${toMm(eyeOuterDistance)} mm (${Math.round(eyeOuterDistance)} px)`,
      `Eye centers: ${toMm(eyeCenterDistance)} mm (${Math.round(eyeCenterDistance)} px)`,
      `Nose axis: ${toMm(noseLength)} mm (${Math.round(noseLength)} px)`,
      `Frame target: ${toMm(fit.width)} mm (${Math.round(fit.width)} px)`,
      `Product frame: ${frameWidthMm ? `${Math.round(frameWidthMm)} mm` : "not set"}`,
    ];

    context.save();
    context.font = `${Math.max(12, width * 0.018)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    context.lineWidth = Math.max(2, width * 0.004);
    context.strokeStyle = "rgba(255, 255, 255, 0.92)";
    context.fillStyle = "rgba(41, 69, 255, 0.96)";

    context.strokeStyle = "rgba(41, 69, 255, 0.96)";
    context.lineWidth = Math.max(2.5, width * 0.005);
    drawPath(context, faceOval, true);

    context.strokeStyle = "rgba(255, 255, 255, 0.95)";
    context.lineWidth = Math.max(1.8, width * 0.0035);
    drawPath(context, rightEye, true);
    drawPath(context, leftEye, true);

    context.beginPath();
    context.moveTo(faceLeft.x, faceLeft.y);
    context.lineTo(faceRight.x, faceRight.y);
    context.stroke();

    context.strokeStyle = "rgba(0, 0, 0, 0.9)";
    context.beginPath();
    context.moveTo(rightOuter.x, rightOuter.y);
    context.lineTo(leftOuter.x, leftOuter.y);
    context.stroke();

    context.strokeStyle = "rgba(41, 69, 255, 0.96)";
    context.beginPath();
    context.moveTo(rightEyeCenter.x, rightEyeCenter.y);
    context.lineTo(leftEyeCenter.x, leftEyeCenter.y);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.96)";
    context.beginPath();
    context.moveTo(bridgePoint.x, bridgePoint.y);
    context.lineTo(noseTip.x, noseTip.y);
    context.stroke();

    context.strokeStyle = "rgba(0, 0, 0, 0.76)";
    context.beginPath();
    context.moveTo(fit.centerX, fit.centerY - fit.height / 2);
    context.lineTo(fit.centerX, fit.centerY + fit.height / 2);
    context.moveTo(fit.centerX - fit.width / 2, fit.centerY);
    context.lineTo(fit.centerX + fit.width / 2, fit.centerY);
    context.stroke();

    context.fillStyle = "rgba(41, 69, 255, 0.96)";
    drawPoint(context, faceLeft, "face L");
    drawPoint(context, faceRight, "face R");
    drawPoint(context, rightOuter, "eye R");
    drawPoint(context, leftOuter, "eye L");
    drawPoint(context, rightInner, "inner R");
    drawPoint(context, leftInner, "inner L");
    drawPoint(context, rightEyeCenter, "eye center R");
    drawPoint(context, leftEyeCenter, "eye center L");
    drawPoint(context, bridgePoint, "bridge");
    drawPoint(context, noseTip, "nose tip");

    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fillRect(labelX - 8, labelY - 16, Math.min(420, width - 24), 142);
    context.strokeStyle = "rgba(41, 69, 255, 0.9)";
    context.strokeRect(labelX - 8, labelY - 16, Math.min(420, width - 24), 142);
    context.fillStyle = "rgba(0, 0, 0, 0.88)";
    rows.forEach((row, index) => {
      context.fillText(row, labelX, labelY + index * 22);
    });

    context.restore();
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
      const calibrationOnly = true;
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
          drawCalibrationGrid({ context, height, width });

          if (modelRendererReady) {
            const renderedPreview = modelRenderer.renderPreview?.({
              height,
              width,
            });

            if (renderedPreview) {
              drawCalibrationGrid({ context, height, width });
              animationFrame = window.requestAnimationFrame(draw);
              return;
            }
          }

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
          drawFaceLighting({ context, fit: smoothedFit });
          drawCalibrationGrid({ context, height, width });
          drawCalibrationMeasurements({ context, fit: smoothedFit, height, width });
        } else {
          modelRenderer?.clear();
          drawCalibrationGrid({ context, height, width });
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

          if (faceLandmarker && !calibrationOnly) {
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
          if (rendererCanvas) rendererCanvas.hidden = true;
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
