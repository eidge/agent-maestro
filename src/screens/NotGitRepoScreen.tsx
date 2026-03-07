import { useKeyboard, useRenderer } from "@opentui/react";
import { theme } from "../lib/themes/default";

export interface NotGitRepoScreenProps {
  onExit?: () => void;
}

export function NotGitRepoScreen({ onExit }: NotGitRepoScreenProps = {}) {
  const renderer = useRenderer();

  useKeyboard((e) => {
    if (e.eventType !== "press") return;
    if (e.name === "return" || e.name === "escape") {
      if (onExit) {
        onExit();
      } else {
        renderer.destroy();
      }
    }
  });

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <ascii-font font="tiny" text="Agent-Maestro" color={theme.accent} />
      <box justifyContent="center" alignItems="center" marginTop={2}>
        <text fg={theme.removed}>Current directory is not a git repo</text>
      </box>
      <box justifyContent="center" alignItems="center" marginTop={1}>
        <text fg={theme.textMuted}>
          Press <span fg={theme.accent}>enter</span> or <span fg={theme.accent}>escape</span> to
          exit
        </text>
      </box>
    </box>
  );
}
