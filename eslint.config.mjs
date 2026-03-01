import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  { ignores: [".agents/skills/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      // Hooks rules — these work as-is with OpenTUI
      ...reactHooks.configs.recommended.rules,

      // Disable DOM-specific rules that don't apply to OpenTUI
      "react/no-unknown-property": "off",
      "react/jsx-no-target-blank": "off",
      "react/no-unescaped-entities": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  prettier,
];
