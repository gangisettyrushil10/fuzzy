import type { ReaderFontId } from '@shared/types/database'

// Renderer-owned font stacks for each shared READER_FONT_IDS value. The bundled
// faces (Literata/Inter Variable, OpenDyslexic — imported in main.tsx) come
// first, with system fallbacks behind them. Kept in lockstep with the shared
// allow-list, same split as THEME_IDS ↔ themes.ts.
export const READER_FONT_STACKS: Record<ReaderFontId, string> = {
  'serif-book': "'Literata Variable', 'Iowan Old Style', Georgia, 'Times New Roman', serif",
  'sans-clean': "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  dyslexic: "'OpenDyslexic', 'Comic Sans MS', system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  'system-serif': "Georgia, 'Iowan Old Style', Palatino, 'Times New Roman', serif",
  'system-sans': "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
}

export function fontStackFor(id: ReaderFontId): string {
  return READER_FONT_STACKS[id] ?? READER_FONT_STACKS['serif-book']
}
