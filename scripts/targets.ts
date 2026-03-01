/** Shared build target definitions. */

export interface Target {
  bun: string; // bun --target value, e.g. "bun-linux-x64"
  opentui: string; // @opentui/core platform package suffix, e.g. "linux-x64"
  ext: string; // binary file extension
}

export const BIN_NAME = "agent-maestro";
export const ENTRY = "src/compile-entry.tsx";
export const OUT_DIR = "dist";

export const TARGETS: Target[] = [
  { bun: "bun-darwin-arm64", opentui: "darwin-arm64", ext: "" },
  { bun: "bun-darwin-x64", opentui: "darwin-x64", ext: "" },
  { bun: "bun-linux-arm64", opentui: "linux-arm64", ext: "" },
  { bun: "bun-linux-x64", opentui: "linux-x64", ext: "" },
  { bun: "bun-windows-x64", opentui: "win32-x64", ext: ".exe" },
];

/** Return the output filename for a given target (without directory). */
export function outName(target: Target): string {
  return `${BIN_NAME}-${target.bun.replace("bun-", "")}${target.ext}`;
}
