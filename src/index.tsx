import { addDefaultParsers, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";
import { additionalParsers } from "./lib/syntax/parsers";
import { theme } from "./lib/themes/default";

addDefaultParsers(additionalParsers);

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 60,
  backgroundColor: theme.bg,
  consoleOptions: {
    sizePercent: 30,
  },
});

// The app registers many keyboard shortcuts (each adds a "keypress" listener).
// Raise the limit above the default 10 to avoid spurious Node warnings.
renderer.keyInput.setMaxListeners(50);

renderer.keyInput.on("keypress", (key) => {
  if (key.shift && key.name === "i") {
    renderer.console.toggle();
  }
});

createRoot(renderer).render(<App />);
