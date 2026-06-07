# Fuzzy

Mac-first AI-native PDF reading workspace ("Cursor for reading").

## Stack

- Electron 39 + React 19 + Tailwind v4 + Zustand
- Main process: better-sqlite3, OpenAI BYOK, pdfjs-dist
- Package manager: **pnpm** (not npm/yarn)

## Commands

```bash
pnpm install
pnpm dev          # dev server (uses scripts/launch-electron.mjs)
pnpm build        # typecheck + electron-vite build
pnpm test         # vitest
pnpm typecheck    # tsc for main + renderer
pnpm lint         # eslint
pnpm build:mac    # macOS DMG
```

## Important dev gotcha

If `pnpm dev` crashes with `isPackaged` errors, the terminal has `ELECTRON_RUN_AS_NODE=1` leaked from Cursor/VS Code. Use `pnpm dev` (which strips it) or:

```bash
env -u ELECTRON_RUN_AS_NODE pnpm exec electron-vite dev
```

## Architecture

- `src/main/` — Electron main process (DB, AI, file I/O)
- `src/preload/` — typed IPC bridge
- `src/renderer/` — React UI
- `tests/` — vitest unit tests

## Conventions

- Keep changes minimal and focused
- Match existing patterns in surrounding code
- Main-process only for DB, AI keys, and filesystem
- Do not commit secrets (.env, API keys)
