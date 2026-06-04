# Fuzzy

Mac-first AI-native PDF reading workspace. Cursor for reading.

## Recommended IDE setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project setup

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Other scripts:

```bash
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit for main + renderer
pnpm test        # vitest run
pnpm build       # typecheck + electron-vite build
pnpm build:mac   # build a mac DMG
pnpm test:e2e    # Playwright Electron smoke (requires pnpm build first)
```

## Keyboard shortcuts (macOS)

| Shortcut | Action |
|---|---|
| ⌘O | Import PDF |
| ⌘K | Command palette |
| ⌘, | Settings |
| ⌘⇧P | Plan study session |
| ⌘⇧S | Open / build study pack |
| Escape | Close palette, modals, or selection menu |
| ← / → | Previous / next page (when not typing) |

## Troubleshooting

### `pnpm dev` crashes with `TypeError: Cannot read properties of undefined (reading 'isPackaged')`

This happens when the shell that runs `pnpm dev` has `ELECTRON_RUN_AS_NODE=1` set in its environment. VS Code, Cursor, and other Electron-based IDEs set this for their *own* extension host; the variable leaks into integrated-terminal `pnpm` commands and forces our Electron binary to behave as plain Node. `@electron-toolkit/utils` then reads `electron.app.isPackaged` and crashes because the Electron API is not exposed.

Fuzzy's `dev` and `start` scripts launch through [`scripts/launch-electron.mjs`](scripts/launch-electron.mjs), which deletes `ELECTRON_RUN_AS_NODE` from the child environment before spawning `electron-vite`. If you're invoking `electron-vite` directly (not through `pnpm dev`) you'll need to do the same yourself, for example:

```bash
env -u ELECTRON_RUN_AS_NODE pnpm exec electron-vite dev
```

### `pnpm dev` crashes with a native-module error (e.g. `better-sqlite3` ABI mismatch)

`better-sqlite3` is a native module and must be rebuilt against the Electron ABI. The repo's `postinstall` hook runs `electron-builder install-app-deps` automatically. If you suspect drift (typically after switching Electron versions or copying `node_modules` between machines), rebuild manually:

```bash
pnpm rebuild better-sqlite3
# or, in one shot:
pnpm exec electron-builder install-app-deps
```

### App launches but Cmd+R in DevTools throws "Could not connect to renderer"

Usually a stale Vite dev server. Stop `pnpm dev`, kill any process holding port 5173, and restart.
