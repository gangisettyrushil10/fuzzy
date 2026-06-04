import { useEffect } from 'react'
import { isTypingTarget, matchShortcut } from '../lib/keyboard'
import { useAppUiStore } from '../state/appUiStore'
import { useSelectionStore } from '../state/selectionStore'

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
