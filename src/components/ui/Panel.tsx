import { Children, isValidElement } from "react";
import type { BoxProps } from "@opentui/react";
import { theme } from "../../lib/themes/default";

const defaults = {
  borderStyle: "rounded",
  paddingX: 1,
  titleAlignment: "left",
  borderColor: theme.border,
  focusedBorderColor: theme.borderFocused,
} satisfies Partial<BoxProps>;

function hasChildFocused(children: React.ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found) return;
    if (isValidElement<{ focused?: boolean }>(child) && child.props.focused) {
      found = true;
    }
  });
  return found;
}

export function Panel({ children, ...props }: BoxProps) {
  if (props.title) {
    props.title = ` ${props.title} `;
  }

  const childFocused = hasChildFocused(children);

  return (
    <box
      {...defaults}
      {...props}
      borderColor={childFocused ? theme.borderFocused : defaults.borderColor}
    >
      {children}
    </box>
  );
}
