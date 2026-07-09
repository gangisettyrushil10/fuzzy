import type { CSSProperties } from 'react'
import type { AmbientClassification } from '@shared/types/api'

type MoodPalette = [string, string, string]

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

export function getAmbientStyle(classification: AmbientClassification | null): CSSProperties {
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
