import { TextAttributes } from "@opentui/core";
import { useKeyboardShortcut } from "../hooks/keyboard";

interface SplashScreenProps {
  onDismiss: () => void;
}

export function SplashScreen(props: SplashScreenProps) {
  useKeyboardShortcut("return", "quit", props.onDismiss);

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="flex-end">
        <ascii-font font="tiny" text="Agent-Maestro" />
        <text attributes={TextAttributes.DIM}>Keep your agent orchestra in check.</text>
      </box>
      <box justifyContent="center" alignItems="center" marginTop={3}>
        <text>Press enter to start</text>
      </box>
    </box>
  );
}
