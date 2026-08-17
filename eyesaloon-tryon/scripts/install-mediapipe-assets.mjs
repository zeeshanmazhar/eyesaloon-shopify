import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const destinationRoot = path.join(root, "public", "tryon-assets");

const requiredFiles = [
  "vision_bundle.mjs",
  "wasm/vision_wasm_internal.js",
  "wasm/vision_wasm_internal.wasm",
  "wasm/vision_wasm_nosimd_internal.js",
  "wasm/vision_wasm_nosimd_internal.wasm",
];

const maxBytes = {
  "vision_bundle.mjs": 250_000,
  "wasm/vision_wasm_internal.js": 450_000,
  "wasm/vision_wasm_internal.wasm": 12_500_000,
  "wasm/vision_wasm_nosimd_internal.js": 450_000,
  "wasm/vision_wasm_nosimd_internal.wasm": 11_750_000,
};

function readArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

async function resolveDefaultSource() {
  try {
    const packagePath = await import.meta.resolve("@mediapipe/tasks-vision/package.json");
    return path.dirname(new URL(packagePath).pathname);
  } catch {
    return "";
  }
}

async function fileSize(filePath) {
  return (await stat(filePath)).size;
}

const dryRun = process.argv.includes("--dry-run");
const sourceArg = readArg("--source");
const envSource = process.env.MEDIAPIPE_TASKS_VISION_SOURCE || "";
const sourceRoot = sourceArg
  ? path.resolve(sourceArg)
  : envSource
    ? path.resolve(envSource)
    : await resolveDefaultSource();

if (!sourceRoot) {
  console.error(
    "Missing MediaPipe source. Install @mediapipe/tasks-vision, pass --source=/path/to/package, or set MEDIAPIPE_TASKS_VISION_SOURCE.",
  );
  process.exit(1);
}

console.log(`${dryRun ? "Checking" : "Installing"} MediaPipe try-on assets`);
console.log(`source: ${sourceRoot}`);
console.log(`destination: ${destinationRoot}`);

for (const relativePath of requiredFiles) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const destinationPath = path.join(destinationRoot, relativePath);
  const size = await fileSize(sourcePath);
  const limit = maxBytes[relativePath];

  if (size > limit) {
    throw new Error(`${relativePath} is ${size} bytes, above limit ${limit}`);
  }

  console.log(`${relativePath}: ${size} bytes`);

  if (!dryRun) {
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
}

console.log(dryRun ? "Dry run complete. No files copied." : "MediaPipe try-on assets installed.");
