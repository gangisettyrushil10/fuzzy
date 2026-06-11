import { useEffect, useRef, useState } from 'react'
import type { AmbientClassification, AmbientGenre } from '@shared/types/api'

// Each sprite is drawn on a 16×20 SVG pixel grid with shape-rendering: crispEdges
// so it looks intentionally pixel-art at any display size.

function Wizard(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Hat tip */}
      <rect x="7" y="0" width="2" height="2" fill="#5b21b6"/>
      <rect x="6" y="2" width="4" height="1" fill="#6d28d9"/>
      <rect x="5" y="3" width="6" height="2" fill="#7c3aed"/>
      {/* Hat brim */}
      <rect x="3" y="5" width="10" height="1" fill="#4c1d95"/>
      {/* Face */}
      <rect x="4" y="6" width="8" height="5" fill="#fde8c8"/>
      {/* Eyes */}
      <rect x="5" y="8" width="2" height="1" fill="#1e1b4b"/>
      <rect x="9" y="8" width="2" height="1" fill="#1e1b4b"/>
      {/* Beard */}
      <rect x="4" y="11" width="8" height="1" fill="#f8fafc"/>
      <rect x="5" y="12" width="6" height="1" fill="#e2e8f0"/>
      {/* Robe */}
      <rect x="3" y="13" width="10" height="7" fill="#7c3aed"/>
      <rect x="2" y="15" width="2" height="5" fill="#6d28d9"/>
      <rect x="12" y="15" width="2" height="5" fill="#6d28d9"/>
      {/* Wand */}
      <rect x="12" y="10" width="1" height="4" fill="#d97706"/>
      <rect x="13" y="9" width="1" height="1" fill="#fbbf24"/>
      {/* Stars */}
      <rect x="0" y="7" width="1" height="1" fill="#fbbf24"/>
      <rect x="1" y="6" width="1" height="1" fill="#a78bfa"/>
      <rect x="14" y="6" width="1" height="1" fill="#fbbf24"/>
      <rect x="15" y="8" width="1" height="1" fill="#c4b5fd"/>
    </svg>
  )
}

function Detective(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Fedora brim */}
      <rect x="2" y="3" width="12" height="1" fill="#374151"/>
      {/* Fedora crown */}
      <rect x="4" y="0" width="8" height="4" fill="#1f2937"/>
      {/* Fedora indent */}
      <rect x="5" y="1" width="6" height="1" fill="#111827"/>
      {/* Face */}
      <rect x="4" y="4" width="8" height="5" fill="#fde8c8"/>
      {/* Eyes */}
      <rect x="5" y="6" width="2" height="1" fill="#1f2937"/>
      <rect x="9" y="6" width="2" height="1" fill="#1f2937"/>
      {/* Mouth/stubble */}
      <rect x="6" y="8" width="4" height="1" fill="#d1c4b0"/>
      {/* Coat collar */}
      <rect x="3" y="9" width="10" height="1" fill="#6b7280"/>
      {/* Trench coat */}
      <rect x="2" y="10" width="12" height="9" fill="#9ca3af"/>
      <rect x="2" y="10" width="5" height="9" fill="#6b7280"/>
      {/* Coat buttons */}
      <rect x="7" y="12" width="1" height="1" fill="#374151"/>
      <rect x="7" y="14" width="1" height="1" fill="#374151"/>
      <rect x="7" y="16" width="1" height="1" fill="#374151"/>
      {/* Magnifying glass handle */}
      <rect x="11" y="15" width="1" height="4" fill="#d97706"/>
      {/* Magnifying glass lens */}
      <rect x="12" y="11" width="3" height="3" fill="none"/>
      <rect x="12" y="11" width="3" height="1" fill="#93c5fd"/>
      <rect x="12" y="12" width="1" height="1" fill="#93c5fd"/>
      <rect x="14" y="12" width="1" height="1" fill="#93c5fd"/>
      <rect x="12" y="13" width="3" height="1" fill="#93c5fd"/>
      {/* Lens rim */}
      <rect x="11" y="10" width="5" height="1" fill="#374151"/>
      <rect x="11" y="14" width="5" height="1" fill="#374151"/>
      <rect x="11" y="11" width="1" height="3" fill="#374151"/>
      <rect x="15" y="11" width="1" height="3" fill="#374151"/>
    </svg>
  )
}

function Knight(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Helmet */}
      <rect x="4" y="0" width="8" height="6" fill="#6b7280"/>
      <rect x="3" y="2" width="10" height="4" fill="#9ca3af"/>
      {/* Visor slit */}
      <rect x="5" y="3" width="6" height="1" fill="#1f2937"/>
      {/* Plume */}
      <rect x="6" y="0" width="4" height="1" fill="#ef4444"/>
      {/* Armor body */}
      <rect x="3" y="6" width="10" height="8" fill="#9ca3af"/>
      <rect x="4" y="7" width="8" height="6" fill="#d1d5db"/>
      {/* Breastplate detail */}
      <rect x="6" y="8" width="4" height="1" fill="#9ca3af"/>
      <rect x="6" y="10" width="4" height="1" fill="#9ca3af"/>
      {/* Shield */}
      <rect x="0" y="8" width="4" height="5" fill="#1d4ed8"/>
      <rect x="1" y="9" width="2" height="3" fill="#3b82f6"/>
      <rect x="1" y="10" width="2" height="1" fill="#dbeafe"/>
      {/* Sword */}
      <rect x="12" y="4" width="1" height="10" fill="#e2e8f0"/>
      <rect x="11" y="7" width="3" height="1" fill="#d97706"/>
      {/* Legs */}
      <rect x="4" y="14" width="4" height="6" fill="#6b7280"/>
      <rect x="8" y="14" width="4" height="6" fill="#6b7280"/>
      <rect x="5" y="18" width="2" height="2" fill="#4b5563"/>
      <rect x="9" y="18" width="2" height="2" fill="#4b5563"/>
    </svg>
  )
}

function Bard(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Hat with feather */}
      <rect x="3" y="2" width="10" height="1" fill="#6d28d9"/>
      <rect x="5" y="0" width="7" height="3" fill="#7c3aed"/>
      <rect x="13" y="0" width="2" height="3" fill="#ec4899"/>
      {/* Face */}
      <rect x="4" y="3" width="8" height="5" fill="#fde8c8"/>
      {/* Eyes */}
      <rect x="5" y="5" width="2" height="1" fill="#1e1b4b"/>
      <rect x="9" y="5" width="2" height="1" fill="#1e1b4b"/>
      {/* Smile */}
      <rect x="6" y="7" width="1" height="1" fill="#f472b6"/>
      <rect x="9" y="7" width="1" height="1" fill="#f472b6"/>
      <rect x="7" y="8" width="2" height="1" fill="#f472b6"/>
      {/* Cape */}
      <rect x="1" y="8" width="14" height="1" fill="#a855f7"/>
      <rect x="0" y="9" width="16" height="8" fill="#9333ea"/>
      <rect x="1" y="17" width="6" height="3" fill="#7e22ce"/>
      <rect x="9" y="17" width="6" height="3" fill="#7e22ce"/>
      {/* Lute body */}
      <rect x="5" y="10" width="6" height="6" fill="#d97706"/>
      <rect x="6" y="11" width="4" height="4" fill="#fbbf24"/>
      {/* Lute neck */}
      <rect x="8" y="6" width="1" height="5" fill="#92400e"/>
      {/* Lute strings */}
      <rect x="6" y="11" width="1" height="4" fill="#92400e"/>
      <rect x="8" y="11" width="1" height="4" fill="#92400e"/>
      <rect x="10" y="11" width="1" height="4" fill="#92400e"/>
      {/* Music notes */}
      <rect x="13" y="9" width="1" height="2" fill="#e879f9"/>
      <rect x="14" y="9" width="1" height="1" fill="#e879f9"/>
      <rect x="1" y="10" width="1" height="2" fill="#e879f9"/>
      <rect x="0" y="10" width="1" height="1" fill="#e879f9"/>
    </svg>
  )
}

function Explorer(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Helmet dome */}
      <rect x="3" y="0" width="10" height="6" fill="#374151"/>
      <rect x="4" y="1" width="8" height="4" fill="#4b5563"/>
      {/* Visor */}
      <rect x="4" y="3" width="8" height="3" fill="#0ea5e9"/>
      <rect x="5" y="4" width="6" height="2" fill="#38bdf8"/>
      {/* Eyes through visor */}
      <rect x="5" y="4" width="2" height="1" fill="#e0f2fe"/>
      <rect x="9" y="4" width="2" height="1" fill="#e0f2fe"/>
      {/* Suit collar */}
      <rect x="3" y="6" width="10" height="1" fill="#1f2937"/>
      {/* Suit body */}
      <rect x="3" y="7" width="10" height="9" fill="#e5e7eb"/>
      {/* Suit details */}
      <rect x="5" y="9" width="2" height="3" fill="#d1d5db"/>
      <rect x="9" y="9" width="2" height="3" fill="#d1d5db"/>
      {/* Control panel */}
      <rect x="6" y="10" width="4" height="3" fill="#374151"/>
      <rect x="7" y="11" width="1" height="1" fill="#22c55e"/>
      <rect x="9" y="11" width="1" height="1" fill="#ef4444"/>
      {/* Arms */}
      <rect x="1" y="7" width="2" height="7" fill="#d1d5db"/>
      <rect x="13" y="7" width="2" height="7" fill="#d1d5db"/>
      {/* Gloves */}
      <rect x="0" y="13" width="3" height="2" fill="#374151"/>
      <rect x="13" y="13" width="3" height="2" fill="#374151"/>
      {/* Flask */}
      <rect x="13" y="11" width="2" height="3" fill="#4ade80"/>
      <rect x="13" y="10" width="2" height="1" fill="#374151"/>
      {/* Bubbles */}
      <rect x="14" y="9" width="1" height="1" fill="#86efac"/>
      <rect x="15" y="8" width="1" height="1" fill="#4ade80"/>
      {/* Legs */}
      <rect x="4" y="16" width="4" height="4" fill="#d1d5db"/>
      <rect x="8" y="16" width="4" height="4" fill="#d1d5db"/>
      <rect x="4" y="18" width="4" height="2" fill="#374151"/>
      <rect x="8" y="18" width="4" height="2" fill="#374151"/>
    </svg>
  )
}

function Scholar(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Mortarboard */}
      <rect x="3" y="1" width="10" height="1" fill="#1f2937"/>
      <rect x="4" y="2" width="8" height="3" fill="#374151"/>
      <rect x="12" y="1" width="1" height="4" fill="#d97706"/>
      {/* Face */}
      <rect x="4" y="5" width="8" height="5" fill="#fde8c8"/>
      {/* Glasses frames */}
      <rect x="4" y="7" width="3" height="2" fill="#374151"/>
      <rect x="9" y="7" width="3" height="2" fill="#374151"/>
      <rect x="7" y="8" width="2" height="1" fill="#374151"/>
      {/* Lenses */}
      <rect x="5" y="7" width="2" height="2" fill="#bfdbfe"/>
      <rect x="10" y="7" width="2" height="2" fill="#bfdbfe"/>
      {/* Robe */}
      <rect x="3" y="10" width="10" height="10" fill="#1e3a5f"/>
      <rect x="4" y="11" width="8" height="8" fill="#2563eb"/>
      {/* Collar */}
      <rect x="5" y="10" width="6" height="1" fill="#f8fafc"/>
      {/* Textbook */}
      <rect x="1" y="11" width="4" height="6" fill="#dc2626"/>
      <rect x="2" y="12" width="2" height="4" fill="#f87171"/>
      <rect x="2" y="14" width="2" height="1" fill="#fca5a5"/>
      {/* Book spine lines */}
      <rect x="1" y="13" width="1" height="1" fill="#991b1b"/>
      <rect x="1" y="15" width="1" height="1" fill="#991b1b"/>
    </svg>
  )
}

function ReaderChar(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 20" width={56} height={70} shapeRendering="crispEdges">
      {/* Lamp glow (behind) */}
      <rect x="13" y="2" width="3" height="1" fill="#fef08a"/>
      <rect x="12" y="3" width="4" height="1" fill="#fde047"/>
      {/* Lamp */}
      <rect x="13" y="1" width="2" height="2" fill="#ca8a04"/>
      <rect x="14" y="0" width="1" height="2" fill="#92400e"/>
      {/* Hair */}
      <rect x="4" y="1" width="8" height="3" fill="#92400e"/>
      <rect x="3" y="2" width="2" height="3" fill="#92400e"/>
      <rect x="11" y="2" width="2" height="3" fill="#92400e"/>
      {/* Face */}
      <rect x="4" y="4" width="8" height="5" fill="#fde8c8"/>
      {/* Eyes (reading — slightly squinted) */}
      <rect x="5" y="6" width="2" height="1" fill="#1f2937"/>
      <rect x="9" y="6" width="2" height="1" fill="#1f2937"/>
      {/* Cozy sweater */}
      <rect x="3" y="9" width="10" height="9" fill="#78350f"/>
      <rect x="4" y="10" width="8" height="7" fill="#92400e"/>
      {/* Book open */}
      <rect x="2" y="12" width="12" height="7" fill="#f8fafc"/>
      <rect x="2" y="12" width="6" height="7" fill="#f1f5f9"/>
      <rect x="8" y="12" width="6" height="7" fill="#f8fafc"/>
      {/* Book spine */}
      <rect x="7" y="12" width="2" height="7" fill="#e2e8f0"/>
      {/* Text lines */}
      <rect x="3" y="14" width="5" height="1" fill="#94a3b8"/>
      <rect x="3" y="16" width="4" height="1" fill="#94a3b8"/>
      <rect x="3" y="18" width="5" height="1" fill="#94a3b8"/>
      <rect x="9" y="14" width="5" height="1" fill="#94a3b8"/>
      <rect x="9" y="16" width="4" height="1" fill="#94a3b8"/>
      <rect x="9" y="18" width="5" height="1" fill="#94a3b8"/>
      {/* Lamp glow on face */}
      <rect x="3" y="3" width="1" height="1" fill="#fef9c3"/>
    </svg>
  )
}

function genreToSprite(genre: AmbientGenre): React.JSX.Element | null {
  switch (genre) {
    case 'fantasy':  return <Wizard />
    case 'mystery':
    case 'thriller': return <Detective />
    case 'adventure': return <Knight />
    case 'romance':  return <Bard />
    case 'sci-fi':   return <Explorer />
    case 'academic': return <Scholar />
    case 'literary': return <ReaderChar />
    default:         return null
  }
}

export function SceneSprite({
  classification
}: {
  classification: AmbientClassification | null
}): React.JSX.Element | null {
  const [isReacting, setIsReacting] = useState(false)
  const [entering, setEntering] = useState(false)
  const prevGenreRef = useRef<string | null>(null)

  const genre = classification?.genre ?? null
  const intensity = classification?.intensity ?? 0
  const sprite = genre ? genreToSprite(genre) : null

  // Trigger enter animation when sprite first appears or genre changes
  useEffect(() => {
    if (genre !== prevGenreRef.current) {
      prevGenreRef.current = genre
      if (sprite) {
        setEntering(true)
        const t = window.setTimeout(() => setEntering(false), 350)
        return () => window.clearTimeout(t)
      }
    }
    return undefined
  }, [genre, sprite])

  // Trigger react animation on high-intensity pages
  useEffect(() => {
    if (intensity > 0.65 && sprite) {
      setIsReacting(true)
      const t = window.setTimeout(() => setIsReacting(false), 450)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [intensity, sprite])

  if (!sprite) return null

  return (
    <div
      className={[
        'fz-sprite',
        isReacting ? 'fz-sprite-react' : 'fz-sprite-bob',
        entering ? 'fz-sprite-enter' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 10 }}
      title={genre ?? ''}
    >
      {sprite}
    </div>
  )
}
