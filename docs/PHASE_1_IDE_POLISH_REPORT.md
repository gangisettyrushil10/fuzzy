# Phase 1 IDE Polish Report — 2026-06-03

## Summary

**Implemented:** Global keyboard model, command palette (⌘K), exact margin-note navigation with flash animation, stable selection menu (dismiss on scroll/zoom/page change), Tutor panel v2 (copy, regenerate, follow-up, loading skeleton, provider clarity, save toast), first-run onboarding coachmarks, bundled sample PDF import, visual tokens/motion, Playwright Electron smoke test, macOS packaging readiness notes, `com.fuzzy.study` app identifier.

**Deferred:** OpenAI streaming (documented in tutor panel; would need IPC event channel), resizable side panels, Phase 2 (search, OCR, export, document chat).

**Verdict:** **MVP candidate** for private dogfooding once manual verification and screenshots are completed on a real Mac. Not claimed as signed/notarized beta.

## Files changed (high level)

### New

- `src/renderer/src/lib/keyboard.ts`
- `src/renderer/src/state/appUiStore.ts`, `onboardingStore.ts`
- `src/renderer/src/hooks/useAppShortcuts.ts`
- `src/renderer/src/components/command/CommandPalette.tsx`
- `src/renderer/src/components/onboarding/OnboardingOverlay.tsx`
- `src/renderer/src/testBridge.ts`
- `resources/sample-document.pdf`
- `e2e/smoke.spec.ts`, `playwright.config.ts`
- `docs/LOCAL_RUNTIME_VERIFICATION_2026-06-03.md`, `docs/MACOS_PACKAGING_READINESS.md`

### Modified

- `AppShell`, `TopBar`, `LeftSidebar`, `RightTutorPanel`, `BottomReadingBar`, `EmptyReader`
- `PdfReader`, `PdfPage`, `SelectionMenu`, `SettingsPanel`, `globals.css`
- `tutorStore`, `documentStore`, `prompts.ts`, `ai.ipc.ts`, `openaiProvider.ts`, `mockProvider.ts`
- `fileService.ts`, `document.ipc.ts`, `documentRepository.ts`
- `shared` IPC/types, `preload`, `main/index.ts`, `electron-builder.yml`, `package.json`, `README.md`

## Tests and verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e   # macOS, after build; uses isolated FUZZY_USER_DATA
pnpm dev        # manual GUI verification required
```

## Known remaining issues

- Screenshots under `docs/screenshots/` must be captured manually on macOS.
- Streaming AI responses not implemented.
- Scanned PDFs: no OCR; empty text layer may limit selection (show user-facing hint in a follow-up).
- Git remote not configured in repo at start of pass — push when `gh auth` available.
- Agent environment could not confirm GUI launch.

## Recommended Phase 2

1. Full-text search (FTS5)
2. Export (Markdown / Anki)
3. OCR (Tesseract.js)
4. Persistent document-level chat agent
5. Adaptive reading plans

## GitHub status

- **Branch:** `feat/ide-polish-runtime-verification` (create/checkout locally if needed)
- **Remote:** none detected at pass start — run `gh repo create` / `git remote add` when ready
- **Push:** user-initiated after verification
