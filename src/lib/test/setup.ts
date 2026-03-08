import { EventEmitter } from "events";

// Each test creates a renderer that adds keypress listeners.
// With many tests per file the default limit (10) is exceeded before
// the previous renderer is destroyed, producing noisy warnings.
EventEmitter.defaultMaxListeners = 50;

// OpenTUI's TreeSitterClient unconditionally logs "TSWorker: ..." messages
// when the worker loads parser WASM files. There's no config to disable them.
const originalConsoleLog = console.log;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("TSWorker:")) return;
  originalConsoleLog.apply(console, args);
};
