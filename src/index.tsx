import { addDefaultParsers, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";
import { additionalParsers } from "./lib/syntax/parsers";

addDefaultParsers(additionalParsers);

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 60,
  consoleOptions: {
    sizePercent: 30,
  },
});

renderer.keyInput.on("keypress", (key) => {
  if (key.ctrl && key.name === "l") {
    renderer.console.toggle();
  }
});

createRoot(renderer).render(<App />);
