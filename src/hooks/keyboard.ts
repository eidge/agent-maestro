import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { atom, useAtom } from "jotai";
import { useEffect } from "react";

type KeyboardShortCutRegistry = Record<string, string>;

const shortcutsAtom = atom<KeyboardShortCutRegistry>({});

export function useKeyboardShortcut(
  keyboardShortcut: string,
  description: string,
  callback: (e: KeyEvent) => void,
) {
  useKeyboard((e) => {
    if (e.name === keyboardShortcut) {
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
