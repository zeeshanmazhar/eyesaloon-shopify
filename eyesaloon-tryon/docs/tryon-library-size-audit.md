# Try-On Library Size Audit

Measured on 2026-08-17 from npm tarballs in `/private/tmp/eyesaloon-tryon-audit`.

## Package Metadata

| Package | Version | NPM unpacked size |
|---|---:|---:|
| `three` | `0.185.1` | 23.2 MB |
| `@mediapipe/tasks-vision` | `1.0.1` | 36.8 MB |

Whole packages must not be copied into the theme app extension.

## Three.js Candidate Files

| File | Raw size | Gzip size |
|---|---:|---:|
| `build/three.module.min.js` | 365.6 KB | 86.8 KB |
| `examples/jsm/loaders/GLTFLoader.js` | 115.0 KB | 25.3 KB |
| `examples/jsm/loaders/DRACOLoader.js` | 19.0 KB | not measured |
| `examples/jsm/libs/draco/gltf/draco_decoder.wasm` | 192.4 KB | not measured |
| `examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js` | 58.5 KB | not measured |

Decision:

- Use a custom bundled Three.js runtime later instead of copying the whole package.
- Start without Draco in the first GLB renderer slice if possible.
- Only add Draco if the first real frame GLBs require it.
- Keep Three.js and GLTF loading behind `tryon-runtime.js`, never in `tryon.js`.

## MediaPipe Candidate Files

| File | Raw size | Gzip size |
|---|---:|---:|
| `vision_bundle.mjs` | 155.4 KB | 45.0 KB |
| `wasm/vision_wasm_internal.js` | 323.4 KB | not measured |
| `wasm/vision_wasm_internal.wasm` | 11.76 MB | 3.43 MB |
| `wasm/vision_wasm_module_internal.js` | 323.4 KB | not measured |
| `wasm/vision_wasm_module_internal.wasm` | 11.76 MB | not measured |
| `wasm/vision_wasm_nosimd_internal.js` | 323.2 KB | not measured |
| `wasm/vision_wasm_nosimd_internal.wasm` | 10.96 MB | 3.33 MB |

Decision:

- Do not put MediaPipe WASM files in the theme app extension.
- The WASM files alone are too large for Shopify's 10 MB theme app extension limit.
- `vision_bundle.mjs` can be lazy-loaded by `tryon-runtime.js` later, but its WASM base path should point to controlled app-hosted static routes or another first-party static host.
- The app route/static-host approach needs a cacheable URL and correct MIME types before MediaPipe integration begins.

## Current Extension Shell Sizes

| File | Raw size | Loading path |
|---|---:|---|
| `tryon.js` | 9.1 KB | Shopify schema-loaded |
| `tryon-runtime.js` | 2.4 KB | lazy after mobile camera intent |
| `tryon-qr.js` | 56.7 KB | lazy after desktop QR intent |
| `tryon.css` | 7.2 KB | app block stylesheet |

The current shell remains light. The next implementation should add a first-party MediaPipe asset route before adding MediaPipe runtime code.
