# Eyesaloon Try-On Feature Report

Date: 2026-09-03
Audience: second-opinion technical review
Project: Eyesaloon Shopify try-on app extension

## Executive Summary

Eyesaloon is building a lightweight browser-based eyewear try-on for Shopify. The current version uses on-device MediaPipe face tracking, a guided oval face scan, optional PD/IPD calibration, and local measurement-profile reuse on the shopper's phone. It does not upload camera frames, images, or video.

The main product goal is to create a practical try-on system that can support three levels:

1. 3D model try-on when a calibrated GLB and frame measurements exist.
2. 2D transparent PNG try-on when a calibrated front image and frame measurements exist.
3. Measurement-only fit guidance when no visual asset exists.

The current implementation is a strong first version of the web calibration layer plus a live overlay path, but it is not yet a final product-quality fitting engine. The biggest remaining needs are to close the gap between the current renderer and the original D5 live-AR specification: iris/pupil scaling, stronger scan-lock behavior, full pose-aware rendering, calibrated 2D image anchors, and model-specific 3D fitting metadata.

## Current Implementation

Primary files:

- `extensions/tryon-block/blocks/tryon.liquid`
- `extensions/tryon-block/assets/tryon.js`
- `extensions/tryon-block/assets/tryon-runtime.js`
- `extensions/tryon-block/assets/tryon.css`
- `extensions/tryon-block/locales/en.default.json`

Current app-block asset version:

- `tryon-v35`

### Storefront Flow

On desktop:

1. Product page shows the try-on block.
2. User opens try-on.
3. Desktop shows a QR code.
4. QR link opens the same product on mobile with `?tryon=1`.
5. If PD is known, it can be included in the QR URL as `pd=62`.

On mobile:

1. User opens try-on.
2. User may enter PD/IPD.
3. User starts the camera.
4. MediaPipe face tracking runs on-device.
5. The camera view shows an oval guide.
6. Runtime accepts only good frames where the face is centered, stable, reasonably straight, and at a usable distance.
7. After 24 good frames, runtime computes a median face-fit baseline.
8. Runtime emits a local measurement profile.
9. Controller saves that profile in `localStorage`.
10. User can continue trying other products on the same phone with the saved profile.

### Actual Try-On Rendering Path

The intended architecture is not "measure once, then render a static composite." The current storefront flow is:

1. User opens the camera.
2. MediaPipe tracking runs continuously on-device.
3. The guided scan collects stable frames and locks a baseline profile.
4. After scan lock, the camera remains live and the overlay updates every video frame.

Current rendering behavior:

- If a calibrated 2D transparent PNG exists, `tryon-runtime.js` draws it as a live canvas overlay over the camera frame.
- If a product GLB exists and the Three.js renderer loads, `tryon-renderer.js` renders the GLB live over the camera frame.
- If neither visual asset exists, the runtime shows measurement/fit guidance from the tracked face and product frame dimensions.

Important gap versus the original D5 specification:

- The original plan called for Three.js GLB rendering anchored to nose bridge landmarks, orientation from the face transformation matrix, iris-based scale, and a head occluder.
- The current GLB renderer is live, but still simplified. It uses center/width/height/roll fitting and does not yet fully apply yaw, pitch, depth, nose-bridge anchoring, iris scale, or head occlusion.
- The current 2D PNG overlay is live but front-facing only. It does not yet perspective-warp the image during head turns.

So the architecture remains live try-on after scan lock. The product-quality gap is renderer precision, not whether the system is live.

### Current Measurement Profile

The saved local profile includes:

- `version`
- `createdAt`
- `mode`
- `calibrated`
- `confidence`
- `pdMm`
- `faceWidthMm`
- `eyeCenterDistanceMm`
- `eyeOuterDistanceMm`
- `noseLengthMm`
- `faceToEyeRatio`
- `productId`
- `productUrl`

Storage keys:

- `eyesaloon_tryon_profile_v1`
- `eyesaloon_tryon_pd_mm`

Camera images/video are not stored.

## AI Tracking Approach

The system currently uses MediaPipe Face Landmarker in `VIDEO` mode.

Current runtime options include:

- `numFaces: 1`
- `minFaceDetectionConfidence: 0.55`
- `minFacePresenceConfidence: 0.55`
- `minTrackingConfidence: 0.55`
- `outputFaceBlendshapes: false`
- `outputFacialTransformationMatrixes: true`
- `delegate: "CPU"`

The tracking is used for:

- eye corners
- eye centers
- nose bridge
- nose tip
- face left/right outline
- face oval path
- facial transformation matrix / pose signal

The face transformation matrix is used as a better pose-quality signal. It helps detect whether the face is looking straight enough for the scan to be trusted.

## Guided Scan

The guided scan is meant to feel like an Apple-style face setup flow while staying inside browser Shopify web.

Current logic:

- Draws an oval guide.
- Computes whether face center is within the oval.
- Rejects low-quality frames.
- Rejects bad size/distance frames.
- Rejects strong roll/yaw.
- Collects 24 accepted frames.
- Uses median values to reduce jitter.

Current quality checks use:

- eye distance as a fraction of video width
- face width as a fraction of video width
- face-to-eye ratio
- roll angle
- yaw or nose-offset proxy
- face center within guide oval

## PD/IPD Calibration

The user can enter total PD/IPD in millimeters.

If PD exists:

- Runtime uses eye-center distance as the pixel reference.
- Measurements are labeled `calibrated mm`.

If PD does not exist:

- Runtime falls back to a generic average eye-outer reference.
- Measurements are labeled `est. mm`.

This is intentional because an uncalibrated single browser selfie camera cannot reliably produce exact real-world millimeters. However, the original D5 plan already specified iris landmarks as part of the target implementation. That means iris is not a stretch goal; it is required D5 parity. If stable iris landmarks are available, the default uncalibrated path should use iris diameter as the scale reference before falling back to generic eye-distance assumptions.

## Accuracy Limits

The current browser-based approach is not equivalent to native iPhone ARKit TrueDepth or Android ARCore Augmented Faces.

Important limits:

- Single-camera browser video has scale ambiguity.
- Browser web does not generally expose iPhone TrueDepth face mesh.
- WebXR is not reliable enough as a Shopify storefront dependency.
- Without PD/IPD or another known reference, physical mm values are estimates.
- Without calibrated product assets, overlay fit is still approximate.

## Comparison to Native AR

Native Apple ARKit can provide:

- face anchor transform
- face geometry
- eye transforms
- expression blend shapes
- lighting estimation
- occlusion geometry
- metric coordinate space

Native Google ARCore Augmented Faces can provide:

- 468-point face mesh
- center pose
- region poses
- mesh vertices/normals
- tracking state

The web implementation cannot fully match these native capabilities. However, it is much lighter, easier to deploy in Shopify, and more accessible across modern mobile browsers.

## Why This Is Still Valuable

This web approach is valuable because:

- It keeps camera processing on-device.
- It avoids app-install friction.
- It supports QR handoff from desktop to mobile.
- It can work for many shoppers immediately.
- It can improve with PD/IPD calibration.
- It can support both 2D and 3D assets later.
- It can reuse measurements across products on the same phone.

## Current Validation

Recent checks passed:

- `node --check extensions/tryon-block/assets/tryon.js`
- `node --check extensions/tryon-block/assets/tryon-runtime.js`
- `npm run lint`
- `npm run build`
- `npm run typecheck`

Node used:

- `v22.12.0`

Runtime validation still needs to be completed against the original acceptance criteria:

- 24 FPS or better on Redmi/Infinix-class Android.
- First tap to camera preview under 4 seconds on real 4G.
- Zero heavy try-on cost on normal product page load before user intent.
- Desktop QR to mobile camera flow tested end to end.
- iOS Safari and Android Chrome tested with real lighting and movement.

## Current Gaps

### 1. Renderer Precision

The current system has live overlay rendering, but the renderer is not yet at the original D5 target.

Required next upgrades:

- Use iris or pupil centers for optical-center alignment.
- Use nose bridge landmarks as the primary visual anchor.
- Use the face transformation matrix for yaw, pitch, and roll.
- Add smoothing that preserves responsiveness without visible lag.
- Add a simple head occluder for temple depth once GLB orientation is correct.
- Treat 2D PNG mode as front-facing unless/until perspective warp is implemented.

### 2. Iris/Pupil Precision

The current PD calibration uses estimated eye centers from eye-corner landmarks. MediaPipe can output 478 landmarks, including iris landmarks in some configurations. We should verify whether the current Face Landmarker asset gives stable iris landmarks and use those for pupil centers if available.

Why it matters:

- PD is pupil-to-pupil distance.
- Iris landmarks should be better than eye-corner midpoint approximations.
- Eyewear fitting depends heavily on pupil/optical-center alignment.
- Average adult iris diameter is a better no-PD fallback reference than generic outer-eye width, but still needs product QA before we label values as exact.

### 3. Scan Lock Stability

The scan currently locks after 24 accepted frames. A bare frame count is not enough.

Why it matters:

- Detection FPS varies by phone, so 24 frames can mean different wall-clock durations.
- A median can hide disagreement between accepted samples.
- A noisy scan can pass if every frame individually looks acceptable.

Recommended correction:

- Require continuous good tracking for a time window, not just a count.
- Keep the 24-sample minimum only as one condition.
- Add median absolute deviation/spread checks for face width, eye distance, center position, roll, and yaw.
- Force rescan if spread exceeds tested thresholds.

### 4. Worker Offloading

MediaPipe web docs note that `detectForVideo()` runs synchronously and can block the UI thread. The current runtime runs detection in the main thread.

Why it matters:

- Camera/video can feel less smooth on midrange phones.
- UI interactions can lag.
- Worker offloading would make the experience feel more premium.

Worker offloading should come after iris and scan-stability work unless real-device testing shows main-thread detection is the immediate blocker.

### 5. Measurement Profile Is Local-Only

The current profile works only on the same browser/device.

Why it matters:

- Desktop cannot automatically use a scan created on mobile yet.
- True cross-device handoff needs a small backend/Worker with short code or token.

### 6. Product Asset Calibration Is Missing

For 2D PNG try-on, each frame needs:

- transparent front PNG
- total frame width mm
- lens width mm
- bridge mm
- lens height mm
- left lens center x/y in image
- right lens center x/y in image
- bridge anchor x/y in image
- optional per-product x/y/scale offset

For 3D GLB try-on, each model needs:

- glTF-standard meters
- Y-up orientation convention
- known forward axis
- bridge/origin anchor
- lens center anchors
- model rotation offsets
- occlusion strategy
- mobile GPU budget for mesh count, texture dimensions, material count, and file size
- internal QA tool to inspect anchor placement per SKU before publishing

### 7. Fallback Ladder Needs Completion

The original plan required:

- No camera -> selfie upload mode.
- No WebGL/WASM -> hide block or fall back cleanly.

Current state:

- The runtime handles camera permission, no camera, unsupported browser, no model, and missing asset states.
- Measurement-only mode exists when product dimensions exist.
- Selfie upload mode is not implemented yet.
- The block may still render an unavailable/unsupported state instead of fully hiding in every no-WebGL/no-WASM scenario.

### 8. Locale Coverage

The current try-on extension lists only:

- `extensions/tryon-block/locales/en.default.json`

The theme project has a no-hard-coded-UI-strings rule with paired English/Urdu coverage elsewhere. The try-on block needs an Urdu locale file and a quick audit for any remaining hard-coded shopper-facing strings.

### 9. Usage Telemetry

No try-on funnel telemetry is documented yet.

Minimum funnel events:

- try-on block viewed
- modal opened
- QR rendered
- QR copied
- camera requested
- camera granted
- camera denied
- scan started
- scan completed
- overlay rendered
- 2D mode used
- 3D mode used
- measurement-only mode used
- add to cart after try-on

### 10. Device QA

The scan and overlay need real phone testing across:

- iPhone Safari
- Android Chrome
- Redmi/Infinix-class Android
- low light
- glasses already on face
- head slightly tilted
- different skin tones
- different face sizes
- different camera distances

## Recommended Next Engineering Steps

### Step 1: Close The Renderer Spec Gap

Goal:

- Make the live try-on renderer match the documented D5 architecture.

Implementation:

- Keep the guided scan before live overlay.
- After scan lock, continue live per-frame rendering.
- Anchor visual assets to nose bridge and eye/iris landmarks.
- Use face transformation matrix for rotation.
- Keep measurement profile as reusable support data, not a replacement for live tracking.

Acceptance:

- Report and decisions match implementation.
- There is no ambiguity between live overlay and static composite.

### Step 2: Iris Landmark Upgrade

Goal:

- Use iris landmarks for more accurate pupil centers and default scale where available.

Implementation:

- Detect if landmarks length supports iris points.
- Use iris centers instead of eye-corner midpoints for PD scale.
- Use iris diameter as the first no-PD scale fallback.
- Fall back safely to current midpoint logic.

Acceptance:

- PD-calibrated face width is steadier when user moves closer/farther.
- Eye-center line follows pupils more accurately.
- No-PD estimates are closer than generic eye-outer assumptions in real-device tests.

### Step 3: Time-Based Scan Stability

Goal:

- Reject noisy scans, not only bad individual frames.

Implementation:

- Require a continuous stability window.
- Keep a minimum accepted-frame count.
- Add MAD/spread checks before locking.
- Rescan on excessive spread.

Acceptance:

- Scan width/eye/nose values remain stable as user moves within the accepted oval.
- No lock when accepted samples disagree too much.

### Step 4: Device And Network QA

Goal:

- Verify the experience on the actual target hardware/network class.

Implementation:

- Test Redmi/Infinix-class Android Chrome.
- Test iPhone Safari.
- Capture tap-to-camera timing on 4G.
- Capture tracking FPS and dropped-frame behavior.
- Confirm heavy runtime assets are lazy-loaded only after tap or QR auto-open.

Acceptance:

- 24 FPS or better on target Android.
- First tap to preview under 4 seconds on 4G.
- No meaningful page-load cost before try-on intent.

### Step 5: Fallbacks, Urdu, And Telemetry

Goal:

- Make the feature robust enough to learn from real shoppers.

Implementation:

- Add selfie upload fallback.
- Hide or gracefully fall back when WebGL/WASM/camera support is missing.
- Add `ur.json` and remove remaining hard-coded shopper strings.
- Emit the minimum try-on funnel events.

Acceptance:

- Unsupported devices do not show broken try-on UI.
- English and Urdu strings are covered.
- Funnel can identify drop-off points.

### Step 6: 2D PNG Anchor Metadata

Goal:

- Make 2D try-on production-ready for product catalog scale.

Implementation:

- Add Shopify metafields for PNG anchor coordinates.
- Add product import support for these metadata fields.
- Update runtime placement to map product image anchors to face anchors.

Acceptance:

- Same face scan can place different frame shapes consistently.
- Round, square, and wide frames sit at expected eye/bridge positions.
- Front-facing-only limitation is explicit unless perspective warp is added.

### Step 7: Worker Offload

Goal:

- Keep UI/camera smoother.

Implementation:

- Move `detectForVideo()` into a Web Worker if MediaPipe bundle supports that path cleanly.
- Keep main thread for drawing and UI only.

Acceptance:

- No visible UI stutter during tracking on midrange Android.

### Step 8: Cloudflare Worker Handoff

Goal:

- Let mobile scan create a short code that desktop can use.

Implementation:

- Store measurement profile temporarily with a long random unguessable code.
- Rate-limit lookup attempts.
- Store profile only, with no face images and no PII.
- Enforce server-side TTL, for example 15-60 minutes.
- Delete on read when practical.
- Desktop polls or user enters the code.

Acceptance:

- No face images stored.
- Desktop can receive profile and use it for product fit guidance.

## Second-Opinion Review Incorporated

The review raised valid corrections:

- Actual try-on rendering must be documented explicitly.
- Iris landmarks were already in the original D5 scope and should not be treated as a stretch goal.
- Scan lock needs variance/spread checks, not just 24 accepted frames.
- Device/network validation is not covered by lint/build/typecheck.
- The fallback ladder, Urdu locale coverage, and telemetry need to be tracked as launch risks.
- 2D PNG mode must be scoped as front-facing unless perspective warp is added.
- GLB requirements must include units, axes, anchors, and mobile GPU budgets.

## Source References

- MediaPipe Face Landmarker Web: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MediaPipe Face Geometry: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
- MediaPipe Face Geometry proto: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/protos/face_geometry.proto
- MediaPipe Iris: https://mediapipe.readthedocs.io/en/latest/solutions/iris.html
- OpenCV Camera Calibration: https://docs.opencv.org/5.0/tutorials/calib3d/camera_calibration/camera_calibration.html
- OpenCV Calibration Module: https://docs.opencv.org/5.0/main_modules/calib.html
- Apple ARFaceAnchor: https://developer.apple.com/documentation/arkit/arfaceanchor
- Apple Tracking and Visualizing Faces: https://developer.apple.com/documentation/arkit/tracking-and-visualizing-faces
- Google ARCore AugmentedFace: https://developers.google.com/ar/reference/java/com/google/ar/core/AugmentedFace
- MDN WebXR Device API: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API

## Bottom Line

The current implementation is a good web-first foundation. It is privacy-friendly, lightweight, and realistic for Shopify. It already has a live overlay path after guided scan lock, but the renderer is not yet at D5 product-quality parity. The next biggest quality jump should come from iris landmarks, scan-stability checks, pose-aware rendering, and real-device validation before worker offload or native AR exploration.
