import { useEffect, useState } from "react";
import { theme } from "../lib/themes/default";

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function LoadingScreen() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <ascii-font font="tiny" text="Agent-Maestro" color={theme.accent} />
      <box justifyContent="center" alignItems="center" marginTop={2}>
        <text fg={theme.textMuted}>
          <span fg={theme.accent}>{spinnerFrames[frame]}</span> Loading git data
        </text>
      </box>
    </box>
  );
}
