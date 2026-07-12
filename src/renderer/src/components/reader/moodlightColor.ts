import type { AmbientClassification, AmbientGenre, AmbientMood } from '@shared/types/api'

export type MoodlightRgb = [number, number, number]

export type MoodlightSceneFamily =
  | 'blood'
  | 'city'
  | 'dawn'
  | 'ember'
  | 'magic'
  | 'nocturne'
  | 'oceanic'
  | 'stone'
  | 'storm'
  | 'treasure'
  | 'woodland'

export const MOODLIGHT_SCENE_TAGS = [
  'battle',
  'blood',
  'castle',
  'city',
  'dawn',
  'dusk',
  'fire',
  'fog',
  'forest',
  'garden',
  'gold',
  'magic',
  'night',
  'ocean',
  'rain',
  'river',
  'snow',
  'storm'
] as const

export type MoodlightSceneTag = (typeof MOODLIGHT_SCENE_TAGS)[number]

export interface MoodlightPaletteResult {
  colors: [MoodlightRgb, MoodlightRgb, MoodlightRgb, MoodlightRgb]
  mood: AmbientMood
  secondaryMood: AmbientMood | null
  primaryScene: MoodlightSceneTag | null
  sceneFamily: MoodlightSceneFamily | null
  sceneWeight: number
  intensity: number
  presence: number
}

interface Hsl {
  h: number
  s: number
  l: number
}

interface MoodColorGrade {
  saturation: number
  lightness: number
  accentRange: number
  presence: number
}

const MOOD_COLOR_GRADES: Record<AmbientMood, MoodColorGrade> = {
  love: { saturation: 0.76, lightness: 0.57, accentRange: 28, presence: 0.9 },
  sadness: { saturation: 0.58, lightness: 0.46, accentRange: 18, presence: 0.72 },
  joy: { saturation: 0.84, lightness: 0.6, accentRange: 42, presence: 0.96 },
  mystery: { saturation: 0.72, lightness: 0.48, accentRange: 32, presence: 0.8 },
  tension: { saturation: 0.8, lightness: 0.47, accentRange: 22, presence: 0.88 },
  calm: { saturation: 0.6, lightness: 0.53, accentRange: 22, presence: 0.7 },
  awe: { saturation: 0.76, lightness: 0.55, accentRange: 38, presence: 0.87 },
  fear: { saturation: 0.64, lightness: 0.41, accentRange: 16, presence: 0.76 },
  anger: { saturation: 0.84, lightness: 0.48, accentRange: 16, presence: 0.9 },
  grief: { saturation: 0.4, lightness: 0.42, accentRange: 14, presence: 0.66 },
  hope: { saturation: 0.72, lightness: 0.57, accentRange: 36, presence: 0.86 },
  wonder: { saturation: 0.78, lightness: 0.57, accentRange: 42, presence: 0.9 },
  nostalgia: { saturation: 0.6, lightness: 0.52, accentRange: 24, presence: 0.74 },
  neutral: { saturation: 0.54, lightness: 0.49, accentRange: 24, presence: 0.68 }
}

const MOOD_PALETTES: Record<AmbientMood, [string, string, string]> = {
  love: ['#ff2f7d', '#ff6bd6', '#ffb15f'],
  sadness: ['#236bff', '#31d7ff', '#9a7cff'],
  joy: ['#ffe433', '#ff7a1a', '#00f0ff'],
  mystery: ['#7a2cff', '#d83cff', '#17e7ff'],
  tension: ['#ff2a1f', '#ff9f1c', '#ff2fe0'],
  calm: ['#00e6b0', '#32ff70', '#55d6ff'],
  awe: ['#314dff', '#00e5ff', '#b949ff'],
  fear: ['#6d35ff', '#00ff9d', '#1b2cff'],
  anger: ['#ff1e2d', '#ff5a00', '#ffd000'],
  grief: ['#315eff', '#8298ff', '#25d6ff'],
  hope: ['#27ff7a', '#ffe14d', '#4bd8ff'],
  wonder: ['#8f35ff', '#00eaff', '#ffdf38'],
  nostalgia: ['#ff8a35', '#ffcf59', '#f06dff'],
  neutral: ['#536cff', '#00e8ff', '#cd48ff']
}

const SCENE_PALETTES: Record<MoodlightSceneTag, [string, string, string]> = {
  battle: ['#ff1f2e', '#ff7a00', '#ffd400'],
  blood: ['#ff1648', '#8d00ff', '#ff7a00'],
  castle: ['#7b8cff', '#d7ecff', '#9b43ff'],
  city: ['#00d5ff', '#ff2fe0', '#fff23a'],
  dawn: ['#ff7a2b', '#ffe55a', '#45d7ff'],
  dusk: ['#8f35ff', '#ff4fa3', '#ffb347'],
  fire: ['#ff2b00', '#ff8a00', '#ffe600'],
  fog: ['#78a6ff', '#d46bff', '#2ffff3'],
  forest: ['#00f060', '#b7ff2c', '#00dbff'],
  garden: ['#00f060', '#ff4fd8', '#ffe24a'],
  gold: ['#ffe033', '#ff8f00', '#00e0ff'],
  magic: ['#9438ff', '#00eaff', '#ffd52e'],
  night: ['#314dff', '#9b43ff', '#00d8ff'],
  ocean: ['#006dff', '#00eaff', '#00ffb3'],
  rain: ['#177cff', '#00e0ff', '#996bff'],
  river: ['#007dff', '#00ffc2', '#6da8ff'],
  snow: ['#79c8ff', '#ffffff', '#9b72ff'],
  storm: ['#3a3bff', '#00eaff', '#f6ff3d']
}

const GENRE_PALETTES: Record<AmbientGenre, [string, string, string]> = {
  fantasy: ['#8f35ff', '#00eaff', '#ffd52e'],
  mystery: ['#6b35ff', '#d83cff', '#00d8ff'],
  thriller: ['#ff2348', '#712cff', '#00ffbf'],
  romance: ['#ff2f7d', '#ff7adf', '#ffbc4a'],
  'sci-fi': ['#00eaff', '#314dff', '#ff2fe0'],
  adventure: ['#ff8f00', '#00e0ff', '#31ff7a'],
  literary: ['#ff8a35', '#6d8cff', '#e859ff'],
  academic: ['#3d8dff', '#00d7c6', '#b6e4ff'],
  unknown: ['#536cff', '#00e8ff', '#cd48ff']
}

const COLOR_HINTS: Record<string, string> = {
  amber: '#ffb52c',
  aquamarine: '#27ffd6',
  ash: '#98a1b2',
  azure: '#2f8cff',
  blackberry: '#9a38ff',
  blue: '#236bff',
  blush: '#ff84ba',
  bronze: '#d98b3a',
  burgundy: '#b71955',
  celadon: '#8effbf',
  charcoal: '#51576b',
  chartreuse: '#b7ff2c',
  cobalt: '#2451ff',
  copper: '#ff7f32',
  coral: '#ff5f67',
  crimson: '#ff1648',
  cyan: '#00eaff',
  electric: '#74f3ff',
  emerald: '#00e878',
  ember: '#ff5a00',
  fuchsia: '#ff2fe0',
  glass: '#8df5ff',
  gold: '#ffe033',
  green: '#00f060',
  honey: '#ffbf3f',
  ice: '#c9f4ff',
  indigo: '#3d46ff',
  ink: '#222a66',
  iron: '#a3adbd',
  jade: '#00d88d',
  lavender: '#b87cff',
  lilac: '#d37dff',
  lime: '#89ff2f',
  magenta: '#ff2bd6',
  maroon: '#9d1c34',
  midnight: '#2430a8',
  mint: '#5fffb3',
  moss: '#64d55d',
  neon: '#00eaff',
  orange: '#ff7a00',
  pearl: '#e4ecff',
  peach: '#ff9d5c',
  pink: '#ff4fc3',
  plum: '#9138d8',
  purple: '#8f35ff',
  red: '#ff2a1f',
  rose: '#ff4fa3',
  ruby: '#ff125d',
  sage: '#7bdba1',
  scarlet: '#ff2a36',
  seafoam: '#2dffc8',
  sepia: '#cc8a4b',
  silver: '#d7ecff',
  sky: '#45d7ff',
  slate: '#6f8fff',
  smoke: '#8a86a8',
  stone: '#9cb6d3',
  steel: '#75adff',
  sunrise: '#ffb347',
  teal: '#00e6d0',
  turquoise: '#00f0ff',
  vermilion: '#ff3d18',
  violet: '#9b43ff',
  white: '#f7fbff',
  yellow: '#ffe600'
}

const SCENE_FAMILIES: Record<MoodlightSceneTag, MoodlightSceneFamily> = {
  battle: 'ember',
  blood: 'blood',
  castle: 'stone',
  city: 'city',
  dawn: 'dawn',
  dusk: 'dawn',
  fire: 'ember',
  fog: 'nocturne',
  forest: 'woodland',
  garden: 'woodland',
  gold: 'treasure',
  magic: 'magic',
  night: 'nocturne',
  ocean: 'oceanic',
  rain: 'oceanic',
  river: 'oceanic',
  snow: 'nocturne',
  storm: 'storm'
}

const SCENE_ALIASES: Record<string, MoodlightSceneTag> = {
  amber: 'gold',
  army: 'battle',
  blaze: 'fire',
  blizzard: 'snow',
  brook: 'river',
  burning: 'fire',
  coin: 'gold',
  corridor: 'castle',
  crimson: 'blood',
  duel: 'battle',
  electric: 'storm',
  ember: 'fire',
  fortress: 'castle',
  gale: 'storm',
  glow: 'magic',
  harbor: 'ocean',
  haze: 'fog',
  ice: 'snow',
  jewel: 'gold',
  lightning: 'storm',
  midnight: 'night',
  mist: 'fog',
  moss: 'forest',
  nocturne: 'night',
  oceanic: 'ocean',
  scarlet: 'blood',
  sea: 'ocean',
  ship: 'ocean',
  smoke: 'fog',
  stone: 'castle',
  stream: 'river',
  sunrise: 'dawn',
  sunset: 'dusk',
  tempest: 'storm',
  thunder: 'storm',
  torch: 'fire',
  treasure: 'gold',
  violet: 'dusk',
  wave: 'ocean',
  waves: 'ocean',
  winter: 'snow',
  woodland: 'forest'
}

const SCENE_PRIORITY: readonly MoodlightSceneTag[] = [
  'storm',
  'magic',
  'fire',
  'battle',
  'blood',
  'ocean',
  'rain',
  'river',
  'castle',
  'forest',
  'garden',
  'night',
  'fog',
  'snow',
  'dawn',
  'dusk',
  'gold',
  'city'
]

const SCENE_SET = new Set<string>(MOODLIGHT_SCENE_TAGS)

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function hexToRgb(hex: string): MoodlightRgb {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(
    clean.length === 3
      ? clean
          .split('')
          .map((part) => part + part)
          .join('')
      : clean,
    16
  )
  if (Number.isNaN(value)) return [109, 140, 255]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function mixRgb(a: MoodlightRgb, b: MoodlightRgb, amount: number): MoodlightRgb {
  const safeAmount = clamp01(amount)
  return [
    a[0] + (b[0] - a[0]) * safeAmount,
    a[1] + (b[1] - a[1]) * safeAmount,
    a[2] + (b[2] - a[2]) * safeAmount
  ]
}

function rgbToHsl([rRaw, gRaw, bRaw]: MoodlightRgb): Hsl {
  const r = rRaw / 255
  const g = gRaw / 255
  const b = bRaw / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l }

  const s = delta / (1 - Math.abs(2 * l - 1))
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4

  return { h: (hue * 60 + 360) % 360, s, l }
}

function hslToRgb({ h, s, l }: Hsl): MoodlightRgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const segment = Math.floor(h / 60) % 6
  const [r1, g1, b1]: MoodlightRgb =
    segment === 0
      ? [c, x, 0]
      : segment === 1
        ? [x, c, 0]
        : segment === 2
          ? [0, c, x]
          : segment === 3
            ? [0, x, c]
            : segment === 4
              ? [x, 0, c]
              : [c, 0, x]

  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]
}

function semanticHue(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 3600) / 10
}

function rotateHue(color: MoodlightRgb, degrees: number): MoodlightRgb {
  const hsl = rgbToHsl(color)
  return hslToRgb({ ...hsl, h: (hsl.h + degrees + 360) % 360 })
}

export function vividRgb(color: MoodlightRgb): MoodlightRgb {
  const hsl = rgbToHsl(color)

  if (hsl.s < 0.08) {
    return hslToRgb({
      h: hsl.h,
      s: hsl.s,
      l: Math.min(0.72, Math.max(0.4, hsl.l))
    })
  }

  return hslToRgb({
    h: hsl.h,
    s: Math.min(0.9, Math.max(0.66, hsl.s * 0.78 + 0.18)),
    l: Math.min(0.66, Math.max(0.42, hsl.l * 0.62 + 0.2))
  })
}

function gradeForMood(
  color: MoodlightRgb,
  mood: AmbientMood,
  intensity: number,
  accent = false
): MoodlightRgb {
  const hsl = rgbToHsl(color)
  const grade = MOOD_COLOR_GRADES[mood]
  const intensityShift = (clamp01(intensity) - 0.5) * 0.1
  const neutralColor = hsl.s < 0.08
  const saturation = neutralColor
    ? Math.min(0.14, grade.saturation * 0.18)
    : Math.min(
        0.9,
        Math.max(
          0.34,
          hsl.s * 0.25 + grade.saturation * 0.75 + intensityShift - (accent ? 0.03 : 0)
        )
      )
  const lightness = Math.min(
    0.66,
    Math.max(
      0.36,
      hsl.l * 0.42 + grade.lightness * 0.58 + intensityShift * 0.4 + (accent ? 0.015 : 0)
    )
  )

  return hslToRgb({ h: hsl.h, s: saturation, l: lightness })
}

export function rgba(color: MoodlightRgb, alpha: number): string {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(
    color[2]
  )}, ${alpha.toFixed(4)})`
}

function paletteFromHex(
  values: [string, string, string]
): [MoodlightRgb, MoodlightRgb, MoodlightRgb] {
  return values.map((color) => vividRgb(hexToRgb(color))) as [
    MoodlightRgb,
    MoodlightRgb,
    MoodlightRgb
  ]
}

function normalizeHint(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function colorFromHint(hint: string): MoodlightRgb | null {
  const normalized = normalizeHint(hint)
  if (!normalized) return null

  const known = COLOR_HINTS[normalized]
  if (known) return vividRgb(hexToRgb(known))

  return vividRgb(
    hslToRgb({
      h: semanticHue(normalized),
      s: 1,
      l: 0.6
    })
  )
}

function paletteFromHints(classification: AmbientClassification): MoodlightRgb[] {
  const seen = new Set<string>()
  const hints =
    classification.paletteHints.length > 0 ? classification.paletteHints : [classification.genre]

  return hints
    .map(normalizeHint)
    .filter((hint) => {
      if (!hint || seen.has(hint)) return false
      seen.add(hint)
      return true
    })
    .map(colorFromHint)
    .filter((color): color is MoodlightRgb => Boolean(color))
    .slice(0, 5)
}

function resolveSceneTag(tag: string): MoodlightSceneTag | null {
  const normalized = tag.trim().toLowerCase()
  if (SCENE_SET.has(normalized)) return normalized as MoodlightSceneTag
  return SCENE_ALIASES[normalized] ?? null
}

function resolvedSceneTags(classification: AmbientClassification): MoodlightSceneTag[] {
  const tags = classification.sceneTags
    .map(resolveSceneTag)
    .filter((tag): tag is MoodlightSceneTag => Boolean(tag))
  return [...new Set(tags)]
}

function dominantScene(classification: AmbientClassification): MoodlightSceneTag | null {
  const tags = resolvedSceneTags(classification)
  return SCENE_PRIORITY.find((tag) => tags.includes(tag)) ?? tags[0] ?? null
}

export function getMoodlightPalette(
  classification: AmbientClassification | null
): MoodlightPaletteResult {
  const mood = classification?.mood ?? 'neutral'
  const secondaryMood = classification?.secondaryMood ?? null
  const intensity = clamp01(classification?.intensity ?? 0.38)
  const moodColors = paletteFromHex(MOOD_PALETTES[mood])
  const secondaryColors = secondaryMood ? paletteFromHex(MOOD_PALETTES[secondaryMood]) : null
  const genreColors = classification ? paletteFromHex(GENRE_PALETTES[classification.genre]) : null
  const hintColors = classification ? paletteFromHints(classification) : []
  const primaryScene = classification ? dominantScene(classification) : null
  const sceneColors = primaryScene ? paletteFromHex(SCENE_PALETTES[primaryScene]) : null
  const sceneFamily = primaryScene ? SCENE_FAMILIES[primaryScene] : null
  const sceneWeight = sceneColors ? Math.min(0.72, 0.36 + intensity * 0.3) : 0
  const genreWeight =
    genreColors && classification?.genre !== 'unknown' ? 0.14 + intensity * 0.08 : 0
  const hintWeight = hintColors.length > 0 ? Math.min(0.34, 0.18 + hintColors.length * 0.035) : 0
  const grade = MOOD_COLOR_GRADES[mood]
  const secondaryAccent = secondaryColors
    ? mixRgb(moodColors[2], secondaryColors[1], 0.34)
    : moodColors[2]

  const c1Base = mixRgb(moodColors[0], sceneColors?.[0] ?? moodColors[0], sceneWeight)
  const c2Base = mixRgb(moodColors[1], sceneColors?.[1] ?? moodColors[1], sceneWeight)
  const c3Base = mixRgb(secondaryAccent, sceneColors?.[2] ?? secondaryAccent, sceneWeight * 0.86)
  const c1 = gradeForMood(
    mixRgb(
      mixRgb(c1Base, genreColors?.[0] ?? c1Base, genreWeight),
      hintColors[0] ?? c1Base,
      hintWeight
    ),
    mood,
    intensity
  )
  const c2 = gradeForMood(
    mixRgb(
      mixRgb(c2Base, genreColors?.[1] ?? c2Base, genreWeight),
      hintColors[1] ?? c2Base,
      hintWeight
    ),
    mood,
    intensity
  )
  const c3 = gradeForMood(
    mixRgb(
      mixRgb(c3Base, genreColors?.[2] ?? c3Base, genreWeight),
      hintColors[2] ?? c3Base,
      hintWeight
    ),
    mood,
    intensity
  )
  const coherentAccent = rotateHue(mixRgb(c1, c2, 0.46), grade.accentRange + intensity * 8)
  const counterAccent = rotateHue(c2, -grade.accentRange * 0.55)
  const c4 = gradeForMood(
    mixRgb(
      mixRgb(coherentAccent, counterAccent, 0.32),
      hintColors[3] ?? hintColors[4] ?? coherentAccent,
      hintWeight * 0.42
    ),
    mood,
    intensity,
    true
  )

  return {
    colors: [c1, c2, c3, c4],
    mood,
    secondaryMood,
    primaryScene,
    sceneFamily,
    sceneWeight,
    intensity,
    presence: Math.min(1, grade.presence * (0.88 + intensity * 0.16))
  }
}
