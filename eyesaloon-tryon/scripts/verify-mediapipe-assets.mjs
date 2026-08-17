import { stat } from "node:fs/promises";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const assetRoot = path.join(root, "public", "tryon-assets");

const requiredAssets = {
  "vision_bundle.mjs": {
    maxBytes: 250_000,
    contentType: "text/javascript; charset=utf-8",
  },
  "wasm/vision_wasm_internal.js": {
    maxBytes: 450_000,
    contentType: "text/javascript; charset=utf-8",
  },
  "wasm/vision_wasm_internal.wasm": {
    maxBytes: 12_500_000,
    contentType: "application/wasm",
  },
  "wasm/vision_wasm_nosimd_internal.js": {
    maxBytes: 450_000,
    contentType: "text/javascript; charset=utf-8",
  },
  "wasm/vision_wasm_nosimd_internal.wasm": {
    maxBytes: 11_750_000,
    contentType: "application/wasm",
  },
};

let hasError = false;

console.log(`Verifying MediaPipe try-on assets in ${assetRoot}`);

for (const [relativePath, expected] of Object.entries(requiredAssets)) {
  const filePath = path.join(assetRoot, relativePath);

  try {
    const file = await stat(filePath);

    if (file.size > expected.maxBytes) {
      hasError = true;
      console.error(`${relativePath}: ${file.size} bytes exceeds ${expected.maxBytes}`);
    } else {
      console.log(`${relativePath}: ${file.size} bytes, ${expected.contentType}`);
    }
  } catch {
    hasError = true;
    console.error(`${relativePath}: missing`);
  }
}

if (hasError) {
  console.error("MediaPipe try-on assets are not deployment-ready.");
  process.exit(1);
}

console.log("MediaPipe try-on assets are deployment-ready.");
