import { theme } from "../lib/themes/default";

interface UpdateBannerProps {
  latestVersion: string;
}

export function UpdateBanner({ latestVersion }: UpdateBannerProps) {
  return (
    <box marginLeft={2} paddingY={0}>
      <text>
        <span fg={theme.textMuted}>
          update available: <strong>v{latestVersion}</strong> — run{" "}
        </span>
        <span fg={theme.accent}>
          <strong>agent-maestro update</strong>
        </span>
      </text>
    </box>
  );
}
