import { useCallback, useEffect } from 'react'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightTutorPanel } from './RightTutorPanel'
import { BottomReadingBar } from './BottomReadingBar'
import { EmptyReader } from '../pdf/EmptyReader'
import { PdfReader } from '../pdf/PdfReader'
import { SettingsPanel } from '../settings/SettingsPanel'
import { StudyPackPanel } from '../study/StudyPackPanel'
import { CommandPalette } from '../command/CommandPalette'
import { OnboardingOverlay } from '../onboarding/OnboardingOverlay'
import { useDocumentStore } from '../../state/documentStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useAnnotationStore } from '../../state/annotationStore'
import { useTutorStore } from '../../state/tutorStore'
import { useReadingSessionStore } from '../../state/readingSessionStore'
import { useStudyPackStore } from '../../state/studyPackStore'
import { useAppUiStore } from '../../state/appUiStore'
import { usePdfStore } from '../../state/pdfStore'
import { useSelectionStore } from '../../state/selectionStore'
import { useOnboardingStore } from '../../state/onboardingStore'
import { useAppShortcuts } from '../../hooks/useAppShortcuts'

export function AppShell(): React.JSX.Element {
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const importDocument = useDocumentStore((s) => s.importDocument)
  const loadSettings = useSettingsStore((s) => s.load)
  const loadAnnotations = useAnnotationStore((s) => s.loadFor)
  const clearAnnotations = useAnnotationStore((s) => s.clear)
  const clearTutor = useTutorStore((s) => s.clear)
  const loadSession = useReadingSessionStore((s) => s.loadFor)
  const clearSession = useReadingSessionStore((s) => s.clear)
  const loadStudyPack = useStudyPackStore((s) => s.loadFor)
  const clearStudyPack = useStudyPackStore((s) => s.clear)

  const settingsOpen = useAppUiStore((s) => s.settingsOpen)
  const setSettingsOpen = useAppUiStore((s) => s.setSettingsOpen)
  const studyPackOpen = useAppUiStore((s) => s.studyPackOpen)
  const setStudyPackOpen = useAppUiStore((s) => s.setStudyPackOpen)
  const setPlanModalOpen = useAppUiStore((s) => s.setPlanModalOpen)
  const setPage = usePdfStore((s) => s.setPage)
  const clearSelection = useSelectionStore((s) => s.clear)
  const loadOnboarding = useOnboardingStore((s) => s.load)

  useEffect(() => {
    loadSettings()
    loadOnboarding()
  }, [loadSettings, loadOnboarding])

  useEffect(() => {
    if (activeDocumentId) {
      loadAnnotations(activeDocumentId)
      loadSession(activeDocumentId)
      loadStudyPack(activeDocumentId)
    } else {
      clearAnnotations()
      clearSession()
      clearStudyPack()
    }
    clearTutor()
    clearSelection()
  }, [
    activeDocumentId,
    loadAnnotations,
    clearAnnotations,
    loadSession,
    clearSession,
    loadStudyPack,
    clearStudyPack,
    clearTutor,
    clearSelection
  ])

  const openSettings = useCallback(() => setSettingsOpen(true), [setSettingsOpen])
  const openReadingPlan = useCallback(() => {
    if (!activeDocumentId) return
    setPlanModalOpen(true)
  }, [activeDocumentId, setPlanModalOpen])
  const openStudyPack = useCallback(() => {
    if (!activeDocumentId) return
    setStudyPackOpen(true)
  }, [activeDocumentId, setStudyPackOpen])

  useAppShortcuts({
    importPdf: () => {
      importDocument().catch(console.error)
    },
    openReadingPlan,
    openStudyPack
  })

  return (
    <div className="flex h-full w-full flex-col bg-fz-bg text-fz-fg">
      <TopBar onOpenSettings={openSettings} />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar onOpenStudyPack={openStudyPack} />
        <main className="flex min-w-0 flex-1 flex-col border-x border-fz-border bg-fz-surface">
          {activeDocumentId ? (
            <PdfReader key={activeDocumentId} documentId={activeDocumentId} />
          ) : (
            <EmptyReader />
          )}
        </main>
        <RightTutorPanel onOpenSettings={openSettings} />
      </div>
      <BottomReadingBar />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {studyPackOpen && activeDocumentId && (
        <StudyPackPanel documentId={activeDocumentId} onClose={() => setStudyPackOpen(false)} />
      )}
      <CommandPalette
        handlers={{
          onImport: () => importDocument().catch(console.error),
          onOpenSettings: openSettings,
          onOpenReadingPlan: openReadingPlan,
          onOpenStudyPack: openStudyPack,
          onGoToPage: (page) => setPage(page)
        }}
      />
      <OnboardingOverlay />
    </div>
  )
}
