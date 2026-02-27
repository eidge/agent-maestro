import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";

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
