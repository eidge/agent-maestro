import { theme } from "../lib/themes/default";
import {
  ShortcutGroup,
  useKeyboardShortcutRegistry,
  type RegisteredShortcut,
} from "../hooks/keyboard";
import { Panel } from "./ui/Panel";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatKey(part: string): string {
  const segments = part.split("-");
  return segments.map((s) => (s.length > 1 ? capitalize(s) : s)).join("+");
}

function formatShortcut(shortcut: string): string {
  const keys = shortcut.trim().split(/\s+/);
  const formatted = keys.map(formatKey);

  // Collapse repeated keys (e.g. "g g" → "gg")
  if (formatted.length > 1 && formatted.every((k) => k === formatted[0])) {
    return formatted.join("");
  }

  return formatted.join(" → ");
}

/** Group display order — matches the enum declaration order. */
const groupOrder = Object.values(ShortcutGroup);

interface MergedShortcut {
  keys: string[];
  description: string;
}

function groupEntries(
  registry: Record<string, RegisteredShortcut>,
): { group: ShortcutGroup; shortcuts: MergedShortcut[] }[] {
  const grouped = new Map<ShortcutGroup, MergedShortcut[]>();

  for (const [key, { description, group }] of Object.entries(registry)) {
    let list = grouped.get(group);
    if (!list) {
      list = [];
      grouped.set(group, list);
    }

    // Merge with the last entry if the description matches (preserves registration order)
    const last = list[list.length - 1];
    if (last && last.description === description) {
      last.keys.push(key);
    } else {
      list.push({ keys: [key], description });
    }
  }

  return groupOrder
    .filter((g) => grouped.has(g))
    .map((g) => ({ group: g, shortcuts: grouped.get(g)! }));
}

function formatMergedKeys(keys: string[]): string {
  return keys.map(formatShortcut).join(" / ");
}

export function HelpMenu({ focused }: { focused?: boolean }) {
  const registry = useKeyboardShortcutRegistry();
  const groups = groupEntries(registry);

  const allMerged = groups.flatMap((g) => g.shortcuts);
  const keyColumnWidth = Math.max(16, ...allMerged.map((s) => formatMergedKeys(s.keys).length + 4));

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      zIndex={100}
    >
      <Panel
        title="Keyboard Shortcuts"
        flexDirection="column"
        backgroundColor={theme.bg}
        paddingX={2}
        paddingY={1}
        minWidth={40}
        maxWidth={60}
      >
        <box focused={focused} flexDirection="column">
          {groups.map(({ group, shortcuts }, groupIndex) => (
            <box key={group} flexDirection="column" marginTop={groupIndex > 0 ? 1 : 0}>
              {/* Group heading */}
              <box marginBottom={0}>
                <text>
                  <span fg={theme.accent}>
                    <strong>{group}</strong>
                  </span>
                </text>
              </box>

              {/* Shortcuts in this group */}
              {shortcuts.map(({ keys, description }) => (
                <box key={keys.join(",")} flexDirection="row">
                  <box width={keyColumnWidth}>
                    <text>
                      <span fg={theme.accentAlt}>
                        <strong>{formatMergedKeys(keys)}</strong>
                      </span>
                    </text>
                  </box>
                  <box flexGrow={1}>
                    <text fg={theme.text}>{description}</text>
                  </box>
                </box>
              ))}
            </box>
          ))}

          {/* Footer */}
          <box justifyContent="center" marginTop={1}>
            <text fg={theme.textMuted}>
              Press <span fg={theme.accent}>?</span> or <span fg={theme.accent}>Escape</span> to
              close
            </text>
          </box>
        </box>
      </Panel>
    </box>
  );
}
