import { useEffect, useState } from "react";
import { checkForUpdate, isCompiledBinary } from "../lib/updater";

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
}

/**
 * Fires a background check for updates on mount.
 * Only runs when packaged as a compiled binary.
 * Silently catches errors — network failures never surface to the user.
 */
export function useUpdateCheck(): UpdateCheckResult {
  const [result, setResult] = useState<UpdateCheckResult>({
    updateAvailable: false,
    latestVersion: null,
  });

  useEffect(() => {
    if (!isCompiledBinary()) return;

    let cancelled = false;

    checkForUpdate()
      .then((update) => {
        if (cancelled || !update) return;
        setResult({ updateAvailable: true, latestVersion: update.latestVersion });
      })
      .catch(() => {
        // Silently ignore — update check is best-effort.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
