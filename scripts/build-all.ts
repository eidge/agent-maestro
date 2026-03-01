/**
 * Cross-compile agent-maestro for all platforms supported by `bun build --compile`.
 *
 * The @opentui/core native packages use `os`/`cpu` fields in package.json,
 * so package managers skip them for non-matching platforms. This script
 * manually fetches and extracts the tarballs for every platform so
 * cross-compilation can resolve the dynamic platform import.
 */

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const ENTRY = "src/compile-entry.tsx";
const OUT_DIR = "dist";
const BIN_NAME = "agent-maestro";

interface Target {
  bun: string; // bun --target value, e.g. "bun-linux-x64"
  opentui: string; // @opentui/core platform package suffix, e.g. "linux-x64"
  ext: string; // binary file extension
}

const TARGETS: Target[] = [
  { bun: "bun-darwin-arm64", opentui: "darwin-arm64", ext: "" },
  { bun: "bun-darwin-x64", opentui: "darwin-x64", ext: "" },
  { bun: "bun-linux-arm64", opentui: "linux-arm64", ext: "" },
  { bun: "bun-linux-x64", opentui: "linux-x64", ext: "" },
  { bun: "bun-windows-x64", opentui: "win32-x64", ext: ".exe" },
];

// Resolve the @opentui/core version from the installed package.
const coreVersion: string = (
  await Bun.file("node_modules/@opentui/core/package.json").json()
).version;

// ── Install missing platform packages ────────────────────────────────
// Package managers respect os/cpu fields and refuse to install packages
// for other platforms. We bypass this by downloading tarballs with
// `npm pack` and extracting them directly into node_modules.
console.log(
  `Ensuring all @opentui/core native packages are present (v${coreVersion})…`,
);

for (const target of TARGETS) {
  const pkgName = `@opentui/core-${target.opentui}`;
  const dest = join("node_modules", "@opentui", `core-${target.opentui}`);

  if (existsSync(dest)) continue;

  process.stdout.write(`  Fetching ${pkgName}@${coreVersion}… `);
  try {
    const result =
      await $`npm pack ${pkgName}@${coreVersion} --pack-destination /tmp 2>/dev/null`.text();
    const tarball = `/tmp/${result.trim()}`;

    mkdirSync(dest, { recursive: true });
    await $`tar xzf ${tarball} --strip-components=1 -C ${dest}`.quiet();
    await $`rm -f ${tarball}`.quiet();
    console.log("✓");
  } catch {
    console.log("✗ (skipped)");
  }
}

// ── Compile for all targets ──────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
for (const target of TARGETS) {
  const outfile = `${OUT_DIR}/${BIN_NAME}-${target.bun.replace("bun-", "")}${target.ext}`;
  process.stdout.write(`Building ${outfile}… `);
  try {
    await $`bun build --compile --target=${target.bun} ${ENTRY} --outfile ${outfile}`.quiet();
    console.log("✓");
  } catch (e) {
    console.log("✗");
    console.error(`  ${(e as Error).message}`);
    failed++;
  }
}

// Also build the default (host) binary without a platform suffix.
process.stdout.write(`Building ${OUT_DIR}/${BIN_NAME}… `);
await $`bun build --compile ${ENTRY} --outfile ${OUT_DIR}/${BIN_NAME}`.quiet();
console.log("✓");

if (failed > 0) {
  console.error(`\n${failed} target(s) failed.`);
  process.exit(1);
}

console.log("\nAll targets built successfully.");
