/** Returns true when the event target is an editable field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

export function isMetaKey(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey
}

export function matchShortcut(
  e: KeyboardEvent,
  opts: { key: string; shift?: boolean; meta?: boolean }
): boolean {
  const wantMeta = opts.meta !== false
  if (wantMeta && !isMetaKey(e)) return false
  if (!wantMeta && isMetaKey(e)) return false
  if (opts.shift && !e.shiftKey) return false
  if (!opts.shift && e.shiftKey) return false
  return e.key.toLowerCase() === opts.key.toLowerCase()
}
