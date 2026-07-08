import type { AmbientClassification, AmbientMood } from '@shared/types/api'
import { cn } from '../../lib/cn'

type FeelingStatus = 'idle' | 'classifying' | 'ready' | 'error'

const MOOD_LABELS: Record<AmbientMood, string> = {
  love: 'Love',
  sadness: 'Sad',
  joy: 'Joy',
  mystery: 'Mystery',
  tension: 'Tense',
  calm: 'Calm',
  awe: 'Awe',
  fear: 'Fear',
  anger: 'Anger',
  grief: 'Grief',
  hope: 'Hope',
  wonder: 'Wonder',
  nostalgia: 'Memory',
  neutral: 'Neutral'
}

function feelingDetail(
  enabled: boolean,
  status: FeelingStatus,
  classification: AmbientClassification | null
): string {
  if (!enabled) return 'Off'
  if (status === 'classifying') return 'Reading'
  if (status === 'error') return 'Retry'
  if (classification) return MOOD_LABELS[classification.mood]
  return 'Ready'
}

export function FeelingModeButton({
  enabled,
  status,
  classification,
  onToggle
}: {
  enabled: boolean
  status: FeelingStatus
  classification: AmbientClassification | null
  onToggle: () => void
}): React.JSX.Element {
  const detail = feelingDetail(enabled, status, classification)
  const title = enabled ? `Moodlight on: ${detail}` : 'Moodlight off'

  return (
    <button
      type="button"
      aria-pressed={enabled}
      title={title}
      onClick={onToggle}
      className={cn(
        'fz-feeling-toggle',
        enabled && 'fz-feeling-toggle-on',
        status === 'classifying' && 'fz-feeling-toggle-reading',
        status === 'error' && 'fz-feeling-toggle-error'
      )}
    >
      <span className="fz-feeling-glyph" aria-hidden="true">
        ✦
      </span>
      <span className="fz-feeling-label">Moodlight</span>
      <span className="fz-feeling-detail">{detail}</span>
    </button>
  )
}
