import type { AmbientClassification } from '@shared/types/api'

type MoodPalette = [string, string, string]

const PALETTES: Record<string, MoodPalette> = {
  love:     ['#e0204a', '#ff85a1', '#8b1538'],
  sadness:  ['#1e3a7a', '#4a9ed4', '#6b8fa8'],
  joy:      ['#e8a800', '#ff7d00', '#ffe060'],
  mystery:  ['#5a1580', '#a040d8', '#1a0838'],
  tension:  ['#c84010', '#8b0000', '#ff6020'],
  calm:     ['#1ab870', '#008080', '#a0e0c0'],
  awe:      ['#3040e0', '#8060f8', '#00b8ff'],
  neutral:  ['#304060', '#203050', '#405080'],
}

const NON_FICTION_SCALE = 0.4

function getPalette(classification: AmbientClassification): MoodPalette {
  const mood = classification.type === 'non-fiction' ? 'neutral' : classification.mood
  return PALETTES[mood] ?? PALETTES.neutral
}

function getBlobOpacity(classification: AmbientClassification): number {
  const base = 0.06 + classification.intensity * 0.12
  const scale = classification.type === 'non-fiction' ? NON_FICTION_SCALE : 1
  return Math.min(0.18, Math.max(0.04, base * scale))
}

export function FeelingAurora({
  classification
}: {
  classification: AmbientClassification | null
}): React.JSX.Element {
  // Show immediately with neutral palette — don't wait for LLM classification.
  // When the classification arrives, blob colors transition smoothly (2.5s).
  const [c1, c2, c3] = classification ? getPalette(classification) : PALETTES.neutral
  const opacity = classification ? getBlobOpacity(classification) : 0.14

  return (
    <div className="fz-aurora-layer" aria-hidden="true">
      <div
        className="fz-aurora-blob fz-aurora-drift-a"
        style={{
          backgroundColor: c1,
          opacity,
          top: '5%',
          left: '10%',
          transition: 'background-color 2.5s ease, opacity 2.5s ease'
        }}
      />
      <div
        className="fz-aurora-blob fz-aurora-drift-b"
        style={{
          backgroundColor: c2,
          opacity,
          top: '40%',
          right: '5%',
          transition: 'background-color 2.5s ease, opacity 2.5s ease'
        }}
      />
      <div
        className="fz-aurora-blob fz-aurora-drift-c"
        style={{
          backgroundColor: c3,
          opacity,
          bottom: '10%',
          left: '25%',
          transition: 'background-color 2.5s ease, opacity 2.5s ease'
        }}
      />
    </div>
  )
}
