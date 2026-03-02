import { chmod, rename, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { VERSION, isNewer } from "./version";

const GITHUB_REPO = "eidge/agent-maestro";
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const FETCH_TIMEOUT_MS = 5_000;

export interface ReleaseInfo {
  version: string;
  assets: { name: string; downloadUrl: string }[];
}

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  assetName: string;
}

/** Returns true when running from a Bun-compiled binary (not `bun run`). */
export function isCompiledBinary(): boolean {
  // The compile-entry.tsx sets this global before loading the app.
  return (globalThis as Record<string, unknown>).__AGENT_MAESTRO_COMPILED__ === true;
}

/**
 * Returns the release asset name that matches the current platform and arch.
 */
export function getAssetNameForPlatform(): string {
  const platform = process.platform;
  const arch = process.arch;

  const map: Record<string, Record<string, string>> = {
    darwin: {
      arm64: "agent-maestro-darwin-arm64",
      x64: "agent-maestro-darwin-x64",
    },
    linux: {
      arm64: "agent-maestro-linux-arm64",
      x64: "agent-maestro-linux-x64",
    },
    win32: {
      x64: "agent-maestro-windows-x64.exe",
    },
  };

  const name = map[platform]?.[arch];
  if (!name) {
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }
  return name;
}

/** Fetches the latest GitHub release metadata. */
export async function getLatestRelease(): Promise<ReleaseInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as {
      tag_name: string;
      assets: { name: string; browser_download_url: string }[];
    };

    return {
      version: data.tag_name.replace(/^v/, ""),
      assets: data.assets.map((a) => ({
        name: a.name,
        downloadUrl: a.browser_download_url,
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks if a newer version is available.
 * Returns update info if an update exists, null otherwise.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const release = await getLatestRelease();

  if (!isNewer(release.version, VERSION)) {
    return null;
  }

  const assetName = getAssetNameForPlatform();
  const asset = release.assets.find((a) => a.name === assetName);

  if (!asset) {
    return null;
  }

  return {
    latestVersion: release.version,
    downloadUrl: asset.downloadUrl,
    assetName: asset.name,
  };
}

/**
 * Downloads and installs the latest version, replacing the current binary.
 * Intended to be called from the CLI (`agent-maestro update`).
 */
export async function performUpdate(): Promise<void> {
  console.log(`agent-maestro v${VERSION}`);
  console.log("Checking for updates…\n");

  let update: UpdateInfo | null;
  try {
    update = await checkForUpdate();
  } catch (e) {
    console.error(`Error checking for updates: ${(e as Error).message}`);
    process.exit(1);
  }

  if (!update) {
    console.log("Already up to date.");
    return;
  }

  // In a compiled Bun binary, process.execPath is the actual binary on disk.
  const binaryPath = process.execPath;

  // Verify the binary exists and we can determine its path.
  try {
    await stat(binaryPath);
  } catch {
    console.error(`Error: cannot locate current binary at ${binaryPath}`);
    process.exit(1);
  }

  console.log(`Downloading v${update.latestVersion}…`);

  const tempPath = join(tmpdir(), `agent-maestro-update-${Date.now()}`);

  try {
    const res = await fetch(update.downloadUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }

    const buffer = await res.arrayBuffer();
    await Bun.write(tempPath, buffer);
    await chmod(tempPath, 0o755);

    // Atomic replace: rename over the existing binary.
    // On Windows, this may fail if the binary is locked.
    await rename(tempPath, binaryPath);
  } catch (e) {
    // Clean up temp file on failure.
    try {
      const { unlink } = await import("fs/promises");
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors.
    }

    const message = (e as Error).message;
    if (message.includes("EACCES") || message.includes("permission")) {
      console.error(`\nError: permission denied writing to ${binaryPath}`);
      console.error("Try running with sudo or moving the binary to a user-writable location.");
    } else {
      console.error(`\nError updating: ${message}`);
    }
    process.exit(1);
  }

  console.log(`\n✓ Updated to v${update.latestVersion}`);
}
