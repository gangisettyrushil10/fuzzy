import { useMemo } from 'react'
import { tokenize, type Token } from '../../lib/tokenize'
import { cn } from '../../lib/cn'

// The single word-span layer over reflowable reader text, shared by the WPM
// pacer (word-by-word sweep) and complex-word highlighting. Both decorate the
// SAME DOM tree — we never build word-spanning twice.
//
// Selection-fidelity invariant: whitespace/punctuation "gap" tokens are ALWAYS
// rendered as bare text nodes — only WORD tokens can become <span>s. Spans hold
// exactly the word characters (no whitespace), so the container's textContent
// is byte-identical to the source and getSelection().toString() round-trips
// cleanly under white-space: pre-wrap.
//
// spanMode decides density (the pacer-vs-complex-words tension, resolved):
//  - 'all'     : every word is a span. The pacer needs this (any word can be
//                the active sweep target / needs geometry).
//  - 'flagged' : only flagged words (+ the active word, if any) are spans; the
//                rest stay bare text. Keeps the DOM light when only the
//                complex-word aid is on.

export interface TokenizedTextProps {
  text: string
  spanMode?: 'all' | 'flagged'
  flaggedIndices?: Set<number>
  activeWordIndex?: number
  // Transiently highlighted words (thesis "go to source" projection).
  highlightIndices?: Set<number>
  // Extra class(es) per word span (e.g. the complex-word underline).
  wordClassName?: (token: Token) => string | undefined
  // Click handler for a word span; receives the token and its viewport rect.
  onWordClick?: (token: Token, rect: DOMRect) => void
  // Register a word span element for geometry (pacer scroll-into-view / rects).
  registerWordRef?: (index: number, el: HTMLElement | null) => void
  className?: string
}

export function TokenizedText({
  text,
  spanMode = 'flagged',
  flaggedIndices,
  activeWordIndex,
  highlightIndices,
  wordClassName,
  onWordClick,
  registerWordRef,
  className
}: TokenizedTextProps): React.JSX.Element {
  const tokens = useMemo(() => tokenize(text), [text])

  const nodes: React.ReactNode[] = []
  for (const t of tokens) {
    if (!t.isWord) {
      nodes.push(t.text)
      continue
    }
    const flagged = flaggedIndices?.has(t.index) ?? false
    const isActive = activeWordIndex === t.index
    const isHighlighted = highlightIndices?.has(t.index) ?? false
    const needsSpan = spanMode === 'all' || flagged || isActive || isHighlighted
    if (!needsSpan) {
      nodes.push(t.text)
      continue
    }
    // Only flagged words are interactive (click-to-define) — even when the
    // pacer makes every word a span, a plain word shouldn't be clickable.
    const clickable = onWordClick && flagged
    nodes.push(
      <span
        key={t.index}
        data-token-index={t.index}
        ref={registerWordRef ? (el) => registerWordRef(t.index, el) : undefined}
        className={cn(
          isActive && 'fz-pace-active',
          isHighlighted && 'fz-evidence-flash',
          wordClassName?.(t)
        )}
        onClick={
          clickable ? (e) => onWordClick(t, e.currentTarget.getBoundingClientRect()) : undefined
        }
      >
        {t.text}
      </span>
    )
  }

  return <span className={className}>{nodes}</span>
}
