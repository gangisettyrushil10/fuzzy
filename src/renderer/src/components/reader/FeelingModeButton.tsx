import { useEffect, useState } from 'react'
import type { AmbientClassification, AmbientMood } from '@shared/types/api'
import { cn } from '../../lib/cn'

type FeelingStatus = 'idle' | 'classifying' | 'ready' | 'error'
type MoodlightMode = 'readable' | 'vivid'

const MOODLIGHT_MODE_KEY = 'fuzzy.moodlightMode.v2'

const MOODLIGHT_MODES: ReadonlyArray<{
  value: MoodlightMode
  label: string
  title: string
}> = [
  { value: 'readable', label: 'Read', title: 'Readable Moodlight' },
  { value: 'vivid', label: 'Vivid', title: 'Vivid Moodlight' }
]

const MOODLIGHT_MODE_LABELS: Record<MoodlightMode, string> = {
  readable: 'Readable',
  vivid: 'Vivid'
}

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

function isMoodlightMode(value: string | null): value is MoodlightMode {
  return value === 'readable' || value === 'vivid'
}

function loadMoodlightMode(): MoodlightMode {
  if (typeof window === 'undefined') return 'vivid'

  try {
    const saved = window.localStorage.getItem(MOODLIGHT_MODE_KEY)
    return isMoodlightMode(saved) ? saved : 'vivid'
  } catch {
    return 'vivid'
  }
}

function applyMoodlightMode(mode: MoodlightMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.fzMoodlightMode = mode
}

function saveMoodlightMode(mode: MoodlightMode): void {
  applyMoodlightMode(mode)
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(MOODLIGHT_MODE_KEY, mode)
  } catch {
    /* keep the in-session setting */
  }
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
  const [mode, setMode] = useState<MoodlightMode>(loadMoodlightMode)
  const detail = feelingDetail(enabled, status, classification)
  const modeLabel = MOODLIGHT_MODE_LABELS[mode]
  const title = enabled ? `Moodlight on: ${detail} (${modeLabel})` : 'Moodlight off'

  useEffect(() => {
    applyMoodlightMode(mode)
  }, [mode])

  const setAndSaveMode = (nextMode: MoodlightMode): void => {
    setMode(nextMode)
    saveMoodlightMode(nextMode)
  }

  return (
    <div className="fz-moodlight-controls">
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
      {enabled && (
        <div className="fz-moodlight-mode-toggle" role="radiogroup" aria-label="Moodlight mode">
          {MOODLIGHT_MODES.map((option) => {
            const active = option.value === mode
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={option.title}
                onClick={() => setAndSaveMode(option.value)}
                className={cn(active && 'fz-moodlight-mode-active')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
