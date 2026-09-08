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
  const AVERAGE_EYE_OUTER_MM = 92;
  const AVERAGE_IRIS_DIAMETER_MM = 11.7;
  const CALIBRATION_FRAME_TARGET = 24;
  const CALIBRATION_STABLE_MS = 850;
  const CALIBRATION_MAX_GAP_MS = 280;
  const RIGHT_IRIS = [468, 469, 470, 471, 472];
  const LEFT_IRIS = [473, 474, 475, 476, 477];

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

  const emitRuntimeEvent = (block, name, detail = {}) => {
    block?.dispatchEvent(
      new CustomEvent(`eyesaloon:tryon-${name}`, {
        bubbles: true,
        detail,
      }),
    );
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

    const amount = next.debug?.quality?.score > 0.82 ? 0.3 : 0.2;
    return {
      bridgeWidth: lerp(previous.bridgeWidth, next.bridgeWidth, amount),
      centerX: lerp(previous.centerX, next.centerX, amount),
      centerY: lerp(previous.centerY, next.centerY, amount),
      debug: next.debug,
      height: lerp(previous.height, next.height, amount),
      lensWidth: lerp(previous.lensWidth, next.lensWidth, amount),
      pitch: lerp(previous.pitch || 0, next.pitch || 0, amount),
      roll: lerp(previous.roll, next.roll, amount),
      width: lerp(previous.width, next.width, amount),
      yaw: lerp(previous.yaw || 0, next.yaw || 0, amount),
    };
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const median = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted[Math.floor(sorted.length / 2)];
  };

  const medianAbsoluteDeviation = (values) => {
    const center = median(values);
    if (!center) return 0;
    return median(values.map((value) => Math.abs(value - center))) / center;
  };

  const getPointCenter = (points) => {
    const visible = points.filter(Boolean);
    if (!visible.length) return null;

    return {
      x: visible.reduce((total, point) => total + point.x, 0) / visible.length,
      y: visible.reduce((total, point) => total + point.y, 0) / visible.length,
      z: visible.reduce((total, point) => total + (point.z || 0), 0) / visible.length,
    };
  };

  const getIrisData = (landmarks, width, height) => {
    const rightPoints = getLandmarkPath(landmarks, RIGHT_IRIS, width, height);
    const leftPoints = getLandmarkPath(landmarks, LEFT_IRIS, width, height);
    const rightCenter = rightPoints[0] || getPointCenter(rightPoints);
    const leftCenter = leftPoints[0] || getPointCenter(leftPoints);

    if (!rightCenter || !leftCenter || rightPoints.length < 5 || leftPoints.length < 5) {
      return null;
    }

    const rightDiameter = (distance(rightPoints[1], rightPoints[3]) + distance(rightPoints[2], rightPoints[4])) / 2;
    const leftDiameter = (distance(leftPoints[1], leftPoints[3]) + distance(leftPoints[2], leftPoints[4])) / 2;
    const diameter = (rightDiameter + leftDiameter) / 2;

    if (!Number.isFinite(diameter) || diameter < width * 0.006 || diameter > width * 0.06) {
      return null;
    }

    return {
      diameter,
      leftCenter,
      leftPoints,
      rightCenter,
      rightPoints,
    };
  };

  const getAssetPath = (manifest, key) => manifest?.files?.[key]?.path || "";

  const getFaceMatrixData = (matrix) => {
    if (!matrix) return null;
    if (Array.isArray(matrix)) return matrix;
    if (matrix.data && Array.isArray(matrix.data)) return matrix.data;
    if (matrix.data && typeof matrix.data.length === "number") return Array.from(matrix.data);
    if (typeof matrix.getAsFloat32Array === "function") return Array.from(matrix.getAsFloat32Array());
    return null;
  };

  const getFacePose = (matrix) => {
    const data = getFaceMatrixData(matrix);
    if (!data || data.length < 16) return null;

    return {
      pitch: Math.atan2(data[9], data[10]),
      roll: Math.atan2(data[1], data[0]),
      scale: Math.hypot(data[0], data[1], data[2]),
      x: data[12] || 0,
      y: data[13] || 0,
      yaw: Math.atan2(-data[8], Math.hypot(data[0], data[4])),
      z: data[14] || 0,
    };
  };

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

  const loadFrameImage = (src) => {
    if (!src) return Promise.resolve(null);

    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
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
        outputFacialTransformationMatrixes: true,
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

  const getGuideOval = ({ height, width }) => {
    const radiusX = Math.min(width * 0.28, height * 0.28);
    const radiusY = Math.min(height * 0.38, width * 0.38);

    return {
      centerX: width / 2,
      centerY: height * 0.47,
      radiusX,
      radiusY,
    };
  };

  const getGuideFitState = ({ fit, height, width }) => {
    const oval = getGuideOval({ height, width });
    if (!fit?.debug) {
      return {
        accepted: false,
        message: "Place your face inside the oval",
        oval,
      };
    }

    const faceCenterX = (fit.debug.faceLeft.x + fit.debug.faceRight.x) / 2;
    const faceCenterY = fit.debug.bridgePoint.y + fit.debug.faceWidth * 0.22;
    const normalizedX = Math.abs(faceCenterX - oval.centerX) / oval.radiusX;
    const normalizedY = Math.abs(faceCenterY - oval.centerY) / oval.radiusY;
    const faceWidthRatio = fit.debug.faceWidth / (oval.radiusX * 2);
    const centered = normalizedX < 0.34 && normalizedY < 0.34;
    const goodSize = faceWidthRatio > 0.58 && faceWidthRatio < 0.98;

    if (!fit.debug.quality?.accepted) {
      return {
        accepted: false,
        message: fit.debug.quality?.issues?.[0] || "Hold your face steady",
        oval,
      };
    }

    if (!centered) {
      return {
        accepted: false,
        message: "Center your face in the oval",
        oval,
      };
    }

    if (!goodSize) {
      return {
        accepted: false,
        message: faceWidthRatio <= 0.58 ? "Move closer" : "Move back",
        oval,
      };
    }

    return {
      accepted: true,
      message: "Hold still",
      oval,
    };
  };

  const getMedianFit = (fits) => {
    const lastFit = fits[fits.length - 1];
    if (!lastFit) return null;

    return {
      ...lastFit,
      bridgeWidth: median(fits.map((fit) => fit.bridgeWidth)),
      centerX: median(fits.map((fit) => fit.centerX)),
      centerY: median(fits.map((fit) => fit.centerY)),
      debug: {
        ...lastFit.debug,
        calibrationComplete: true,
        quality: {
          ...lastFit.debug.quality,
          label: "locked",
          score: median(fits.map((fit) => fit.debug?.quality?.score || 0)),
        },
      },
      height: median(fits.map((fit) => fit.height)),
      lensWidth: median(fits.map((fit) => fit.lensWidth)),
      pitch: median(fits.map((fit) => fit.pitch || 0)),
      roll: median(fits.map((fit) => fit.roll)),
      width: median(fits.map((fit) => fit.width)),
      yaw: median(fits.map((fit) => fit.yaw || 0)),
    };
  };

  const getCalibrationStability = (frames) => {
    const checks = [
      ["face width", frames.map((fit) => fit.debug?.faceWidth || 0), 0.028],
      ["eye distance", frames.map((fit) => fit.debug?.eyeCenterDistance || 0), 0.025],
      ["center x", frames.map((fit) => fit.centerX || 0), 0.025],
      ["center y", frames.map((fit) => fit.centerY || 0), 0.03],
      ["roll", frames.map((fit) => Math.abs(fit.roll || 0) + 1), 0.018],
      ["yaw", frames.map((fit) => Math.abs(fit.debug?.matrixPose?.yaw || 0) + 1), 0.018],
    ];
    const failures = checks
      .map(([label, values, limit]) => ({ label, spread: medianAbsoluteDeviation(values), limit }))
      .filter((check) => check.spread > check.limit);

    return {
      accepted: failures.length === 0,
      failures,
      label: failures.length ? `Hold steady: ${failures[0].label}` : "stable",
    };
  };

  const getMeasurementProfile = ({ fit, mode }) => {
    if (!fit?.debug?.mmPerPx) return null;

    const toMm = (value) => Math.round(value * fit.debug.mmPerPx * 10) / 10;
    const faceWidthMm = toMm(fit.debug.faceWidth);
    const eyeCenterDistanceMm = toMm(fit.debug.eyeCenterDistance);
    const eyeOuterDistanceMm = toMm(fit.debug.eyeOuterDistance);
    const noseLengthMm = toMm(fit.debug.noseLength);

    return {
      calibrated: Boolean(fit.debug.pdMm || fit.debug.scaleSource === "iris"),
      confidence: fit.debug.quality?.label || "locked",
      createdAt: new Date().toISOString(),
      eyeCenterDistanceMm,
      eyeOuterDistanceMm,
      faceToEyeRatio: eyeCenterDistanceMm ? Math.round((faceWidthMm / eyeCenterDistanceMm) * 1000) / 1000 : 0,
      faceWidthMm,
      mode,
      noseLengthMm,
      pdMm: fit.debug.pdMm || 0,
      scaleSource: fit.debug.scaleSource || "estimated",
      version: 1,
    };
  };

  const getFitQuality = ({ bridgePoint, eyeCenter, eyeOuterDistance, faceWidth, height, matrixPose, roll, width }) => {
    const issues = [];
    const faceWidthRatio = faceWidth / width;
    const eyeWidthRatio = eyeOuterDistance / width;
    const rollAbs = Math.abs(roll);
    const noseOffsetRatio = eyeOuterDistance ? Math.abs(bridgePoint.x - eyeCenter.x) / eyeOuterDistance : 1;
    const faceToEyeRatio = eyeOuterDistance ? faceWidth / eyeOuterDistance : 0;
    const yawAbs = matrixPose ? Math.abs(matrixPose.yaw) : noseOffsetRatio;

    if (eyeOuterDistance < width * 0.11) issues.push("move closer");
    if (eyeOuterDistance > width * 0.48) issues.push("move back");
    if (faceWidthRatio < 0.2 || faceWidthRatio > 0.84) issues.push("center face");
    if (faceToEyeRatio < 1.25 || faceToEyeRatio > 2.35) issues.push("face angle");
    if (rollAbs > 0.32) issues.push("level head");
    if (yawAbs > 0.42 || noseOffsetRatio > 0.3) issues.push("look straight");

    const distanceScore = clamp(1 - Math.abs(eyeWidthRatio - 0.24) / 0.22, 0, 1);
    const rollScore = clamp(1 - rollAbs / 0.32, 0, 1);
    const yawScore = clamp(1 - Math.max(yawAbs / 0.42, noseOffsetRatio / 0.3), 0, 1);
    const ratioScore = clamp(1 - Math.abs(faceToEyeRatio - 1.65) / 0.7, 0, 1);
    const score = clamp(distanceScore * 0.3 + rollScore * 0.24 + yawScore * 0.28 + ratioScore * 0.18, 0, 1);

    return {
      accepted: score >= 0.42 && issues.length <= 2 && eyeOuterDistance > 0 && faceWidth > 0 && height > 0,
      issues,
      label: score > 0.78 ? "high" : score > 0.58 ? "medium" : "low",
      score,
    };
  };

  const getMeasuredFit = ({ height, landmarks, matrix, measurements, width }) => {
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
    const rightEyeCenter = midpoint(rightInner, rightOuter);
    const leftEyeCenter = midpoint(leftInner, leftOuter);
    const iris = getIrisData(landmarks, width, height);
    const rightPupilCenter = iris?.rightCenter || rightEyeCenter;
    const leftPupilCenter = iris?.leftCenter || leftEyeCenter;

    const eyeOuterDistance = distance(rightOuter, leftOuter);
    const eyeCenterDistance = distance(rightPupilCenter, leftPupilCenter);
    const faceWidth = distance(faceLeft, faceRight);
    const roll = Math.atan2(leftOuter.y - rightOuter.y, leftOuter.x - rightOuter.x);
    const eyeCenter = midpoint(rightPupilCenter, leftPupilCenter);
    const matrixPose = getFacePose(matrix);
    const lensWidthMm = toNumber(measurements.lensWidthMm);
    const bridgeMm = toNumber(measurements.bridgeMm);
    const lensHeightMm = toNumber(measurements.lensHeightMm);
    const frameWidthMm = toNumber(measurements.frameWidthMm);
    const pdMm = toNumber(measurements.pdMm);
    const fitScale = toNumber(measurements.fitScale) || 1;
    const xOffset = Number.parseFloat(measurements.xOffsetPct) || 0;
    const yOffset = Number.parseFloat(measurements.yOffsetPct) || 0;
    const measuredFrontMm = frameWidthMm || (lensWidthMm && bridgeMm ? lensWidthMm * 2 + bridgeMm + 12 : 0);
    const irisScaleAvailable = !pdMm && iris?.diameter;
    const scalePixelDistance = pdMm && eyeCenterDistance ? eyeCenterDistance : irisScaleAvailable ? iris.diameter : eyeOuterDistance;
    const scaleReferenceMm = pdMm || (irisScaleAvailable ? AVERAGE_IRIS_DIAMETER_MM : AVERAGE_EYE_OUTER_MM);
    const scaleSource = pdMm ? "pd" : irisScaleAvailable ? "iris" : "estimated";
    const baseWidth = measuredFrontMm ? scalePixelDistance * (measuredFrontMm / scaleReferenceMm) : eyeOuterDistance * 1.48;
    const minWidth = eyeOuterDistance * 1.26;
    const maxWidth = faceWidth ? faceWidth * 0.98 : baseWidth * 1.18;
    const frameWidth = clamp(baseWidth * fitScale, Math.min(minWidth, maxWidth), Math.max(minWidth, maxWidth));
    const lensGapRatio = lensWidthMm && bridgeMm ? bridgeMm / (lensWidthMm * 2 + bridgeMm) : 0.14;
    const lensWidth = (frameWidth * (1 - lensGapRatio)) / 2;
    const bridgeWidth = frameWidth * lensGapRatio;
    const frameHeight = lensHeightMm && lensWidthMm ? lensWidth * (lensHeightMm / lensWidthMm) : lensWidth * 0.58;
    const bridgeBias = 0.36;
    const centerX = lerp(eyeCenter.x, bridgePoint.x, 0.32) + frameWidth * (xOffset / 100);
    const centerY =
      lerp(eyeCenter.y + frameHeight * 0.08, noseTip.y - frameHeight * bridgeBias, 0.42) + frameHeight * (yOffset / 100);
    const quality = getFitQuality({
      bridgePoint,
      eyeCenter,
      eyeOuterDistance,
      faceWidth,
      height,
      matrixPose,
      roll,
      width,
    });

    return {
      bridgeWidth,
      centerX,
      centerY,
      debug: {
        bridgeMm,
        bridgePoint,
        eyeCenterDistance,
        eyeOuterDistance,
        faceLeft,
        faceRight,
        faceWidth,
        frameWidthMm: measuredFrontMm,
        irisDiameter: iris?.diameter || 0,
        irisScaleAvailable: Boolean(irisScaleAvailable),
        matrixPose,
        mmPerPx: scalePixelDistance ? scaleReferenceMm / scalePixelDistance : 0,
        faceOval: getLandmarkPath(landmarks, FACE_OVAL, width, height),
        lensHeightMm,
        lensWidthMm,
        leftEye: getLandmarkPath(landmarks, LEFT_EYE, width, height),
        leftEyeCenter: leftPupilCenter,
        leftIris: iris?.leftPoints || [],
        leftInner,
        leftOuter,
        noseLength: distance(bridgePoint, noseTip),
        noseTip,
        pdMm,
        quality,
        rightEye: getLandmarkPath(landmarks, RIGHT_EYE, width, height),
        rightEyeCenter: rightPupilCenter,
        rightIris: iris?.rightPoints || [],
        rightInner,
        rightOuter,
        scaleSource,
      },
      height: frameHeight,
      lensWidth,
      pitch: matrixPose?.pitch || 0,
      roll,
      width: frameWidth,
      yaw: matrixPose?.yaw || 0,
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

  const drawGuidedCalibration = ({ context, fit, height, message, progress, width }) => {
    const { accepted, oval } = getGuideFitState({ fit, height, width });
    const lineWidth = Math.max(3, width * 0.006);
    const progressEnd = -Math.PI / 2 + Math.PI * 2 * clamp(progress, 0, 1);

    context.save();
    context.lineCap = "round";
    context.shadowColor = "rgba(0, 0, 0, 0.22)";
    context.shadowBlur = Math.max(6, width * 0.012);
    context.strokeStyle = accepted ? "rgba(63, 210, 146, 0.92)" : "rgba(255, 255, 255, 0.86)";
    context.lineWidth = lineWidth;
    context.beginPath();
    context.ellipse(oval.centerX, oval.centerY, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = "rgba(41, 69, 255, 0.96)";
    context.lineWidth = lineWidth + 1;
    context.beginPath();
    context.ellipse(oval.centerX, oval.centerY, oval.radiusX + lineWidth * 1.4, oval.radiusY + lineWidth * 1.4, 0, -Math.PI / 2, progressEnd);
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(0, 0, 0, 0.56)";
    context.fillRect(width * 0.5 - Math.min(260, width * 0.38), 14, Math.min(520, width * 0.76), 38);
    context.fillStyle = "rgba(255, 255, 255, 0.96)";
    context.font = `${Math.max(13, width * 0.02)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message || (progress >= 1 ? "Face scan ready" : "Place your face inside the oval"), width / 2, 33);
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
      leftIris,
      leftInner,
      leftOuter,
      mmPerPx,
      noseLength,
      noseTip,
      pdMm,
      quality,
      rightEye,
      rightEyeCenter,
      rightIris,
      rightInner,
      rightOuter,
      scaleSource,
    } = fit.debug;
    const toMm = (value) => (mmPerPx ? Math.round(value * mmPerPx) : 0);
    const unitLabel = pdMm ? "PD mm" : scaleSource === "iris" ? "iris-est. mm" : "est. mm";
    const issueLabel = quality?.issues?.length ? ` (${quality.issues.slice(0, 2).join(", ")})` : "";
    const labelX = 12;
    const labelY = Math.max(20, height - 150);
    const rows = [
      `AI tracking: ${quality?.label || "checking"}${issueLabel}`,
      `Face width: ${toMm(faceWidth)} ${unitLabel} (${Math.round(faceWidth)} px)`,
      `Eye outer: ${toMm(eyeOuterDistance)} ${unitLabel} (${Math.round(eyeOuterDistance)} px)`,
      `Eye centers: ${toMm(eyeCenterDistance)} ${unitLabel} (${Math.round(eyeCenterDistance)} px)`,
      `Nose axis: ${toMm(noseLength)} ${unitLabel} (${Math.round(noseLength)} px)`,
      `Frame target: ${toMm(fit.width)} ${unitLabel} (${Math.round(fit.width)} px)`,
      `Product frame: ${frameWidthMm ? `${Math.round(frameWidthMm)} mm` : "not set"}`,
      `Scale source: ${scaleSource || "estimated"}`,
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
    drawPath(context, rightIris, true);
    drawPath(context, leftIris, true);

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
    context.fillRect(labelX - 8, labelY - 16, Math.min(420, width - 24), 164);
    context.strokeStyle = "rgba(41, 69, 255, 0.9)";
    context.strokeRect(labelX - 8, labelY - 16, Math.min(420, width - 24), 164);
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

  const drawFrameImageOverlay = ({ context, fit, image }) => {
    if (!fit || !image) return false;

    const imageAspect = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 3.2;
    const drawWidth = fit.width;
    const drawHeight = Math.max(fit.height, drawWidth / imageAspect);

    context.save();
    context.translate(fit.centerX, fit.centerY);
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();

    return true;
  };

  const runtimeApi = {
    create({ block, canvas, frameImageUrl, measurements = {}, mode = "unavailable", modelUrl, rendererCanvas, rendererSrc, trackingManifestUrl, video }) {
      let animationFrame = 0;
      let destroyed = false;
      let faceLandmarker = null;
      let frameImage = null;
      let guideFit = null;
      let lastVideoTime = -1;
      let modelRenderer = null;
      let modelRendererReady = false;
      let profileDispatched = false;
      let scanStartedDispatched = false;
      let overlayRenderedDispatched = false;
      let smoothedFit = null;
      let trackingManifest = null;
      const calibration = {
        complete: false,
        frames: [],
        lastAcceptedAt: 0,
        message: "Place your face inside the oval",
        progress: 0,
        startedAt: 0,
      };
      const requestedMode = mode === "2d" && frameImageUrl ? "2d" : modelUrl ? "3d" : frameImageUrl ? "2d" : mode;
      const context = canvas?.getContext("2d", { alpha: true });

      const resizeCanvas = () => {
        if (!canvas || !video) return false;

        const width = video.videoWidth || video.clientWidth;
        const height = video.videoHeight || video.clientHeight;

        if (!width || !height) return false;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          guideFit = null;
          smoothedFit = null;
          calibration.complete = false;
          calibration.frames = [];
          calibration.lastAcceptedAt = 0;
          calibration.message = "Place your face inside the oval";
          calibration.progress = 0;
          calibration.startedAt = 0;
          profileDispatched = false;
          scanStartedDispatched = false;
          overlayRenderedDispatched = false;
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

      const drawCurrentFit = ({ fit, height, width }) => {
        drawFaceLighting({ context, fit });
        drawCalibrationGrid({ context, height, width });

        if (!calibration.complete) {
          drawGuidedCalibration({
            context,
            fit,
            height,
            message: calibration.message,
            progress: calibration.progress,
            width,
          });
        } else if (frameImage) {
          drawFrameImageOverlay({ context, fit, image: frameImage });
        } else {
          drawCalibrationMeasurements({ context, fit, height, width });
        }

        if (modelRendererReady) {
          const rendered = modelRenderer.renderFit?.(fit, { height, width });
          if (!rendered && rendererCanvas) rendererCanvas.hidden = true;
        }

        if (calibration.complete && !overlayRenderedDispatched) {
          emitRuntimeEvent(block, "overlay-rendered", {
            mode: modelRendererReady ? "3d" : frameImage ? "2d" : "fit",
            scaleSource: fit.debug?.scaleSource || "estimated",
          });
          overlayRenderedDispatched = true;
        }
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

          if (frameImage) {
            context.save();
            const previewWidth = width * 0.58;
            const imageAspect = frameImage.naturalWidth && frameImage.naturalHeight ? frameImage.naturalWidth / frameImage.naturalHeight : 3.2;
            context.drawImage(frameImage, (width - previewWidth) / 2, height * 0.38, previewWidth, previewWidth / imageAspect);
            context.restore();
          } else {
            drawFallbackOverlay({ context, height, width });
          }
          drawGuidedCalibration({
            context,
            fit: null,
            height,
            message: calibration.message,
            progress: calibration.progress,
            width,
          });
          animationFrame = window.requestAnimationFrame(draw);
          return;
        }

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          let landmarks = null;
          let matrix = null;

          try {
            const result = faceLandmarker.detectForVideo(video, performance.now());
            landmarks = result.faceLandmarks?.[0] || null;
            matrix = result.facialTransformationMatrixes?.[0] || null;
          } catch {
            landmarks = null;
            matrix = null;
          }

          if (landmarks?.[LANDMARKS.rightEyeOuter] && landmarks?.[LANDMARKS.leftEyeOuter]) {
            const nextFit = getMeasuredFit({ height, landmarks, matrix, measurements, width });
            guideFit = nextFit;

            if (!calibration.complete) {
              const guideState = getGuideFitState({ fit: nextFit, height, width });
              calibration.message = guideState.message;

              if (guideState.accepted) {
                const now = performance.now();
                if (!calibration.startedAt || now - calibration.lastAcceptedAt > CALIBRATION_MAX_GAP_MS) {
                  calibration.frames = [];
                  calibration.startedAt = now;
                  if (!scanStartedDispatched) {
                    emitRuntimeEvent(block, "scan-started", {
                      mode: requestedMode,
                    });
                    scanStartedDispatched = true;
                  }
                }

                calibration.frames.push(nextFit);
                calibration.lastAcceptedAt = now;
                if (calibration.frames.length > CALIBRATION_FRAME_TARGET) {
                  calibration.frames.shift();
                }
              } else if (calibration.frames.length) {
                calibration.frames.pop();
                if (!calibration.frames.length) {
                  calibration.startedAt = 0;
                  calibration.lastAcceptedAt = 0;
                }
              }

              const durationProgress = calibration.startedAt
                ? clamp((performance.now() - calibration.startedAt) / CALIBRATION_STABLE_MS, 0, 1)
                : 0;
              const frameProgress = calibration.frames.length / CALIBRATION_FRAME_TARGET;
              calibration.progress = Math.min(frameProgress, durationProgress || frameProgress);

              if (calibration.frames.length >= CALIBRATION_FRAME_TARGET && durationProgress >= 1) {
                const stability = getCalibrationStability(calibration.frames);

                if (!stability.accepted) {
                  calibration.message = stability.label;
                  calibration.frames = calibration.frames.slice(Math.floor(CALIBRATION_FRAME_TARGET / 2));
                  calibration.startedAt = performance.now();
                  calibration.lastAcceptedAt = calibration.startedAt;
                  calibration.progress = calibration.frames.length / CALIBRATION_FRAME_TARGET;
                  animationFrame = window.requestAnimationFrame(draw);
                  return;
                }

                calibration.complete = true;
                calibration.message = "Face scan ready";
                calibration.progress = 1;
                smoothedFit = getMedianFit(calibration.frames) || nextFit;

                if (!profileDispatched) {
                  const profile = getMeasurementProfile({ fit: smoothedFit, mode: requestedMode });
                  emitRuntimeEvent(block, "scan-completed", {
                    mode: requestedMode,
                    profile,
                    scaleSource: smoothedFit.debug?.scaleSource || "estimated",
                  });
                  if (profile) {
                    block?.dispatchEvent(
                      new CustomEvent("eyesaloon:tryon-profile-ready", {
                        bubbles: true,
                        detail: { profile },
                      }),
                    );
                    profileDispatched = true;
                  }
                }
              }
            } else if (nextFit.debug?.quality?.accepted) {
              smoothedFit = smoothFit(smoothedFit, nextFit);
            }
          }
        }

        if (smoothedFit) {
          drawCurrentFit({ fit: smoothedFit, height, width });
        } else if (guideFit) {
          drawCurrentFit({ fit: guideFit, height, width });
        } else {
          modelRenderer?.clear();
          drawCalibrationGrid({ context, height, width });
          if (frameImage) {
            const previewWidth = width * 0.58;
            const imageAspect = frameImage.naturalWidth && frameImage.naturalHeight ? frameImage.naturalWidth / frameImage.naturalHeight : 3.2;
            context.drawImage(frameImage, (width - previewWidth) / 2, height * 0.38, previewWidth, previewWidth / imageAspect);
          } else {
            drawFallbackOverlay({ context, height, width });
          }
          drawGuidedCalibration({
            context,
            fit: null,
            height,
            message: calibration.message,
            progress: calibration.progress,
            width,
          });
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

          if (requestedMode === "2d") {
            frameImage = await loadFrameImage(frameImageUrl);
          }

          if (faceLandmarker && requestedMode === "3d") {
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
            mode: requestedMode,
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
          guideFit = null;
          profileDispatched = false;
          scanStartedDispatched = false;
          overlayRenderedDispatched = false;
          smoothedFit = null;
          calibration.complete = false;
          calibration.frames = [];
          calibration.lastAcceptedAt = 0;
          calibration.message = "Place your face inside the oval";
          calibration.progress = 0;
          calibration.startedAt = 0;

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
