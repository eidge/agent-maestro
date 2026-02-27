import { createCliRenderer } from "@opentui/core";
import { createRoot, useRenderer } from "@opentui/react";
import { SplashScreen } from "./screens/splash";
import { useKeyboardShortcutRegistry } from "./hooks/keyboard";
import { useEffect } from "react";

function App() {
  const shortcuts = useKeyboardShortcutRegistry()
  const renderer = useRenderer()

  const onDismissSplashScreen = () => {
    renderer.destroy()
    process.exit(0)
  }

  useEffect(() => {
    console.log(shortcuts)
  }, [shortcuts])

  return (
    <SplashScreen onDismiss={onDismissSplashScreen} />
  );
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  consoleOptions: {
    sizePercent: 30,
  }
});

renderer.keyInput.on("keypress", (key) => {
  if (key.ctrl && key.name === "l") {
    renderer.console.toggle()
  }
})

createRoot(renderer).render(<App />);
