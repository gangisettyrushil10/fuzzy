import { useCallback, useEffect } from 'react'
import { TopBar } from './TopBar'
import { LeftSidebar } from './LeftSidebar'
import { RightTutorPanel } from './RightTutorPanel'
import { BottomReadingBar } from './BottomReadingBar'
import { HomeHub } from '../home/HomeHub'
import { DocumentReader } from '../reader/DocumentReader'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { SettingsPanel } from '../settings/SettingsPanel'
import { StudyPackPanel } from '../study/StudyPackPanel'
import { EssayWorkspace } from '../essay/EssayWorkspace'
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
import { useReaderPrefsStore } from '../../state/readerPrefsStore'
import { useAppearanceStore } from '../../state/appearanceStore'
import { useProjectStore } from '../../state/projectStore'
import { useFocusSessionStore } from '../../state/focusSessionStore'
import { usePacerStore } from '../../state/pacerStore'
import { useAppShortcuts } from '../../hooks/useAppShortcuts'
import { usePacer } from '../../hooks/usePacer'
import { ToastViewport } from '../ui/ToastViewport'
import { PacerBar } from '../reader/PacerBar'
import { WordDefinitionPopover } from '../reader/WordDefinitionPopover'
import { FocusSessionHud } from '../reader/FocusSessionHud'
import { StatsPanel } from '../stats/StatsPanel'
import { ShortcutsCheatsheet } from '../command/ShortcutsCheatsheet'
import { DigestPanel } from '../summary/DigestPanel'

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
  const loadReaderPrefs = useReaderPrefsStore((s) => s.load)
  const loadAppearance = useAppearanceStore((s) => s.load)
  const loadProjects = useProjectStore((s) => s.load)
  const finalizeOpenFocus = useFocusSessionStore((s) => s.finalizeOpenFromCrash)
  const loadStats = useFocusSessionStore((s) => s.loadStats)
  const focusMode = useReaderPrefsStore((s) => s.prefs.focusMode)
  const pacerVisible = usePacerStore((s) => s.visible)
  const statsOpen = useAppUiStore((s) => s.statsOpen)
  const setStatsOpen = useAppUiStore((s) => s.setStatsOpen)
  const shortcutsOpen = useAppUiStore((s) => s.shortcutsOpen)
  const setShortcutsOpen = useAppUiStore((s) => s.setShortcutsOpen)
  const digestOpen = useAppUiStore((s) => s.digestOpen)
  const setDigestOpen = useAppUiStore((s) => s.setDigestOpen)
  const essayOpen = useAppUiStore((s) => s.essayOpen)
  const setEssayOpen = useAppUiStore((s) => s.setEssayOpen)

  // Drives the pacer's word-by-word sweep (single rAF loop for the whole app).
  usePacer()

  useEffect(() => {
    loadSettings()
    loadOnboarding()
    loadReaderPrefs()
    loadAppearance()
    loadProjects()
    // Close any focus session left open by a crash, then load stats.
    finalizeOpenFocus().then(() => loadStats())
  }, [
    loadSettings,
    loadOnboarding,
    loadReaderPrefs,
    loadAppearance,
    loadProjects,
    finalizeOpenFocus,
    loadStats
  ])

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
        {/* Focus mode hides the side panels so the reader takes the full width
            — pairs with the pacer for distraction-free reading. */}
        {!focusMode && <LeftSidebar onOpenStudyPack={openStudyPack} />}
        <main className="flex min-w-0 flex-1 flex-col border-x border-fz-border bg-fz-surface">
          {activeDocumentId ? (
            <ErrorBoundary label="The reader hit a problem" resetKey={activeDocumentId}>
              <DocumentReader key={activeDocumentId} documentId={activeDocumentId} />
            </ErrorBoundary>
          ) : (
            <HomeHub />
          )}
        </main>
        {!focusMode && <RightTutorPanel onOpenSettings={openSettings} />}
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
      {pacerVisible && <PacerBar />}
      <FocusSessionHud />
      <WordDefinitionPopover />
      {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}
      {shortcutsOpen && <ShortcutsCheatsheet onClose={() => setShortcutsOpen(false)} />}
      {digestOpen && activeDocumentId && <DigestPanel onClose={() => setDigestOpen(false)} />}
      {essayOpen && <EssayWorkspace onClose={() => setEssayOpen(false)} />}
      <ToastViewport />
    </div>
  )
}
