import { useEffect, useRef, useState } from 'react'
import { usePacerStore } from '../../state/pacerStore'
import { lookupGloss } from '../../lib/offlineDictionary'
import { useTypewriter } from '../../hooks/useTypewriter'
import { Button, Spinner } from '../ui'

// Rises from the PacerBar when the sweep pauses on a complex word: instant
// offline gloss + the streamed AI definition, then auto-flows on. Reuses the
// 'define' action so there's no new AI plumbing.
const DWELL_MS = 5_000

export function PacerExplainCard(): React.JSX.Element | null {
  const target = usePacerStore((s) => s.explainTarget)
  const sourceKey = usePacerStore((s) => s.sourceKey)
  const resume = usePacerStore((s) => s.resumeFromExplain)
  const setExplainEnabled = usePacerStore((s) => s.setExplainEnabled)

  const [definition, setDefinition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const word = target?.word ?? ''
  const gloss = word ? lookupGloss(word) : null

  // Parse documentId:pageNumber (documentId is a UUID, so split on the LAST ':').
  const idx = sourceKey ? sourceKey.lastIndexOf(':') : -1
  const documentId = idx > 0 ? sourceKey!.slice(0, idx) : null
  const pageNumber = idx > 0 ? Number(sourceKey!.slice(idx + 1)) : 1

  // Fetch the (mock or real) definition for the paused word.
  useEffect(() => {
    if (!target || !documentId) return
    let cancelled = false
    setDefinition(null)
    setLoading(true)
    window.fuzzy.ai
      .runAction({
        documentId,
        pageNumber: Number.isFinite(pageNumber) ? pageNumber : 1,
        action: 'define',
        selectedText: target.word,
        contextText: null
      })
      .then((r) => {
        if (cancelled) return
        setDefinition(r.outputText)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [target, documentId, pageNumber])

  // Auto-resume after a calm dwell; reset whenever the paused word changes.
  const resumeRef = useRef(resume)
  resumeRef.current = resume
  useEffect(() => {
    if (!target) return
    const t = window.setTimeout(() => resumeRef.current(), DWELL_MS)
    return () => window.clearTimeout(t)
  }, [target])

  const { display } = useTypewriter({
    id: `pacer-def:${documentId}:${pageNumber}:${word}`,
    text: definition ?? '',
    enabled: !!definition
  })

  if (!target) return null

  return (
    <div className="pointer-events-auto mb-2 w-[22rem] max-w-[92vw] rounded-fz border border-fz-border bg-fz-elevated/95 p-3 shadow-fz-pop backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-fz-body font-semibold text-fz-fg">{word}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="primary" onClick={() => resume()}>
            Resume
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Stop pausing on words"
            onClick={() => {
              setExplainEnabled(false)
              resume()
            }}
          >
            Turn off
          </Button>
        </div>
      </div>
      {gloss && <p className="mb-1.5 text-fz-ui leading-relaxed text-fz-fg-muted">{gloss}</p>}
      {loading && !definition ? (
        <span className="flex items-center gap-2 text-fz-ui text-fz-fg-muted">
          <Spinner size={12} /> Looking it up…
        </span>
      ) : (
        <p className="whitespace-pre-wrap text-fz-ui leading-relaxed text-fz-fg">{display}</p>
      )}
    </div>
  )
}
