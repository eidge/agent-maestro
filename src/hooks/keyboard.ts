import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { atom, useAtom } from "jotai";
import { useEffect, useRef } from "react";

export enum ShortcutGroup {
  General = "General",
  Navigation = "Navigation",
  Diff = "Diff",
  Comment = "Comment",
}

export interface RegisteredShortcut {
  description: string;
  group: ShortcutGroup;
}

type KeyboardShortCutRegistry = Record<string, RegisteredShortcut>;

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

/**
 * Parse a shortcut string that may contain a sequence of keys separated by spaces.
 * Each key in the sequence can include modifiers (e.g. `"g g"`, `"ctrl-k ctrl-s"`).
 */
export function parseShortcutSequence(shortcut: string): ParsedShortcut[] {
  return shortcut.trim().split(/\s+/).map(parseShortcut);
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
  group: ShortcutGroup,
  callback: (e: KeyEvent) => void,
) {
  const sequence = parseShortcutSequence(keyboardShortcut);
  const positionRef = useRef(0);

  useKeyboard((e) => {
    const expected = sequence[positionRef.current]!;

    if (matchesShortcut(e, expected)) {
      positionRef.current++;
      if (positionRef.current >= sequence.length) {
        positionRef.current = 0;
        callback(e);
      }
    } else {
      // Reset, then check if this key starts the sequence over
      positionRef.current = 0;
      if (matchesShortcut(e, sequence[0]!)) {
        positionRef.current = 1;
        if (sequence.length === 1) {
          positionRef.current = 0;
          callback(e);
        }
      }
    }
  });

  const [, setShortcuts] = useAtom(shortcutsAtom);

  useEffect(() => {
    setShortcuts((prev) => {
      if (keyboardShortcut in prev) {
        throw new Error(`Keyboard shortcut (${keyboardShortcut}) already registered.`);
      }
      return { ...prev, [keyboardShortcut]: { description, group } };
    });

    return () => {
      setShortcuts((prev) => {
        const newCopy = { ...prev };
        delete newCopy[keyboardShortcut];
        return newCopy;
      });
    };
  }, [description, group, keyboardShortcut, setShortcuts]);
}

export function useKeyboardShortcutRegistry(): KeyboardShortCutRegistry {
  const [registry] = useAtom(shortcutsAtom);
  return registry;
}
