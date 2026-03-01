import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { atom, useAtom } from "jotai";
import { useEffect } from "react";

type KeyboardShortCutRegistry = Record<string, string>;

const shortcutsAtom = atom<KeyboardShortCutRegistry>({});

const MODIFIER_NAMES = new Set(["ctrl", "shift", "alt", "meta"]);

export interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split("-");
  const modifiers = parts.filter((p) => MODIFIER_NAMES.has(p));
  const keyParts = parts.filter((p) => !MODIFIER_NAMES.has(p));

  if (keyParts.length !== 1) {
    throw new Error(
      `Invalid keyboard shortcut "${shortcut}": expected exactly one key name, got ${keyParts.length === 0 ? "none" : `"${keyParts.join("-")}"`}.`,
    );
  }

  return {
    key: keyParts[0]!,
    ctrl: modifiers.includes("ctrl"),
    shift: modifiers.includes("shift"),
    alt: modifiers.includes("alt") || modifiers.includes("meta"),
  };
}

export function matchesShortcut(e: KeyEvent, parsed: ParsedShortcut): boolean {
  return (
    e.name === parsed.key &&
    e.ctrl === parsed.ctrl &&
    e.shift === parsed.shift &&
    e.meta === parsed.alt
  );
}

export function useKeyboardShortcut(
  keyboardShortcut: string,
  description: string,
  callback: (e: KeyEvent) => void,
) {
  const parsed = parseShortcut(keyboardShortcut);

  useKeyboard((e) => {
    if (matchesShortcut(e, parsed)) {
      callback(e);
    }
  });

  const [, setShortcuts] = useAtom(shortcutsAtom);

  useEffect(() => {
    setShortcuts((prev) => {
      if (keyboardShortcut in prev) {
        throw new Error(`Keyboard shortcut (${keyboardShortcut}) already registered.`);
      }
      return { ...prev, [keyboardShortcut]: description };
    });

    return () => {
      setShortcuts((prev) => {
        const newCopy = { ...prev };
        delete newCopy[keyboardShortcut];
        return newCopy;
      });
    };
  }, [description, keyboardShortcut, setShortcuts]);
}

export function useKeyboardShortcutRegistry(): KeyboardShortCutRegistry {
  const [registry] = useAtom(shortcutsAtom);
  return registry;
}
