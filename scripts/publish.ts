/**
 * Publish a GitHub release with pre-built binaries for all platforms.
 *
 * Usage:
 *   bun run publish              # release using the version from package.json
 *   bun run publish -- --draft   # create a draft release
 *
 * What it does:
 *   1. Reads the version from package.json (e.g. "0.1.0" → tag "v0.1.0")
 *   2. Runs `build:all` to compile binaries for every platform
 *   3. Creates a GitHub release via `gh` and uploads all dist/ binaries
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";
import { BIN_NAME, OUT_DIR, TARGETS, outName } from "./targets";

// ── Parse flags ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const draft = args.includes("--draft");

// ── Read version ─────────────────────────────────────────────────────
const pkg = await Bun.file("package.json").json();
const version: string = pkg.version;
if (!version) {
  console.error('Error: no "version" field in package.json');
  process.exit(1);
}
const tag = `v${version}`;

// ── Pre-flight checks ────────────────────────────────────────────────
try {
  await $`gh auth status`.quiet();
} catch {
  console.error("Error: not authenticated with GitHub. Run `gh auth login` first.");
  process.exit(1);
}

// Check for uncommitted changes.
const status = (await $`git status --porcelain`.text()).trim();
if (status) {
  console.error("Error: working tree has uncommitted changes. Commit or stash them first.");
  process.exit(1);
}

// Check the tag doesn't already exist.
const existingTags = (await $`git tag -l ${tag}`.text()).trim();
if (existingTags) {
  console.error(`Error: tag ${tag} already exists. Bump the version in package.json first.`);
  process.exit(1);
}

// ── Build all targets ────────────────────────────────────────────────
console.log(`\nBuilding ${tag}…\n`);
await $`bun run build:all`;

// Collect release assets.
const assets: string[] = [];
for (const target of TARGETS) {
  const file = join(OUT_DIR, outName(target));
  if (existsSync(file)) assets.push(file);
}
// Include the host-platform convenience binary.
const hostBinary = join(OUT_DIR, BIN_NAME);
if (existsSync(hostBinary)) assets.push(hostBinary);

if (assets.length === 0) {
  console.error("Error: no binaries found in dist/. Build may have failed.");
  process.exit(1);
}

// ── Tag & release ────────────────────────────────────────────────────
console.log(`\nCreating ${draft ? "draft " : ""}release ${tag}…`);

await $`git tag ${tag}`;
await $`git push upstream ${tag}`;

const ghFlags = [
  "--title",
  `${BIN_NAME} ${tag}`,
  "--generate-notes",
  ...(draft ? ["--draft"] : []),
];

await $`gh release create ${tag} ${assets} ${ghFlags}`;

console.log(`\n✓ Release ${tag} published with ${assets.length} assets.`);
