# Fuzzy — Full Project Audit (Study OS / “Cursor for Reading”)

**Date:** 2026-06-03  
**Version:** 0.1.0  
**Purpose:** Give any AI assistant (ChatGPT, etc.) a complete picture of what exists, what works, and what still needs to be built to reach the product vision.

---

## 1. Product Vision

**Fuzzy** is a Mac-first, AI-native **study IDE** — the reading/studying analogue of what Cursor is for coding.

| Cursor (coding) | Fuzzy (studying) — target |
|---|---|
| Workspace + file tree | Document library + reading workspace |
| Inline AI on selection | Floating AI menu on PDF text selection |
| Chat / agent panel | AI Tutor panel (explain, quiz, etc.) |
| Command palette (⌘K) | Quick actions: import, plan session, generate pack, search |
| Indexing + semantic search | Full-text + concept search across library |
| Composer / multi-step agent | Study packs, reading plans, follow-up tutoring |
| Local-first + optional cloud | Local SQLite library; BYOK OpenAI; no cloud yet |
| Extensions | Future: LMS import, export formats, spaced repetition |

**Current reality:** Fuzzy is a **solid v0.1 prototype** with the core “select text → AI explains → save note” loop, plus reading plans and study packs. It does **not** yet feel like a full “study OS” — missing command palette, search, streaming, OCR, onboarding, distributable packaging, and most agent-style workflows.

---

## 2. Executive Summary

### What works today (verified in code + prior stabilization passes)

- **Electron 39** three-process app: main (Node/DB/AI/fs) → preload (typed bridge) → renderer (React 19 + Tailwind v4)
- **PDF import** with SHA-256 dedupe, copy to `~/Library/Application Support/fuzzy/library/`
- **Import-time full indexing** — all pages extracted in main process on import (`pdfTextExtractor.ts` + `bulkUpsertPages`)
- **Per-page renderer extraction** as fallback during reading
- **PDF rendering** — hi-DPI canvas, selectable PDF.js text layer, paginated nav, zoom 50–300%
- **6 AI actions** on selection: Explain, Simplify, Summarize, Define, Example, Quiz Me
- **OpenAI BYOK** with Keychain encryption (`safeStorage`); mock provider for offline
- **AI Tutor panel** — single-shot Q&A with save-as-note
- **Margin notes** — `rectsOnPage` captured on selection; translucent overlay + gutter dot on page
- **Reading plan** — time-budget planner + session timer + per-page mode badge (deep read / skim / review)
- **Study pack** — structured JSON output (summary, concepts, flashcards, quiz) via OpenAI or mock
- **SQLite persistence** — 7 tables, WAL, foreign keys, cascade deletes
- **Security hardening** — sandboxed renderer, path-restricted file reads, prompt-injection mitigations, sanitized OpenAI errors, dev-only IPC gated
- **CI** — GitHub Actions on macOS: lint, typecheck, test, build
- **Unit tests** — 9 test files covering path safety, prompts, mock AI, file service, reading plan, rects, PDF text flattening, annotation validation, URL safety

### Biggest gaps vs “Cursor for studying”

1. **No command palette or global keyboard model** (⌘O advertised but unbound; no ⌘K)
2. **No search** — cannot search notes, library, or document text
3. **No streaming AI** — tutor and study pack are blocking single completions
4. **No OCR** — scanned/image PDFs are unreadable to AI
5. **No conversation / agent layer** — tutor is one-shot, no follow-ups or multi-step study workflows
6. **No export** — notes, packs, flashcards cannot leave the app
7. **Not shippable** — unsigned DMG, placeholder `appId`, no release workflow
8. **Thin polish** — no onboarding, no sample PDF, minimal motion/a11y, sidebar note click doesn’t scroll-to-passage

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Desktop | Electron ^39.2.6, electron-vite ^5, electron-builder ^26 |
| UI | React ^19.2, Tailwind CSS v4, Zustand ^5 |
| PDF | pdfjs-dist ^5.7 (renderer + main-process legacy build for import indexing) |
| DB | better-sqlite3 ^12.9 (main process only) |
| AI | openai ^6.37 (main process only); mock provider |
| Tests | Vitest ^4.1 |
| Package manager | pnpm |

**Scripts:** `pnpm dev` | `pnpm build` | `pnpm build:mac` | `pnpm test` | `pnpm typecheck` | `pnpm lint`

**Dev note:** `pnpm dev` routes through `scripts/launch-electron.mjs` which strips `ELECTRON_RUN_AS_NODE` (set by VS Code/Cursor terminals) to prevent startup crashes.

---

## 4. Architecture

```
fuzzy/
├── src/
│   ├── main/           # Electron main: DB, fs, AI, IPC handlers
│   │   ├── db/schema.sql + repositories/
│   │   ├── ipc/        # health, document, annotation, ai, settings, readingSession, studyPack
│   │   └── services/   # fileService, dbService, settingsService, pathSafety, urlSafety,
│   │                   # pdfTextExtractor, readingPlanService, studyPackService, ai/
│   ├── preload/        # contextBridge → window.fuzzy (typed FuzzyApi)
│   ├── renderer/       # React app: AppShell, PDF reader, tutor, settings, study/reading modals
│   └── shared/         # ipc/channels.ts, types/api.ts, types/database.ts
├── tests/              # 9 Vitest unit test files
├── .github/workflows/ci.yml
├── electron-builder.yml   # NOT production-ready
└── docs/                  # Prior audits + this file
```

### IPC surface (`window.fuzzy`)

| Namespace | Methods |
|---|---|
| `health` | `ping` |
| `documents` | `list`, `get`, `touch`, `delete`, `import`, `readFile`, `recordPageExtraction` |
| `pages` | `listForDocument` |
| `annotations` | `listForDocument`, `create`, `delete` |
| `aiResponses` | `listForDocument` |
| `ai` | `runAction` |
| `readingSessions` | `create`, `getLatest` |
| `studyPacks` | `generate`, `getLatest` |
| `settings` | `get`, `setProviderMode`, `setOpenaiKey`, `validateOpenaiKey`, `setOpenaiModel`, `clearOpenaiKey`, `setLastActiveDocumentId` |
| `dev` (dev only) | `seedDocument` |

### State management (renderer)

Six Zustand stores: `documentStore`, `pdfStore`, `selectionStore`, `tutorStore`, `annotationStore`, `settingsStore`, plus `readingSessionStore`, `studyPackStore`.

### Database schema (SQLite)

| Table | Status |
|---|---|
| `documents` | ✅ used |
| `pages` | ✅ used (text, word count; `complexity_score` column exists but always 0) |
| `annotations` | ✅ used (insert/list/delete; no update) |
| `ai_responses` | ✅ used (tokens, latency; `cost_usd` always null) |
| `reading_sessions` | ✅ used |
| `study_packs` | ✅ used (append-only; latest shown) |
| `settings` | ✅ used |

**Not in schema:** embeddings, chunks, ingestion_jobs, analytics, FTS virtual tables.

---

## 5. Feature Completeness Matrix

Legend: ✅ Complete · ⚠️ Partial · ❌ Missing

| Feature | Status | Notes |
|---|---|---|
| Mac Electron shell (hidden titlebar, dark IDE aesthetic) | ✅ | `titleBarStyle: hiddenInset`, drag regions |
| Secure architecture (sandbox, contextIsolation, typed IPC) | ✅ | No renderer Node; keys never cross to renderer |
| PDF import + dedupe | ✅ | Native picker; SHA-256 hash |
| Full-document indexing on import | ✅ | Main-process pdfjs legacy extract |
| PDF render + text selection | ✅ | Single-page mode; keyboard arrows |
| Floating AI selection menu (6 actions) | ✅ | No icons; dismiss via ✕ |
| AI Tutor panel | ⚠️ | Works but: static loading, no stream, no follow-up, no copy/regenerate |
| OpenAI provider + mock fallback | ✅ | Token caps, usage capture, sanitized errors |
| Anthropic / local LLM providers | ❌ | Abstraction exists; only openai + mock |
| API key in Keychain | ✅ | `safeStorage`; `validateOpenaiKey` IPC exists |
| Save AI output as margin note | ✅ | Persists with `rectsOnPage` |
| On-page margin note overlay | ✅ | Purple highlight + gutter dot |
| Notes sidebar | ⚠️ | Lists notes; click jumps to **page top only** (no scroll-to-passage flash) |
| User highlights (non-AI) | ❌ | Types support `highlight` + colors; no UI to create them |
| Reading plan generator | ✅ | Heuristic deep/skim/review; modal + bottom bar |
| Reading session timer | ⚠️ | Wall-clock only; doesn’t pause; plan is static mid-session |
| Study pack generator | ✅ | OpenAI JSON schema or mock; modal with tabs |
| Study pack history | ⚠️ | Multiple rows accumulate; only latest shown |
| Last-opened document restore | ✅ | `lastActiveDocumentId` setting |
| Stale PDF load guard | ✅ | `loadToken` in pdfStore |
| Command palette (⌘K) | ❌ | |
| Keyboard shortcuts (⌘O, ⌘,, Escape) | ❌ | ⌘O shown in tooltip but not bound |
| In-document search | ❌ | |
| Library / notes full-text search | ❌ | No FTS5 |
| OCR for scanned PDFs | ❌ | |
| Password-protected PDFs | ❌ | Error dead-end |
| EPUB / web articles / other formats | ❌ | PDF only |
| Export (Markdown, Anki, CSV) | ❌ | |
| Spaced repetition scheduler | ❌ | |
| Cross-document memory / concept graph | ❌ | |
| Onboarding / sample paper | ❌ | Empty state is import-only |
| Streaming AI responses | ❌ | |
| Multi-tab / multi-doc workspace | ❌ | Single active document |
| Resizable panels | ❌ | Fixed sidebar widths |
| CI (lint + test + build) | ✅ | macos-latest |
| E2E tests (Playwright Electron) | ❌ | |
| Signed + notarized macOS release | ❌ | `appId: com.electron.app`, `notarize: false` |
| Windows / Linux support | ⚠️ | electron-builder configs exist; untested |

---

## 6. What Is Built (Detailed)

### 6.1 Core reading loop

1. User imports PDF → copied to library, indexed in main process
2. Document opens in center pane (`PdfReader` → `PdfPage`)
3. User selects text → floating menu appears
4. User picks action → `ai:runAction` IPC → OpenAI or mock → result in right tutor panel
5. User can “save as note” → annotation with page-relative rects → overlay renders on page

### 6.2 Reading plan flow

1. User clicks “Plan session” in bottom bar
2. `ReadingPlanModal` → preset minutes (10–90) or custom
3. `readingPlanService.generateReadingPlan()` ranks pages by word density
4. Plan saved to `reading_sessions`; bottom bar shows mode badge + optional timer

### 6.3 Study pack flow

1. User clicks “Build study pack” in left sidebar
2. `studyPackService` samples document text (12k char cap), calls OpenAI with strict JSON schema
3. Result saved to `study_packs`; `StudyPackPanel` shows Summary / Concepts / Flashcards / Quiz tabs

### 6.4 AI safety & cost controls

- `max_completion_tokens`: 900 (tutor actions), 1400 (study pack)
- `contextText` capped at 12k chars; `selectedText` at 8k
- Prompt wrapping: `<passage>` / `<context>` tags + safety preamble + tag neutralization
- Token usage persisted on `ai_responses`; cost calculation not implemented

### 6.5 Tests (9 files)

| File | Covers |
|---|---|
| `pathSafety.test.ts` | Library path confinement, symlink escape |
| `prompts.test.ts` | Injection hardening, tag wrapping |
| `mockProvider.test.ts` | Offline AI responses |
| `fileService.test.ts` | Import dir, read/unlink safety |
| `pdfTextExtractor.test.ts` | Text flattening heuristics |
| `readingPlan.test.ts` | Plan generation invariants |
| `rects.test.ts` | Selection rect normalization |
| `annotationValidation.test.ts` | IPC input validation |
| `urlSafety.test.ts` | External URL scheme allowlist |

**Not tested:** DB repositories (better-sqlite3 Electron ABI vs Node), renderer components, E2E flows.

---

## 7. What Is Left to Build

Organized by priority for reaching “study IDE” parity with Cursor’s feel.

### P0 — Ship a credible private beta

| # | Item | Why | Acceptance criteria |
|---|---|---|---|
| 1 | **Keyboard model** | Cursor is keyboard-first | Bind ⌘O (import), ⌘, (settings), Escape (dismiss menu/modals); document all shortcuts |
| 2 | **Command palette (⌘K)** | Central discovery surface | Searchable actions: import, plan session, study pack, go to page, open settings |
| 3 | **Note navigation polish** | Notes feel disconnected | Sidebar note click scrolls to + flashes saved passage using `rectsOnPage` |
| 4 | **Selection menu tracking** | Menu drifts on scroll/zoom | Recompute position from live selection or hide on scroll |
| 5 | **Tutor panel v2** | Core AI UX | Stream tokens; copy/regenerate; follow-up questions; map error codes to retry/settings |
| 6 | **Onboarding + sample PDF** | First-run activation | Coachmark for selection menu; bundled sample paper; “Try sample” on empty state |
| 7 | **Packaging** | Actually distributable | Real `appId` (e.g. `com.fuzzy.app`); notarize; release workflow; remove camera/mic plist strings |
| 8 | **E2E smoke test** | Regression safety | Playwright: import → render → select → explain → save → relaunch |

### P1 — Differentiators (why Fuzzy ≠ a PDF reader + ChatGPT)

| # | Item | Why | Acceptance criteria |
|---|---|---|---|
| 9 | **In-document + library search** | Study OS needs recall | FTS5 over pages + annotations; ⌘F in doc; global search in palette |
| 10 | **OCR pipeline** | Scanned papers are common | Tesseract.js worker; `ocr_pending` page state; retry UI |
| 11 | **Document-level chat / agent** | Cursor’s agent for reading | Persistent per-document thread; “ask about this paper” with retrieved context |
| 12 | **Smarter reading plan** | Adaptive studying | Use `complexity_score`; adapt mid-session; pause timer on blur |
| 13 | **Study pack ↔ notes integration** | Closed loop | Turn saved notes into flashcards; spaced repetition queue |
| 14 | **Export** | Users need portability | Markdown notes export; Anki deck from flashcards; CSV quiz |
| 15 | **Highlight tool** | Basic annotation UX | Drag-to-highlight with color picker (types already exist) |

### P2 — Platform expansion

| # | Item | Notes |
|---|---|---|
| 16 | Anthropic provider | Same abstraction as OpenAI |
| 17 | Local model support (Ollama) | Privacy / offline |
| 18 | EPUB + HTML import | Beyond PDF |
| 19 | Multi-document tabs | Compare papers side-by-side |
| 20 | Resizable panels | `react-resizable-panels` or similar |
| 21 | Continuous scroll mode | Alternative to paginated reader |
| 22 | Password PDF unlock | Prompt + retry |
| 23 | Embeddings + semantic search | Chunk service; vector store table |
| 24 | LMS ingestion (Canvas/Moodle) | Roadmap item from original PRD |
| 25 | Cloud sync (optional) | Multi-device library |

### P3 — Polish & scale

- Bundle splitting (`React.lazy`) — renderer ~1.43 MB single chunk
- Schema version migrations (beyond `ensureColumn`)
- `cost_usd` calculation from model pricing table
- Study pack deduplication / versioning UI
- Motion language, semantic color tokens, lucide icons
- Settings modal a11y (focus trap, `role="dialog"`, Escape)
- Windows/Linux QA pass
- Telemetry (opt-in only, if ever)

---

## 8. Known Issues & Technical Debt

| Issue | Severity | Location / notes |
|---|---|---|
| `AiActionType` has unused values (`why_it_matters`, `margin_note`) not in IPC allowlist | Low | `database.ts` vs `ai.ipc.ts` drift |
| `complexity_score` always 0 | Medium | Column exists; reading plan uses word count only |
| `cost_usd` never computed | Low | Tokens captured; pricing table missing |
| Study packs append-only | Low | Old packs orphaned in DB |
| Reading timer is wall-clock | Low | Misleading for distracted sessions |
| Mock study pack is thin | Low | By design for offline smoke |
| No `annotations:update` | Low | Can't edit notes after save |
| Dedupe with missing on-disk file | Medium | Orphan row if PDF manually deleted from library folder |
| Renderer bundle not code-split | Medium | Slow cold start |
| DB repo tests skipped | Medium | ABI mismatch under plain Node |
| Password-protected PDFs | Medium | No unlock flow |
| Image-only PDFs | High | No OCR — AI blind |
| `pnpm dev` fragile outside wrapper | Low | Documented in README |

---

## 9. Cursor ↔ Fuzzy Mapping (for product planning)

Use this when prioritizing features:

```
Cursor                          Fuzzy today          Fuzzy target
─────────────────────────────────────────────────────────────────
File explorer                   Library sidebar      + tags, collections, search
Editor (code)                   PDF reader           + EPUB, web reader
Inline edit / Tab               Selection AI menu    + inline definitions, highlights
Chat panel                      AI Tutor (1-shot)    → persistent doc chat / agent
Composer (multi-file)           Study pack gen       → multi-doc synthesis, compare
⌘K Command palette              ❌                   Search + all actions
Codebase index                  Import indexing      → FTS + embeddings index
.git / terminal                 ❌                   → citation manager? export?
Rules for AI                    Prompt templates     → user study preferences
Extensions                      ❌                   Export plugins, LMS connectors
```

---

## 10. Recommended Build Phases

### Phase A — “Feels like an IDE” (2–3 weeks)

Command palette, keyboard shortcuts, streaming tutor, note scroll-to-passage, onboarding, E2E smoke, packaging for TestFlight-style private beta.

### Phase B — “Study superpowers” (3–4 weeks)

FTS search, OCR, document chat agent, export, highlights, adaptive reading plan, spaced repetition MVP.

### Phase C — “Platform” (ongoing)

Anthropic/Ollama, EPUB, multi-tab, embeddings search, LMS connectors, optional sync.

---

## 11. How to Run / Verify

```bash
pnpm install
pnpm dev          # Opens Electron app
pnpm test         # Unit tests (9 files)
pnpm typecheck
pnpm build
pnpm build:mac    # Unsigned DMG today
```

**Data locations (macOS):**
- DB: `~/Library/Application Support/fuzzy/fuzzy.db`
- PDFs: `~/Library/Application Support/fuzzy/library/<sha256>.pdf`

**Manual smoke path:**
1. Import a 20+ page PDF → bottom bar shows full page count indexed immediately
2. Select text → Explain → save as note → see overlay on page
3. Plan session → start timer → flip pages → mode badge changes
4. Build study pack → flashcards/quiz appear
5. Quit + relaunch → last document reopens

---

## 12. Files to Read First (for AI assistants picking up the repo)

| File | Why |
|---|---|
| `src/shared/types/api.ts` | Full IPC contract |
| `src/shared/types/database.ts` | Domain types |
| `src/renderer/src/components/layout/AppShell.tsx` | App layout wiring |
| `src/renderer/src/components/pdf/PdfReader.tsx` | Core reading + selection |
| `src/main/services/fileService.ts` | Import + indexing pipeline |
| `src/main/services/ai/provider.ts` | AI routing |
| `src/main/services/readingPlanService.ts` | Reading plan logic |
| `src/main/services/studyPackService.ts` | Study pack generation |
| `docs/STABILIZATION_REPORT.md` | What was fixed May 2026 |
| `docs/FUZZY_BUILD_AUDIT.md` | Deep May 2026 audit (some items since resolved) |

---

## 13. One-Paragraph Status for ChatGPT

Fuzzy v0.1 is a Mac Electron app (~60 source files, React + SQLite + PDF.js + OpenAI BYOK) that implements the **core study loop**: import PDF, select text, run AI tutor actions, save anchored margin notes, generate time-budget reading plans, and build structured study packs. Architecture, security, and persistence are production-quality for a prototype. **To become “Cursor for studying,”** build: command palette + keyboard model, search (FTS + in-doc), streaming conversational tutor/agent, OCR, export, onboarding, packaging, and the polish layer (note navigation, highlights, adaptive plans, spaced repetition). Prior audits from May 2026 are in `docs/FUZZY_BUILD_AUDIT.md` and `docs/STABILIZATION_REPORT.md`; many critical items from those audits are now fixed.

---

*End of audit.*
