import pkg from "../../package.json";

/** Current application version, read from package.json at build time. */
export const VERSION: string = pkg.version;

/**
 * Returns true if `latest` is a newer semver than `current`.
 * Only supports simple `major.minor.patch` versions.
 */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [lMajor = 0, lMinor = 0, lPatch = 0] = parse(latest);
  const [cMajor = 0, cMinor = 0, cPatch = 0] = parse(current);

  if (lMajor !== cMajor) return lMajor > cMajor;
  if (lMinor !== cMinor) return lMinor > cMinor;
  return lPatch > cPatch;
}
