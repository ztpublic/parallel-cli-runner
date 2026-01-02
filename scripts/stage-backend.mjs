import fs from "fs";
import path from "path";

const [platform, target, binaryName] = process.argv.slice(2);

if (!platform || !target || !binaryName) {
  console.error("Usage: node scripts/stage-backend.mjs <platform> <target> <binary>");
  process.exit(1);
}

const src = path.join(
  process.cwd(),
  "src-tauri",
  "target",
  target,
  "release",
  binaryName
);
const destDir = path.join(
  process.cwd(),
  "vscode-extension",
  "bin",
  platform
);
const dest = path.join(destDir, binaryName);

if (!fs.existsSync(src)) {
  console.error(`Backend binary not found: ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Staged backend binary: ${dest}`);
