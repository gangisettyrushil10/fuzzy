import { useEffect } from 'react'
import { isMetaKey, isTypingTarget, matchShortcut } from '../lib/keyboard'
import { useAppUiStore } from '../state/appUiStore'
import { useSelectionStore } from '../state/selectionStore'
import { usePacerStore } from '../state/pacerStore'
import { useReaderPrefsStore } from '../state/readerPrefsStore'

export interface ShortcutActions {
  importPdf: () => void
  openReadingPlan: () => void
  openStudyPack: () => void
}

export function useAppShortcuts(actions: ShortcutActions): void {
  const setPalette = useAppUiStore((s) => s.setCommandPaletteOpen)
  const setSettings = useAppUiStore((s) => s.setSettingsOpen)
  const dismissTransient = useAppUiStore((s) => s.dismissTransientUi)
  const clearSelection = useSelectionStore((s) => s.clear)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e.target)) return

      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
        dismissTransient()
        return
      }

      // --- Reading pacer (non-meta keys) ---
      const pacer = usePacerStore.getState()
      if (e.key === ' ' && !isMetaKey(e) && pacer.visible) {
        e.preventDefault()
        pacer.toggle()
        return
      }
      if ((e.key === '[' || e.key === ']') && !isMetaKey(e) && pacer.visible) {
        e.preventDefault()
        pacer.setWpm(pacer.wpm + (e.key === ']' ? 10 : -10))
        return
      }
      if (e.key.toLowerCase() === 'f' && e.shiftKey && !isMetaKey(e)) {
        e.preventDefault()
        const rp = useReaderPrefsStore.getState()
        void rp.set({ focusMode: !rp.prefs.focusMode })
        return
      }

      // `?` opens the shortcuts cheatsheet (non-meta).
      if (e.key === '?' && !isMetaKey(e)) {
        e.preventDefault()
        useAppUiStore.getState().setShortcutsOpen(true)
        return
      }

      if (matchShortcut(e, { key: 'k' })) {
        e.preventDefault()
        useAppUiStore.getState().setCommandPaletteOpen(true)
        return
      }

      if (matchShortcut(e, { key: 'o' })) {
        e.preventDefault()
        actions.importPdf()
        return
      }

      if (matchShortcut(e, { key: ',' })) {
        e.preventDefault()
        setSettings(true)
        return
      }

      if (matchShortcut(e, { key: 'p', shift: true })) {
        e.preventDefault()
        actions.openReadingPlan()
        return
      }

      if (matchShortcut(e, { key: 's', shift: true })) {
        e.preventDefault()
        actions.openStudyPack()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, clearSelection, dismissTransient, setPalette, setSettings])
}
