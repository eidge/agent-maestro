import { afterEach, describe, expect, test } from "bun:test";
import { getAssetNameForPlatform } from "./updater";

describe("getAssetNameForPlatform", () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "arch", { value: originalArch });
  });

  const cases: [string, string, string][] = [
    ["darwin", "arm64", "agent-maestro-darwin-arm64"],
    ["darwin", "x64", "agent-maestro-darwin-x64"],
    ["linux", "arm64", "agent-maestro-linux-arm64"],
    ["linux", "x64", "agent-maestro-linux-x64"],
    ["win32", "x64", "agent-maestro-windows-x64.exe"],
  ];

  for (const [platform, arch, expected] of cases) {
    test(`returns ${expected} for ${platform}-${arch}`, () => {
      Object.defineProperty(process, "platform", { value: platform });
      Object.defineProperty(process, "arch", { value: arch });
      expect(getAssetNameForPlatform()).toBe(expected);
    });
  }

  test("throws for unsupported platform", () => {
    Object.defineProperty(process, "platform", { value: "freebsd" });
    Object.defineProperty(process, "arch", { value: "x64" });
    expect(() => getAssetNameForPlatform()).toThrow("Unsupported platform");
  });

  test("throws for unsupported arch", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "ia32" });
    expect(() => getAssetNameForPlatform()).toThrow("Unsupported platform");
  });
});

describe("isCompiledBinary", () => {
  test("returns false in dev mode", async () => {
    // In test/dev mode, process.execPath is the bun runtime, not argv[0]
    const { isCompiledBinary } = await import("./updater");
    expect(isCompiledBinary()).toBe(false);
  });
});
