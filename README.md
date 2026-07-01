# Fuzzy

Fuzzy is a Mac-first, local-first reading and study workspace for PDFs, EPUBs,
Word documents, Markdown, plain text, and MOBI files. It combines a focused
desktop reader with AI tutoring, durable highlights, study packs, evidence
search, writing tools, and reading analytics.

The product is built as an Electron application with React, TypeScript, and
SQLite. Documents and study state stay on the user's machine; model access is
bring-your-own-key and can be replaced by deterministic offline mock behavior.

**Repository:** [github.com/gangisettyrushil10/fuzzy](https://github.com/gangisettyrushil10/fuzzy)

## What Fuzzy can do

- Import and read PDF, EPUB, TXT, Markdown, DOCX, and MOBI files
- Restore reading position and maintain a local library
- Highlight passages and attach anchored notes
- Import external highlights and search them locally
- Review highlights with spaced repetition
- Ask questions grounded in the current document
- Generate summaries, glossaries, argument maps, and tone analysis
- Search evidence and entities across a document
- Build reading plans for a time budget
- Generate study packs with summaries, flashcards, quizzes, and concepts
- Track quiz attempts and flashcard review schedules
- Create research projects with a thesis, evidence, notes, and syntheses
- Draft essay outlines and paragraphs from selected evidence
- Run focus sessions and reading statistics
- Export highlights and study materials
- Switch into an ambient reading mode that reacts to the document and scroll

## Technology

| Area | Technology |
| --- | --- |
| Desktop shell | Electron 39, electron-vite |
| Interface | React 19, TypeScript, Tailwind CSS 4, Zustand |
| Persistence | SQLite through `better-sqlite3` |
| Documents | PDF.js, JSZip, Mammoth, format-specific extractors |
| AI | OpenAI SDK with OpenAI-compatible providers |
| Local retrieval | Transformers.js and local embeddings |
| Tests | Vitest and Playwright |
| Packaging | electron-builder |

## Architecture

Fuzzy uses Electron's process boundaries deliberately:

```text
Main process
├── file import and extraction
├── SQLite repositories and migrations
├── model/provider calls
├── path and URL safety checks
└── domain IPC handlers

Preload
└── typed, allowlisted bridge exposed to the renderer

Renderer
├── React reading interface
├── Zustand feature stores
├── document readers and study tools
└── no direct filesystem, database, or secret access
```

The main process currently registers separate IPC slices for documents,
annotations, AI actions, settings, reading sessions, study packs, review,
highlights, thesis work, projects, synthesis, focus sessions, summaries,
evidence, tone, asking, essays, argument maps, glossary, and ambience.

## Local-first data model

SQLite stores:

- Documents and extracted pages
- Annotations and model responses
- Reading sessions and plans
- Study packs, quiz attempts, and flashcard reviews
- Cross-source highlights and full-text search
- Research projects, evidence, notes, and syntheses
- Essays, entities, embeddings, settings, and focus history

AI keys are encrypted through the operating-system credential facilities and
are not exposed to the renderer process.

## Local setup

### Prerequisites

- macOS 13+ recommended
- Node.js 20+
- pnpm

### Install and run

```bash
git clone https://github.com/gangisettyrushil10/fuzzy.git
cd fuzzy
pnpm install
pnpm dev
```

A bundled sample document is available for development and smoke testing.

## AI providers

Fuzzy supports two runtime modes:

1. **Mock** — deterministic, offline behavior for development and demos.
2. **OpenAI-compatible** — a user-supplied key, model, and optional base URL.

The current defaults target Groq's OpenAI-compatible endpoint. Users can point
the app at OpenAI, OpenRouter, or a compatible local server such as Ollama from
Settings.

Examples:

```text
Groq:       https://api.groq.com/openai/v1
OpenAI:     https://api.openai.com/v1
Ollama:     http://localhost:11434/v1
```

Provider capabilities vary. Fuzzy uses local embeddings when the configured
chat provider does not expose an embeddings API.

## Commands

```bash
pnpm dev          # development app
pnpm start        # preview the built app
pnpm lint         # ESLint
pnpm typecheck    # main/preload and renderer TypeScript checks
pnpm test         # Vitest suite
pnpm build        # typecheck and electron-vite build
pnpm test:e2e     # build and run the Electron Playwright smoke test
pnpm build:mac    # local macOS package
pnpm build:mas    # Mac App Store target
pnpm install:local
```

## Packaging

`electron-builder.yml` contains macOS, Windows, and Linux targets. The current
product focus is macOS.

Local macOS packages are unsigned by default. Public distribution requires:

- A Developer ID Application certificate
- Hardened runtime and correct entitlements
- Apple notarization
- Release signing secrets supplied outside the repository

See [`docs/MACOS_PACKAGING_READINESS.md`](docs/MACOS_PACKAGING_READINESS.md).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘O` | Import a document |
| `⌘K` | Open the command palette |
| `⌘,` | Open settings |
| `⌘⇧P` | Plan a study session |
| `⌘⇧S` | Open or build a study pack |
| `Escape` | Close the active palette, modal, or selection menu |
| `←` / `→` | Previous or next page when focus is outside an input |

## Troubleshooting

### Electron launches as plain Node

Some Electron-based IDE terminals set `ELECTRON_RUN_AS_NODE=1`. Fuzzy's launch
script removes it automatically. If you invoke `electron-vite` directly:

```bash
env -u ELECTRON_RUN_AS_NODE pnpm exec electron-vite dev
```

### `better-sqlite3` ABI mismatch

Rebuild the native dependency for the installed Electron version:

```bash
pnpm rebuild better-sqlite3
pnpm exec electron-builder install-app-deps
```

### Renderer cannot reconnect after reload

Stop the dev command, close any stale process on port `5173`, and restart
`pnpm dev`.

## Documentation

- [`docs/PROJECT_AUDIT_2026-06-03.md`](docs/PROJECT_AUDIT_2026-06-03.md)
- [`docs/STABILIZATION_REPORT.md`](docs/STABILIZATION_REPORT.md)
- [`docs/LOCAL_RUNTIME_VERIFICATION_2026-06-03.md`](docs/LOCAL_RUNTIME_VERIFICATION_2026-06-03.md)
- [`docs/MACOS_PACKAGING_READINESS.md`](docs/MACOS_PACKAGING_READINESS.md)

## Privacy and security

- Imported documents remain local unless text is sent to the configured model.
- Model requests may include selected passages or document context; users
  should not process material they are not permitted to share with that
  provider.
- File and URL operations pass through main-process safety checks.
- Mock mode allows the core interface to be exercised without a network call.

## Project status

Fuzzy is under active development. Core reading, persistence, study, highlight,
research, and writing workflows are implemented. Signed/notarized distribution,
provider-specific reliability, and full cross-platform packaging still require
release-environment validation.
