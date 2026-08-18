import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ASSET_ROOT = path.join(process.cwd(), "public", "tryon-assets");
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const allowedAssets = {
  "vision_bundle.mjs": "text/javascript; charset=utf-8",
  "wasm/vision_wasm_internal.js": "text/javascript; charset=utf-8",
  "wasm/vision_wasm_internal.wasm": "application/wasm",
  "wasm/vision_wasm_nosimd_internal.js": "text/javascript; charset=utf-8",
  "wasm/vision_wasm_nosimd_internal.wasm": "application/wasm",
  "models/face_landmarker.task": "application/octet-stream",
};

const manifestFiles = {
  visionBundle: "vision_bundle.mjs",
  wasmLoader: "wasm/vision_wasm_internal.js",
  wasmBinary: "wasm/vision_wasm_internal.wasm",
  wasmNosimdLoader: "wasm/vision_wasm_nosimd_internal.js",
  wasmNosimdBinary: "wasm/vision_wasm_nosimd_internal.wasm",
  faceLandmarkerModel: "models/face_landmarker.task",
};

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...init.headers,
    },
  });
}

function normalizeAssetPath(assetPath) {
  if (!assetPath || assetPath === "manifest.json") return assetPath || "manifest.json";
  if (assetPath.includes("..") || assetPath.startsWith("/") || assetPath.includes("\\")) return "";
  return allowedAssets[assetPath] ? assetPath : "";
}

async function getManifest() {
  const entries = await Promise.all(
    Object.entries(manifestFiles).map(async ([key, assetPath]) => {
      try {
        const file = await stat(path.join(ASSET_ROOT, assetPath));
        return [key, { path: assetPath, installed: true, size: file.size }];
      } catch {
        return [key, { path: assetPath, installed: false, size: 0 }];
      }
    }),
  );
  const files = Object.fromEntries(entries);
  const ready = Object.values(files).every((file) => file.installed);

  return {
    version: 1,
    status: ready ? "ready" : "assets-not-installed",
    package: {
      name: "@mediapipe/tasks-vision",
      auditedVersion: "1.0.1",
    },
    assetBasePath: "/apps/eyesaloon/tryon-assets",
    files,
  };
}

export async function loader({ params }) {
  const assetPath = normalizeAssetPath(params["*"]);

  if (assetPath === "manifest.json") {
    return json(await getManifest());
  }

  if (!assetPath) {
    return json({ error: "Unknown try-on asset" }, { status: 404 });
  }

  try {
    const file = await readFile(path.join(ASSET_ROOT, assetPath));

    return new Response(file, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "Content-Type": allowedAssets[assetPath],
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json(
      {
        error: "Try-on asset is not installed",
        asset: assetPath,
      },
      { status: 404 },
    );
  }
}

export async function action() {
  return json({ error: "Method not allowed" }, { status: 405 });
}
