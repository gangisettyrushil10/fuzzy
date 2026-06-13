import type { AmbientClassification } from '@shared/types/api'

type MoodPalette = [string, string, string]
type AmbientFamily =
  | 'oceanic'
  | 'storm'
  | 'magic'
  | 'ember'
  | 'blood'
  | 'stone'
  | 'woodland'
  | 'nocturne'
  | 'dawn'
  | 'treasure'
  | 'city'
  | 'default'

const COLOR_HINTS: Record<string, string> = {
  amber: '#d9922f',
  ash: '#626776',
  blackberry: '#4b274f',
  blue: '#3f72ff',
  blush: '#ff8cb5',
  charcoal: '#293242',
  crimson: '#c42b47',
  cyan: '#4fd7ff',
  copper: '#b86a39',
  'dusty-rose': '#c28f9e',
  electric: '#7ebdff',
  ember: '#ff6a2a',
  glass: '#8cd7de',
  gold: '#f4ba43',
  green: '#2d9f5d',
  honey: '#d0a24b',
  ice: '#c7e6ff',
  indigo: '#3941a8',
  ink: '#171c32',
  maroon: '#6f1623',
  midnight: '#1c204d',
  mint: '#93e3af',
  moss: '#527d40',
  neon: '#59a8ff',
  orange: '#ff8c36',
  peach: '#ffb78e',
  pearl: '#d7dce7',
  purple: '#6f3ed6',
  red: '#c93a2f',
  rose: '#df5d86',
  sage: '#8fb8a5',
  scarlet: '#d63f3f',
  seafoam: '#98e3d0',
  sepia: '#8f673f',
  silver: '#b3c3d9',
  sky: '#8cc7ff',
  slate: '#4c6384',
  smoke: '#68636f',
  iron: '#7c808a',
  azure: '#5f8dff',
  stone: '#818997',
  steel: '#7688a3',
  sunrise: '#ffcc74',
  teal: '#1aa7a1',
  violet: '#7b4dff'
}

const PALETTES: Record<string, MoodPalette> = {
  love: ['#e0204a', '#ff85a1', '#8b1538'],
  sadness: ['#1e3a7a', '#4a9ed4', '#6b8fa8'],
  joy: ['#e8a800', '#ff7d00', '#ffe060'],
  mystery: ['#5a1580', '#a040d8', '#1a0838'],
  tension: ['#c84010', '#8b0000', '#ff6020'],
  calm: ['#1ab870', '#008080', '#a0e0c0'],
  awe: ['#3040e0', '#8060f8', '#00b8ff'],
  fear: ['#4a3a88', '#6e5cff', '#15192e'],
  anger: ['#b52020', '#ff4f2f', '#631018'],
  grief: ['#4d5f77', '#8395ac', '#2a3140'],
  hope: ['#6dbf77', '#f0c45d', '#8fd1ff'],
  wonder: ['#6b50ff', '#27c4e8', '#ffd369'],
  nostalgia: ['#a76b5b', '#d5a46c', '#cc8fa2'],
  neutral: ['#304060', '#203050', '#405080']
}

const NON_FICTION_SCALE = 0.4

function getPalette(classification: AmbientClassification): MoodPalette {
  const hinted = classification.paletteHints
    .map((hint) => COLOR_HINTS[hint])
    .filter((value): value is string => Boolean(value))
  if (hinted.length >= 3) return [hinted[0], hinted[1], hinted[2]]

  const mood = classification.type === 'non-fiction' ? 'neutral' : classification.mood
  const base = PALETTES[mood] ?? PALETTES.neutral
  return [hinted[0] ?? base[0], hinted[1] ?? base[1], hinted[2] ?? base[2]]
}

function getBlobOpacity(classification: AmbientClassification): number {
  const base = 0.06 + classification.intensity * 0.12
  const scale = classification.type === 'non-fiction' ? NON_FICTION_SCALE : 1
  return Math.min(0.18, Math.max(0.04, base * scale))
}

function getAmbientStyle(classification: AmbientClassification | null): React.CSSProperties {
  const [c1, c2, c3] = classification ? getPalette(classification) : PALETTES.neutral
  const opacity = classification ? getBlobOpacity(classification) : 0.09
  const intensity = classification?.intensity ?? 0.38
  const motion = classification?.motion ?? 'drift'
  const driftBase =
    motion === 'wave'
      ? 18
      : motion === 'pulse'
        ? 16
        : motion === 'embers'
          ? 14
          : motion === 'shimmer'
            ? 20
            : motion === 'mist'
              ? 24
              : motion === 'still'
                ? 36
                : 30
  const drift = driftBase - Math.round(intensity * 4)
  const glow = 120 + Math.round(intensity * 70)
  const motionScale =
    motion === 'wave'
      ? 1.14
      : motion === 'mist'
        ? 1.2
        : motion === 'pulse'
          ? 1.08
          : motion === 'embers'
            ? 1.12
            : motion === 'still'
              ? 0.92
              : 1
  const secondary = classification?.secondaryMood
  const [c4] = secondary ? (PALETTES[secondary] ?? PALETTES.neutral) : [c2]

  return {
    ['--fz-ambient-c1' as string]: c1,
    ['--fz-ambient-c2' as string]: c2,
    ['--fz-ambient-c3' as string]: c3,
    ['--fz-ambient-c4' as string]: c4,
    ['--fz-ambient-opacity' as string]: opacity.toFixed(3),
    ['--fz-ambient-drift' as string]: `${drift}s`,
    ['--fz-ambient-drift-slow' as string]: `${drift + 11}s`,
    ['--fz-ambient-drift-fast' as string]: `${Math.max(14, drift - 8)}s`,
    ['--fz-ambient-blur' as string]: `${glow}px`,
    ['--fz-ambient-motion-scale' as string]: `${motionScale}`
  }
}

function getFamily(classification: AmbientClassification | null): AmbientFamily {
  if (!classification) return 'default'
  const tags = new Set(classification.sceneTags)
  if (tags.has('storm')) return 'storm'
  if (tags.has('magic')) return 'magic'
  if (tags.has('ocean') || tags.has('river') || tags.has('rain')) return 'oceanic'
  if (tags.has('fire') || tags.has('battle')) return 'ember'
  if (tags.has('blood')) return 'blood'
  if (tags.has('castle')) return 'stone'
  if (tags.has('forest') || tags.has('garden')) return 'woodland'
  if (tags.has('night') || tags.has('fog') || tags.has('snow')) return 'nocturne'
  if (tags.has('dawn') || tags.has('dusk')) return 'dawn'
  if (tags.has('gold')) return 'treasure'
  if (tags.has('city')) return 'city'
  return 'default'
}

function withLive(
  base: React.CSSProperties,
  live?: { progress: number; velocity: number; phase: number; pageNumber?: number }
): React.CSSProperties {
  const progress = live?.progress ?? 0.5
  const velocity = live?.velocity ?? 0
  const phase = live?.phase ?? 0
  const surge = Math.min(1, Math.abs(velocity))

  return {
    ...base,
    ['--fz-ambient-progress' as string]: progress.toFixed(3),
    ['--fz-ambient-velocity' as string]: velocity.toFixed(3),
    ['--fz-ambient-surge' as string]: surge.toFixed(3),
    ['--fz-ambient-phase' as string]: phase.toFixed(3)
  }
}

type BurstKind = 'magic' | 'storm' | 'blood' | 'treasure' | 'fire' | null

function getBurstKind(classification: AmbientClassification | null): BurstKind {
  if (!classification) return null
  const tags = new Set(classification.sceneTags)
  if (tags.has('magic')) return 'magic'
  if (tags.has('storm')) return 'storm'
  if (tags.has('blood') || classification.mood === 'anger' || classification.mood === 'grief') {
    return 'blood'
  }
  if (tags.has('gold')) return 'treasure'
  if (tags.has('fire') || classification.motion === 'embers') return 'fire'
  return null
}

function parallaxStyle(
  depth: number,
  live?: { progress: number; velocity: number; phase: number }
): React.CSSProperties {
  const progress = live?.progress ?? 0.5
  const velocity = live?.velocity ?? 0
  const phase = live?.phase ?? 0.5
  const x = (progress - 0.5) * depth * 26 + (phase - 0.5) * depth * 10
  const y = velocity * depth * -32
  const rotate = velocity * depth * -3.8
  const scale = 1 + Math.abs(velocity) * depth * 0.1

  return {
    transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`
  }
}

export function FeelingAurora({
  classification,
  live
}: {
  classification: AmbientClassification | null
  live?: { progress: number; velocity: number; phase: number; pageNumber?: number }
}): React.JSX.Element {
  const pageKey = `${live?.pageNumber ?? 0}:${classification?.mood ?? 'neutral'}:${classification?.sceneTags[0] ?? 'none'}`
  const burstKind = getBurstKind(classification)
  const family = getFamily(classification)

  return (
    <div
      className={`fz-ambient-shell fz-ambient-family-${family}`}
      style={withLive(getAmbientStyle(classification), live)}
      aria-hidden="true"
    >
      <div className="fz-ambient-chapter-entry" key={`entry:${pageKey}`} />
      <div className="fz-ambient-wash" />
      <div className="fz-ambient-depth fz-ambient-depth-back" style={parallaxStyle(0.5, live)}>
        <div className="fz-ambient-wave fz-ambient-wave-top" />
      </div>
      <div className="fz-ambient-depth fz-ambient-depth-mid" style={parallaxStyle(0.9, live)}>
        <div className="fz-ambient-wave fz-ambient-wave-bottom" />
      </div>
      <div className="fz-ambient-depth fz-ambient-depth-fore" style={parallaxStyle(1.3, live)}>
        <div className="fz-ambient-orb fz-ambient-orb-left" />
      </div>
      <div className="fz-ambient-depth fz-ambient-depth-crest" style={parallaxStyle(1.7, live)}>
        <div className="fz-ambient-orb fz-ambient-orb-right" />
      </div>
      {burstKind && (
        <div
          className={`fz-ambient-burst fz-ambient-burst-${burstKind}`}
          key={`burst:${pageKey}`}
        />
      )}
      <div className="fz-ambient-vignette" />
    </div>
  )
}
