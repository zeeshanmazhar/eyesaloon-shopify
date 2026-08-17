# Try-On MediaPipe Asset Contract

MediaPipe WASM files are too large for the Shopify theme app extension. They are served by the app instead.

## Route

Base path:

```text
/apps/eyesaloon/tryon-assets
```

Manifest:

```text
/apps/eyesaloon/tryon-assets/manifest.json
```

Allowed future files:

```text
/apps/eyesaloon/tryon-assets/vision_bundle.mjs
/apps/eyesaloon/tryon-assets/wasm/vision_wasm_internal.js
/apps/eyesaloon/tryon-assets/wasm/vision_wasm_internal.wasm
/apps/eyesaloon/tryon-assets/wasm/vision_wasm_nosimd_internal.js
/apps/eyesaloon/tryon-assets/wasm/vision_wasm_nosimd_internal.wasm
```

The route is whitelist-only. Unknown paths return `404`.

`tryon-runtime.js` fetches the manifest after camera permission succeeds. Until the manifest reports `ready`, the storefront keeps the camera preview available and shows a tracking-assets-missing state instead of attempting MediaPipe initialization.

## Headers

Installed assets use:

```text
Cache-Control: public, max-age=31536000, immutable
X-Content-Type-Options: nosniff
```

MIME types:

```text
.mjs / .js -> text/javascript; charset=utf-8
.wasm      -> application/wasm
```

The manifest and error responses use `Cache-Control: no-store`.

## Current Status

The route contract exists, but the heavy MediaPipe files are intentionally not installed yet.

The manifest reports `assets-not-installed` until all whitelisted files exist. Once installed, it reports `ready` and includes per-file sizes.

## Deployment Artifact Source

Decision: keep MediaPipe runtime files out of git. Deployment must provide an audited `@mediapipe/tasks-vision` package directory through:

```text
MEDIAPIPE_TASKS_VISION_SOURCE=/path/to/audited/@mediapipe/tasks-vision/package
```

The source directory must contain:

```text
vision_bundle.mjs
wasm/vision_wasm_internal.js
wasm/vision_wasm_internal.wasm
wasm/vision_wasm_nosimd_internal.js
wasm/vision_wasm_nosimd_internal.wasm
```

## Install Script

Dry-run check:

```sh
npm run tryon:assets:check
```

Real install from an installed `@mediapipe/tasks-vision` package:

```sh
npm run tryon:assets:install
```

Real install from a temporary audited package extraction:

```sh
node scripts/install-mediapipe-assets.mjs --source=/private/tmp/eyesaloon-tryon-audit/mediapipe/package
```

Real install from deployment artifact env:

```sh
MEDIAPIPE_TASKS_VISION_SOURCE=/path/to/package npm run tryon:assets:prepare
```

The script copies only the whitelisted files listed above and rejects files that exceed the audited byte ceilings. It does not install npm packages.

Verify installed deployment assets:

```sh
npm run tryon:assets:verify
```

## Git Policy

`public/tryon-assets/*` is ignored by git except for `.gitkeep`.

The MediaPipe WASM files should be supplied by deployment artifact handling, not committed to the repo. A deployment flow should:

1. Provide an audited `@mediapipe/tasks-vision` package directory or equivalent artifact source.
2. Set `MEDIAPIPE_TASKS_VISION_SOURCE=/path/to/package`.
3. Run `npm run tryon:assets:prepare`.
4. Build and deploy the app.

Next implementation step:

1. Confirm the deployment host can provide `MEDIAPIPE_TASKS_VISION_SOURCE`.
2. Confirm the app host serves `.wasm` with `application/wasm`.
3. Install MediaPipe assets in a deployment-like environment and verify `manifest.json` reports `ready`.
