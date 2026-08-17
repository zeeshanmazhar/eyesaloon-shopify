import { spawnSync } from "node:child_process";
import process from "node:process";

const source = process.env.MEDIAPIPE_TASKS_VISION_SOURCE || "";

if (!source) {
  console.error("Missing MEDIAPIPE_TASKS_VISION_SOURCE.");
  console.error("Set it to an audited @mediapipe/tasks-vision package directory before deployment.");
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("node", ["scripts/install-mediapipe-assets.mjs"]);
run("node", ["scripts/verify-mediapipe-assets.mjs"]);
