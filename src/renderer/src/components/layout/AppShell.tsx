import { useCallback, useEffect, useRef, useState } from 'react'
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
import { AmbientGlossCard } from '../reader/AmbientGlossCard'
import { HighlightLibraryModal } from '../highlights/HighlightLibraryModal'
import { ShareCardModal } from '../share/ShareCardModal'
import { FeelingAurora } from '../reader/FeelingAurora'
import { getAmbientStyle } from '../reader/ambientStyle'
import { useAmbientStore } from '../../state/ambientStore'
import { cn } from '../../lib/cn'

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
  const highlightsOpen = useAppUiStore((s) => s.highlightsOpen)
  const setHighlightsOpen = useAppUiStore((s) => s.setHighlightsOpen)
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
  const feelingEnabled = useAmbientStore((s) => s.feelingEnabled)
  const ambientClassification = useAmbientStore((s) => s.classification)
  const ambientLive = useAmbientStore((s) => s.live)
  const moodlightPreferences = useAmbientStore((s) => s.moodlightPreferences)
  const ambientStyle = feelingEnabled ? getAmbientStyle(ambientClassification) : undefined

  // ── Resizable panels ──────────────────────────────────────────────────────
  const SIZES_KEY = 'fz-panel-sizes'
  const MIN_LEFT = 140,
    MAX_LEFT = 480,
    DEFAULT_LEFT = 240
  const MIN_RIGHT = 200,
    MAX_RIGHT = 640,
    DEFAULT_RIGHT = 384

  const loadSize = (key: 'left' | 'right', def: number, min: number, max: number): number => {
    try {
      const raw = localStorage.getItem(SIZES_KEY)
      if (raw) {
        const v = (JSON.parse(raw) as Record<string, number>)[key]
        if (typeof v === 'number') return Math.max(min, Math.min(max, v))
      }
    } catch {
      /* ignore */
    }
    return def
  }

  const loadBool = (key: string, def: boolean): boolean => {
    try {
      const raw = localStorage.getItem(SIZES_KEY)
      if (raw) {
        const v = (JSON.parse(raw) as Record<string, unknown>)[key]
        if (typeof v === 'boolean') return v
      }
    } catch {
      /* ignore */
    }
    return def
  }

  const [leftW, setLeftW] = useState(() => loadSize('left', DEFAULT_LEFT, MIN_LEFT, MAX_LEFT))
  const [rightW, setRightW] = useState(() => loadSize('right', DEFAULT_RIGHT, MIN_RIGHT, MAX_RIGHT))
  const [leftOpen, setLeftOpen] = useState(() => loadBool('leftOpen', true))
  const [rightOpen, setRightOpen] = useState(() => loadBool('rightOpen', true))
  const leftWRef = useRef(leftW)
  const rightWRef = useRef(rightW)

  useEffect(() => {
    leftWRef.current = leftW
  }, [leftW])

  useEffect(() => {
    rightWRef.current = rightW
  }, [rightW])

  useEffect(() => {
    try {
      localStorage.setItem(
        SIZES_KEY,
        JSON.stringify({ left: leftW, right: rightW, leftOpen, rightOpen })
      )
    } catch {
      /* ignore */
    }
  }, [leftW, rightW, leftOpen, rightOpen])

  const startDrag = useCallback((side: 'left' | 'right', startX: number) => {
    const origin = side === 'left' ? leftWRef.current : rightWRef.current
    const onMove = (e: MouseEvent): void => {
      const delta = e.clientX - startX
      if (side === 'left') {
        setLeftW(Math.max(MIN_LEFT, Math.min(MAX_LEFT, origin + delta)))
      } else {
        setRightW(Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, origin - delta)))
      }
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

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
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-fz-bg text-fz-fg"
      style={ambientStyle}
    >
      {feelingEnabled && (
        <FeelingAurora
          classification={ambientClassification}
          live={{ ...ambientLive, pageNumber: ambientLive.pageNumber }}
          preferences={moodlightPreferences}
        />
      )}
      <div
        className={cn(
          'relative z-10 flex h-full w-full flex-col',
          feelingEnabled && 'fz-moodlight-chrome-fade'
        )}
      >
        <TopBar onOpenSettings={openSettings} />
        <div className="flex min-h-0 flex-1">
          {/* Focus mode hides the side panels so the reader takes the full width
            — pairs with the pacer for distraction-free reading. */}
          {!focusMode &&
            (leftOpen ? (
              <>
                <LeftSidebar
                  onOpenStudyPack={openStudyPack}
                  onCollapse={() => setLeftOpen(false)}
                  style={{ width: leftW, flexShrink: 0, alignSelf: 'stretch' }}
                />
                <div
                  className="w-px shrink-0 cursor-col-resize bg-fz-border transition-colors hover:bg-fz-accent/40"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    startDrag('left', e.clientX)
                  }}
                />
              </>
            ) : (
              /* Collapsed strip — click to reopen */
              <button
                type="button"
                className="fz-shell-chrome flex w-7 shrink-0 flex-col items-center justify-start border-r border-fz-border pt-3 text-fz-fg-subtle transition-colors hover:bg-fz-bg hover:text-fz-fg"
                onClick={() => setLeftOpen(true)}
                title="Open library"
              >
                <span className="text-fz-micro">›</span>
              </button>
            ))}
          <main className="flex min-w-0 flex-1 flex-col bg-transparent">
            {activeDocumentId ? (
              <ErrorBoundary label="The reader hit a problem" resetKey={activeDocumentId}>
                <DocumentReader key={activeDocumentId} documentId={activeDocumentId} />
              </ErrorBoundary>
            ) : (
              <HomeHub />
            )}
          </main>
          {!focusMode &&
            (rightOpen ? (
              <>
                <div
                  className="w-px shrink-0 cursor-col-resize bg-fz-border transition-colors hover:bg-fz-accent/40"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    startDrag('right', e.clientX)
                  }}
                />
                <RightTutorPanel
                  onOpenSettings={openSettings}
                  onCollapse={() => setRightOpen(false)}
                  style={{ width: rightW, flexShrink: 0, alignSelf: 'stretch' }}
                />
              </>
            ) : (
              /* Collapsed strip — click to reopen */
              <button
                type="button"
                className="fz-shell-chrome flex w-7 shrink-0 flex-col items-center justify-start border-l border-fz-border pt-3 text-fz-fg-subtle transition-colors hover:bg-fz-bg hover:text-fz-fg"
                onClick={() => setRightOpen(true)}
                title="Open AI panel"
              >
                <span className="text-fz-micro">‹</span>
              </button>
            ))}
        </div>
        <BottomReadingBar />
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        {highlightsOpen && <HighlightLibraryModal onClose={() => setHighlightsOpen(false)} />}
        <ShareCardModal />
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
        <AmbientGlossCard />
        <WordDefinitionPopover />
        {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}
        {shortcutsOpen && <ShortcutsCheatsheet onClose={() => setShortcutsOpen(false)} />}
        {digestOpen && activeDocumentId && <DigestPanel onClose={() => setDigestOpen(false)} />}
        {essayOpen && <EssayWorkspace onClose={() => setEssayOpen(false)} />}
        <ToastViewport />
      </div>
    </div>
  )
}
