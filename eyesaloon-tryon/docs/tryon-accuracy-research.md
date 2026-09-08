# Try-On Accuracy Research

Date: 2026-09-03

## Goal

Make the Eyesaloon browser try-on stable, lightweight, private, and honest about measurement accuracy. The system should support three paths:

1. 3D model fitting when a calibrated GLB and real frame measurements exist.
2. 2D transparent PNG fitting when a front-facing transparent frame image and real dimensions exist.
3. Measurement-only fit guidance when no calibrated visual asset exists.

## Research Findings

### 1. Raw browser landmarks are not physical millimeters

MediaPipe Face Landmarker returns normalized face landmarks. Its web guide says the result can include face landmarks, blendshapes, and facial transformation matrices. The matrix is optional and maps a canonical face model into the detected face so effects can be applied.

MediaPipe Face Mesh / Face Geometry documentation explains that the basic landmark screen coordinates use normalized x/y and a relative z under a weak-perspective camera model. This is good for tracking, but not enough for perfect physical measurement. Face Geometry adds a metric 3D space and a canonical face model whose default unit is centimeters. For best AR alignment, the virtual camera parameters should match the real physical camera parameters.

OpenCV camera calibration documentation gives the same core lesson from classic computer vision: accurate metric reconstruction needs camera intrinsic parameters, lens distortion handling, and known 3D object points or a calibration pattern.

Conclusion: a single uncalibrated browser selfie camera cannot know exact face width in millimeters. It can estimate relative proportions and stable anchor points, and it can become much more useful with calibration.

### 2. Why the current face width changes

Current runtime code estimates millimeters with:

```js
mmPerPx: eyeOuterDistance ? 92 / eyeOuterDistance : 0
```

This assumes every shopper has the same outer-eye distance of 92 mm. As the shopper moves, pixel distances and landmark quality change. The cheek-edge landmarks used for face width also drift with yaw, expression, lens distortion, and partial face visibility.

That means the displayed face width is an estimate, not a measured physical value. It should be labeled as estimated unless the shopper gives a known reference, such as PD/IPD or a calibration card.

### 3. AI helps tracking, but does not remove scale ambiguity

Modern AI face landmark models can identify eyes, nose, face outline, and head pose very well. But monocular camera geometry still has scale ambiguity: without a known reference, the camera cannot perfectly distinguish a smaller face close to the camera from a larger face farther away. Better AI can improve landmark stability; it cannot guarantee exact millimeters from one uncalibrated camera feed.

### 4. Better mobile AR exists, but it is not the same as Shopify web

Apple ARKit face tracking uses the front camera and provides face position, orientation, topology, expressions, face geometry, and lighting estimation. ARKit can also provide occlusion geometry so virtual glasses can appear behind the nose.

Google ARCore Augmented Faces provides a center pose, region poses, and a 468-point 3D face mesh for face effects and try-ons.

These are stronger native paths, but they require native iOS/Android or a separate app-style flow. They are not a simple drop-in replacement for a lightweight Shopify storefront web block.

## Recommended Architecture

### Near-term web mode

Keep MediaPipe Tasks Vision in the browser. Do not send camera frames to a backend. Turn on facial transformation matrices, use one-face smoothing, add quality gates, and stabilize measurements over time.

Implement:

- `outputFacialTransformationMatrixes: true`
- rolling median / exponential smoothing over 20-30 good frames
- quality rejection for large yaw, large roll, small face, low landmark visibility, and sudden measurement jumps
- stable anchor model using eye centers, nose bridge, nose tip, and face outline
- display "estimated" values unless calibrated

### Calibration mode

Add one of these calibration inputs:

- shopper enters prescription PD/IPD
- shopper uses a known-size object/card in the camera view
- shopper performs a short guided calibration sequence at a stable distance

Best first option for Eyesaloon: allow PD/IPD entry because many eyewear customers already have it from prescription data. If no PD exists, use relative fit guidance and label it clearly.

### 2D PNG mode

For transparent PNG fitting, require product metadata:

- transparent front PNG, straight-on, no perspective
- total frame width in mm
- lens width in mm
- bridge width in mm
- lens height in mm
- left and right lens center positions in image coordinates or percentages
- optional x/y offset and scale fine-tune values

Use this path before GLB for many products because it is lighter and easier to produce at scale.

### 3D GLB mode

Only enable 3D when the model is physically calibrated:

- real frame width, lens width, bridge width, lens height
- model coordinate orientation documented
- model origin set at bridge / face anchor
- known lens center positions
- model scale in real units
- per-frame rotation and offset corrections

Do not use demo GLB geometry for production fitting claims.

### Measurement-only mode

If no 2D or 3D asset exists, show fit guidance:

- estimated face width / eye distance
- frame width compared with face width
- fit label: narrow, good, wide
- confidence label: high, medium, low
- no fake frame overlay

## Acceptance Gates

- Measurement labels must say "estimated" unless calibrated.
- Face width should stay stable within about 3-5% after calibration while the shopper moves slightly forward/back.
- Overlay center drift should stay visually small when the shopper holds still.
- No 3D model should load unless 3D is enabled.
- 2D PNG should not rotate unpredictably; rotation should be behind a setting or a stable pose gate.
- Camera remains on device.
- The modal/backdrop stays full viewport and does not inherit product-section clipping or stacking.

## Sources

- MediaPipe Face Landmarker Web guide: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MediaPipe Face Mesh / Face Geometry documentation: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
- MediaPipe Face Geometry proto: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/protos/face_geometry.proto
- OpenCV camera calibration documentation: https://docs.opencv.org/5.0/main_modules/calib.html
- Apple ARKit Face Tracking documentation: https://developer.apple.com/documentation/arkit/arfacetrackingconfiguration/
- Apple Tracking and Visualizing Faces sample: https://developer.apple.com/documentation/ARKit/tracking-and-visualizing-faces
- Google ARCore Augmented Faces: https://developers.google.com/ar/develop/augmented-faces
- MDN WebXR Device API: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
