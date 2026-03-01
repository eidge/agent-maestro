# Formatting

Use `bun format` to format code instead of reformatting manually. Prettier is configured for the project and should be the single source of truth for code style.

# Verification

After making changes, always run:

- `bun test` — run tests
- `bun lint` — typecheck and lint

# Testing Conventions

- Test files live next to source files: `foo.ts` → `foo.test.ts`
- Use `describe` blocks to group tests by function/hook, not comments
- Nest `describe` blocks for logical sections (e.g. `describe("useGitData") > describe("initial load")`)

# File Naming Conventions

- **PascalCase** for files that export React components (`MainScreen.tsx`, `CommitSelector.tsx`, `Panel.tsx`)
- **kebab-case** for everything else — hooks, libs, utilities (`git-data.ts`, `keyboard.ts`)
