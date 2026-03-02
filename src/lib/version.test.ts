import { describe, expect, test } from "bun:test";
import { isNewer } from "./version";

describe("isNewer", () => {
  test("returns true when latest has higher major", () => {
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
  });

  test("returns true when latest has higher minor", () => {
    expect(isNewer("0.3.0", "0.2.3")).toBe(true);
  });

  test("returns true when latest has higher patch", () => {
    expect(isNewer("0.2.4", "0.2.3")).toBe(true);
  });

  test("returns false when versions are equal", () => {
    expect(isNewer("0.2.3", "0.2.3")).toBe(false);
  });

  test("returns false when latest is older", () => {
    expect(isNewer("0.2.2", "0.2.3")).toBe(false);
    expect(isNewer("0.1.9", "0.2.0")).toBe(false);
  });

  test("handles v prefix", () => {
    expect(isNewer("v0.3.0", "0.2.3")).toBe(true);
    expect(isNewer("0.3.0", "v0.2.3")).toBe(true);
    expect(isNewer("v0.3.0", "v0.2.3")).toBe(true);
  });

  test("handles major version boundary", () => {
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
  });
});
