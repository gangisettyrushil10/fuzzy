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
  amber: '#ffbd4a',
  ash: '#98a1b2',
  blackberry: '#8c4f9f',
  blue: '#4f8fff',
  blush: '#ff9ec1',
  charcoal: '#596275',
  crimson: '#ef3d60',
  cyan: '#57e3ff',
  copper: '#dc8652',
  'dusty-rose': '#c28f9e',
  electric: '#8fd4ff',
  ember: '#ff7b35',
  glass: '#9deaf0',
  gold: '#ffd05a',
  green: '#3bcf78',
  honey: '#f0b95a',
  ice: '#d8f0ff',
  indigo: '#5968ff',
  ink: '#3a4167',
  maroon: '#9d2237',
  midnight: '#3942a1',
  mint: '#93e3af',
  moss: '#75a85a',
  neon: '#66c2ff',
  orange: '#ff8c36',
  peach: '#ffb78e',
  pearl: '#d7dce7',
  purple: '#8c5dff',
  red: '#ed4f43',
  rose: '#f06f9b',
  sage: '#8fb8a5',
  scarlet: '#f35454',
  seafoam: '#98e3d0',
  sepia: '#b68452',
  silver: '#cbd8ec',
  sky: '#9dd2ff',
  slate: '#7892ba',
  smoke: '#8d8795',
  iron: '#9da4b2',
  azure: '#70a3ff',
  stone: '#a2acbb',
  steel: '#91a6c7',
  sunrise: '#ffcc74',
  teal: '#20c8c0',
  violet: '#946dff'
}

const PALETTES: Record<string, MoodPalette> = {
  love: ['#ff4f73', '#ff9ab6', '#b83363'],
  sadness: ['#4a72e8', '#65c5f7', '#93abd0'],
  joy: ['#ffbf2f', '#ff8f32', '#fff08a'],
  mystery: ['#8a45ff', '#ce64ff', '#4550d8'],
  tension: ['#f15f2f', '#df2935', '#ff9a3d'],
  calm: ['#31d892', '#2fc7c3', '#b7f0d8'],
  awe: ['#6677ff', '#a784ff', '#38d8ff'],
  fear: ['#7668d9', '#9d8cff', '#505a89'],
  anger: ['#ef3838', '#ff744d', '#a7202c'],
  grief: ['#71859e', '#a6b8ce', '#4f5f7d'],
  hope: ['#7bdc88', '#ffd26f', '#9dddff'],
  wonder: ['#856cff', '#3bdcff', '#ffe07a'],
  nostalgia: ['#c88765', '#e8b674', '#e0a0b8'],
  neutral: ['#6d8cff', '#4bd6f0', '#b9c7ff']
}

const NON_FICTION_SCALE = 0.72

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
  const base = 0.11 + classification.intensity * 0.2
  const scale = classification.type === 'non-fiction' ? NON_FICTION_SCALE : 1
  return Math.min(0.34, Math.max(0.08, base * scale))
}

export function getAmbientStyle(
  classification: AmbientClassification | null
): React.CSSProperties {
  const [c1, c2, c3] = classification ? getPalette(classification) : PALETTES.neutral
  const opacity = classification ? getBlobOpacity(classification) : 0.09
  const intensity = classification?.intensity ?? 0.38
  const motion = classification?.motion ?? 'drift'
  const driftBase =
    motion === 'wave'
      ? 34
      : motion === 'pulse'
        ? 32
        : motion === 'embers'
          ? 30
          : motion === 'shimmer'
            ? 36
            : motion === 'mist'
              ? 42
              : motion === 'still'
                ? 56
                : 44
  const drift = driftBase - Math.round(intensity * 6)
  // Kept well under the old 82-140px ceiling: at full-viewport size those large
  // blur radii blew past Chromium's tile raster budget on HiDPI displays
  // ("tile memory limits exceeded" in devtools), which is what read as choppy
  // stutter rather than a flowing drift.
  const glow = 44 + Math.round(intensity * 30)
  const motionScale =
    motion === 'wave'
      ? 1.1
      : motion === 'mist'
        ? 1.12
        : motion === 'pulse'
          ? 1.06
          : motion === 'embers'
            ? 1.08
            : motion === 'still'
              ? 0.96
              : 1.03
  const secondary = classification?.secondaryMood
  const [c4] = secondary ? (PALETTES[secondary] ?? PALETTES.neutral) : [c2]

  return {
    ['--fz-ambient-c1' as string]: c1,
    ['--fz-ambient-c2' as string]: c2,
    ['--fz-ambient-c3' as string]: c3,
    ['--fz-ambient-c4' as string]: c4,
    ['--fz-ambient-opacity' as string]: opacity.toFixed(3),
    ['--fz-ambient-drift' as string]: `${drift}s`,
    ['--fz-ambient-drift-slow' as string]: `${drift + 18}s`,
    ['--fz-ambient-drift-fast' as string]: `${Math.max(24, drift - 6)}s`,
    ['--fz-ambient-drift-glacial' as string]: `${drift + 30}s`,
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
  if (classification.intensity < 0.72) return null
  if (tags.has('magic')) return 'magic'
  if (tags.has('gold')) return 'treasure'
  return null
}

function parallaxStyle(
  depth: number,
  live?: { progress: number; velocity: number; phase: number }
): React.CSSProperties {
  const progress = live?.progress ?? 0.5
  const velocity = live?.velocity ?? 0
  const phase = live?.phase ?? 0.5
  const x = (progress - 0.5) * depth * 14 + (phase - 0.5) * depth * 5
  const y = velocity * depth * -14
  const rotate = velocity * depth * -1.25
  const scale = 1 + Math.abs(velocity) * depth * 0.035

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
      <div className="fz-ambient-haze" />
      <div className="fz-ambient-depth fz-ambient-depth-curtain" style={parallaxStyle(0.35, live)}>
        <div className="fz-ambient-ribbon fz-ambient-ribbon-back" />
      </div>
      <div className="fz-ambient-depth fz-ambient-depth-back" style={parallaxStyle(0.5, live)}>
        <div className="fz-ambient-wave fz-ambient-wave-top" />
      </div>
      <div className="fz-ambient-depth fz-ambient-depth-mid" style={parallaxStyle(0.9, live)}>
        <div className="fz-ambient-wave fz-ambient-wave-bottom" />
      </div>
      <div className="fz-ambient-depth fz-ambient-depth-ribbon" style={parallaxStyle(1.05, live)}>
        <div className="fz-ambient-ribbon fz-ambient-ribbon-front" />
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
