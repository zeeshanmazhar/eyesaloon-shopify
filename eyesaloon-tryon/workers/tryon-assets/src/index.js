const CACHE_CONTROL = "public, max-age=31536000, immutable";
const NO_STORE = "no-store";

const allowedAssets = {
  "vision_bundle.mjs": "text/javascript; charset=utf-8",
  "wasm/vision_wasm_internal.js": "text/javascript; charset=utf-8",
  "wasm/vision_wasm_internal.wasm": "application/wasm",
  "wasm/vision_wasm_nosimd_internal.js": "text/javascript; charset=utf-8",
  "wasm/vision_wasm_nosimd_internal.wasm": "application/wasm",
};

const manifestFiles = {
  visionBundle: "vision_bundle.mjs",
  wasmLoader: "wasm/vision_wasm_internal.js",
  wasmBinary: "wasm/vision_wasm_internal.wasm",
  wasmNosimdLoader: "wasm/vision_wasm_nosimd_internal.js",
  wasmNosimdBinary: "wasm/vision_wasm_nosimd_internal.wasm",
};

function withCors(headers = {}) {
  return {
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  };
}

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: withCors({
      "Cache-Control": NO_STORE,
      ...init.headers,
    }),
  });
}

function normalizeAssetPath(url) {
  let assetPath = url.pathname.replace(/^\/+/, "");

  if (assetPath.startsWith("apps/eyesaloon/tryon-assets/")) {
    assetPath = assetPath.replace("apps/eyesaloon/tryon-assets/", "");
  }

  if (!assetPath || assetPath === "manifest.json") return "manifest.json";
  if (assetPath.includes("..") || assetPath.includes("\\")) return "";

  return allowedAssets[assetPath] ? assetPath : "";
}

async function getManifest(env, requestUrl) {
  const entries = await Promise.all(
    Object.entries(manifestFiles).map(async ([key, assetPath]) => {
      const object = await env.TRYON_ASSETS.head(assetPath);
      const kvMarker = object ? null : await env.TRYON_ASSETS_KV.get(`meta/${assetPath}`, { type: "json" });
      const kvSize = Number(kvMarker?.size || 0);

      return [
        key,
        {
          path: assetPath,
          installed: Boolean(object || kvSize),
          size: object?.size || kvSize,
        },
      ];
    }),
  );
  const files = Object.fromEntries(entries);
  const ready = Object.values(files).every((file) => file.installed);
  const assetBasePath = new URL("/", requestUrl).toString().replace(/\/$/, "");

  return {
    version: 1,
    status: ready ? "ready" : "assets-not-installed",
    package: {
      name: "@mediapipe/tasks-vision",
      auditedVersion: "1.0.1",
    },
    assetBasePath,
    files,
  };
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: withCors() });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "/health") {
    return json({
      service: "eyesaloon-tryon-assets",
      status: "ok",
    });
  }

  if (url.pathname === "/api/auth") {
    return json({
      service: "eyesaloon-tryon-assets",
      status: "auth-route-placeholder",
    });
  }

  const assetPath = normalizeAssetPath(url);

  if (assetPath === "manifest.json") {
    return json(await getManifest(env, url));
  }

  if (!assetPath) {
    return json({ error: "Unknown try-on asset" }, { status: 404 });
  }

  const object = await env.TRYON_ASSETS.get(assetPath);

  if (object) {
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers: withCors({
        "Cache-Control": CACHE_CONTROL,
        "Content-Length": String(object.size),
        "Content-Type": allowedAssets[assetPath],
        ETag: object.httpEtag,
      }),
    });
  }

  const kvMarker = await env.TRYON_ASSETS_KV.get(`meta/${assetPath}`, { type: "json" });
  const kvSize = Number(kvMarker?.size || 0);
  const kvObject = kvSize ? await env.TRYON_ASSETS_KV.get(assetPath, { type: "stream" }) : null;

  if (!kvObject || !kvSize) {
    return json(
      {
        error: "Try-on asset is not installed",
        asset: assetPath,
      },
      { status: 404 },
    );
  }

  return new Response(request.method === "HEAD" ? null : kvObject, {
    headers: withCors({
      "Cache-Control": CACHE_CONTROL,
      "Content-Length": String(kvSize),
      "Content-Type": allowedAssets[assetPath],
    }),
  });
}

export default {
  fetch: handleRequest,
};
