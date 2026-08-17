# Eyesaloon Try-On Runtime Strategy

This file defines how the virtual try-on runtime stays light enough for Shopify product pages and mobile customers.

## Loading Rules

- `tryon.js` is the only script loaded by the app block schema.
- `tryon.js` must stay small and only manage UI state, feature checks, QR handoff, camera permission, and lazy loading.
- QR generation lives in `tryon-qr.js` and loads only on desktop modal open.
- Camera/3D work lives in `tryon-runtime.js` and loads only after mobile camera intent.
- MediaPipe, Three.js, GLTFLoader, WASM, and task/model files must not be added to `tryon.js`.
- No third-party runtime assets should load from paid SaaS widgets or public CDNs.

## Budget Targets

- Product page before customer intent: no heavy try-on runtime.
- Schema-loaded app block JS: target under 10 KB uncompressed where practical.
- Theme app extension total: stay far below Shopify's 10 MB extension limit.
- First camera runtime milestone: keep custom runtime glue under 25 KB before libraries.
- Production GLB target per frame: 1.5 MB or less after compression.

## Asset Placement

- `tryon.js`: Shopify schema-loaded controller.
- `tryon-qr.js`: vendored MIT QR generator, lazy-loaded for desktop handoff.
- `tryon-runtime.js`: lazy-loaded runtime shell for camera, canvas, tracking, and rendering.
- Future Three.js build: separate vendored/minified asset, lazy-loaded by `tryon-runtime.js`.
- Future MediaPipe JS: lazy-loaded by `tryon-runtime.js`.
- Future MediaPipe WASM: app-hosted through `/apps/eyesaloon/tryon-assets`, not theme-extension bundled.
- Deployment artifact source: `MEDIAPIPE_TASKS_VISION_SOURCE` points to an audited `@mediapipe/tasks-vision` package directory, then `npm run tryon:assets:prepare` copies and verifies the whitelisted files.
- Future GLB files: Shopify file metafield `eyesaloon.model_3d`, not bundled in the extension.

See `docs/tryon-library-size-audit.md` for measured package sizes.
See `docs/tryon-mediapipe-assets.md` for the app-hosted asset route contract.

## Runtime Shape

`tryon-runtime.js` exposes `window.EyesaloonTryOnRuntime.create(options)`.

The controller passes:

- `block`
- `stage`
- `video`
- `modelUrl`
- `trackingManifestUrl`
- frame measurements from `data-lens-width-mm`, `data-bridge-mm`, `data-temple-mm`, `data-lens-height-mm`

The runtime returns:

- `start()`
- `destroy()`

This makes cleanup explicit and keeps camera shutdown in the controller.

`start()` checks `/apps/eyesaloon/tryon-assets/manifest.json` before future MediaPipe initialization. If the manifest is missing or reports `assets-not-installed`, the runtime keeps the camera preview alive and reports `trackingAssetsReady: false`; the controller shows the `tracking-assets-missing` state instead of failing the camera flow.

## Next Heavy Step

Before adding MediaPipe or Three.js, measure the candidate assets:

- package size
- minified browser bundle size
- WASM/task file size
- whether the files work from Shopify extension asset URLs
- whether the total extension remains comfortably under 10 MB

The current size audit shows MediaPipe WASM is too large for the theme app extension. Serve its static assets from `/apps/eyesaloon/tryon-assets` instead of bundling them into the extension.
