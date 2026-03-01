import { useKeyboardShortcut } from "../hooks/keyboard";
import { theme } from "../lib/styles/default";

interface SplashScreenProps {
  onDismiss: () => void;
}

export function SplashScreen(props: SplashScreenProps) {
  useKeyboardShortcut("return", "quit", props.onDismiss);

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="flex-end">
        <ascii-font font="tiny" text="Agent-Maestro" color={theme.accent} />
        <text fg={theme.textMuted}>Keep your agent orchestra in check.</text>
      </box>
      <box justifyContent="center" alignItems="center" marginTop={3}>
        <text fg={theme.textSubtle}>Press enter to start</text>
      </box>
    </box>
  );
}
