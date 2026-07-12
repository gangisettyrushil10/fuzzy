import { useEffect, useRef } from 'react'
import type { AmbientClassification } from '@shared/types/api'
import { getAmbientOpacity, getAmbientPalette } from './ambientStyle'

type Rgb = [number, number, number]

interface AuroraTarget {
  colors: [Rgb, Rgb, Rgb, Rgb]
  opacity: number
  intensity: number
  speed: number
  spread: number
  energy: number
  turbulence: number
  pulse: number
  flow: number
}

const NEUTRAL_TARGET: AuroraTarget = {
  colors: [
    [83, 108, 255],
    [0, 232, 255],
    [205, 72, 255],
    [255, 214, 54]
  ],
  opacity: 0.28,
  intensity: 0.38,
  speed: 0.000055,
  spread: 0.42,
  energy: 0.42,
  turbulence: 0.22,
  pulse: 0.08,
  flow: 1
}

interface Hsl {
  h: number
  s: number
  l: number
}

const MOOD_PALETTES: Record<string, [string, string, string]> = {
  love: ['#ff2f7d', '#ff6bd6', '#ffb15f'],
  sadness: ['#236bff', '#31d7ff', '#9a7cff'],
  joy: ['#ffe433', '#ff7a1a', '#00f0ff'],
  mystery: ['#7a2cff', '#d83cff', '#17e7ff'],
  tension: ['#ff2a1f', '#ff9f1c', '#4b36ff'],
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

const SCENE_PALETTES: Record<string, [string, string, string]> = {
  battle: ['#ff1f2e', '#ff7a00', '#ffd400'],
  blood: ['#ff1648', '#8d00ff', '#ff7a00'],
  city: ['#00d5ff', '#ff2fe0', '#fff23a'],
  dawn: ['#ff7a2b', '#ffe55a', '#45d7ff'],
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
  storm: ['#3a3bff', '#00eaff', '#f6ff3d'],
  treasure: ['#ffe033', '#ff4fd8', '#00f0ff']
}

function hexToRgb(hex: string): Rgb {
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

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount
  ]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function rgbToHsl([rRaw, gRaw, bRaw]: Rgb): Hsl {
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

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const segment = Math.floor(h / 60) % 6
  const [r1, g1, b1]: Rgb =
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

function rotateHue(color: Rgb, degrees: number): Rgb {
  const hsl = rgbToHsl(color)
  return hslToRgb({ ...hsl, h: (hsl.h + degrees + 360) % 360 })
}

function vividRgb(color: Rgb): Rgb {
  const hsl = rgbToHsl(color)
  return hslToRgb({
    h: hsl.h,
    s: Math.max(0.9, clamp01(hsl.s * 1.65 + 0.18)),
    l: Math.min(0.68, Math.max(0.5, hsl.l * 0.72 + 0.24))
  })
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha.toFixed(4)})`
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

function easeForDelta(deltaMs: number, durationMs: number): number {
  return 1 - Math.exp(-Math.max(0, deltaMs) / durationMs)
}

function cloneTarget(target: AuroraTarget): AuroraTarget {
  return {
    colors: target.colors.map((color) => [...color] as Rgb) as [Rgb, Rgb, Rgb, Rgb],
    opacity: target.opacity,
    intensity: target.intensity,
    speed: target.speed,
    spread: target.spread,
    energy: target.energy,
    turbulence: target.turbulence,
    pulse: target.pulse,
    flow: target.flow
  }
}

function paletteFromHex(values: [string, string, string]): [Rgb, Rgb, Rgb] {
  return values.map((color) => vividRgb(hexToRgb(color))) as [Rgb, Rgb, Rgb]
}

function dominantScene(classification: AmbientClassification): string | null {
  return classification.sceneTags.find((tag) => SCENE_PALETTES[tag]) ?? null
}

function semanticPalette(classification: AmbientClassification): [Rgb, Rgb, Rgb] {
  const fallback = getAmbientPalette(classification).map((color) => vividRgb(hexToRgb(color))) as [
    Rgb,
    Rgb,
    Rgb
  ]
  const moodColors = MOOD_PALETTES[classification.mood]
    ? paletteFromHex(MOOD_PALETTES[classification.mood])
    : fallback
  const scene = dominantScene(classification)
  const sceneColors = scene ? paletteFromHex(SCENE_PALETTES[scene]) : null
  const sceneWeight =
    sceneColors && classification.sceneTags.length > 0
      ? Math.min(0.72, 0.38 + classification.intensity * 0.34)
      : 0
  const secondary = classification.secondaryMood
  const secondaryColors =
    secondary && MOOD_PALETTES[secondary] ? paletteFromHex(MOOD_PALETTES[secondary]) : null

  return [
    vividRgb(mixRgb(moodColors[0], sceneColors?.[0] ?? fallback[0], sceneWeight)),
    vividRgb(mixRgb(moodColors[1], sceneColors?.[1] ?? fallback[1], sceneWeight)),
    vividRgb(
      mixRgb(
        secondaryColors ? mixRgb(moodColors[2], secondaryColors[1], 0.34) : moodColors[2],
        sceneColors?.[2] ?? fallback[2],
        sceneWeight * 0.86
      )
    )
  ]
}

function sceneMotion(
  classification: AmbientClassification
): Pick<AuroraTarget, 'energy' | 'flow' | 'pulse' | 'speed' | 'spread' | 'turbulence'> {
  const tags = new Set(classification.sceneTags)
  const mood = classification.mood
  const hot = tags.has('battle') || tags.has('fire') || tags.has('blood') || mood === 'anger'
  const tense = hot || tags.has('storm') || mood === 'tension' || mood === 'fear'
  const fluid = tags.has('ocean') || tags.has('rain') || tags.has('river')
  const quiet =
    tags.has('fog') ||
    tags.has('snow') ||
    tags.has('night') ||
    classification.motion === 'mist' ||
    classification.motion === 'still' ||
    mood === 'calm' ||
    mood === 'grief' ||
    mood === 'sadness'
  const luminous =
    tags.has('magic') ||
    tags.has('gold') ||
    tags.has('treasure') ||
    mood === 'wonder' ||
    mood === 'awe'
  const baseEnergy = Math.min(1, Math.max(0, classification.intensity))

  if (tense) {
    return {
      energy: Math.max(0.78, baseEnergy),
      flow: tags.has('storm') ? 1.9 : 1.65,
      pulse: tags.has('storm') ? 0.36 : 0.3,
      speed: tags.has('storm') ? 0.00012 : 0.000105,
      spread: 0.5,
      turbulence: tags.has('storm') ? 0.72 : 0.58
    }
  }

  if (fluid) {
    return {
      energy: Math.max(0.48, baseEnergy * 0.8),
      flow: 1.42,
      pulse: 0.08,
      speed: 0.000066,
      spread: 0.52,
      turbulence: 0.22
    }
  }

  if (luminous) {
    return {
      energy: Math.max(0.58, baseEnergy * 0.86),
      flow: 1.2,
      pulse: 0.18,
      speed: 0.000074,
      spread: 0.48,
      turbulence: 0.32
    }
  }

  if (quiet) {
    return {
      energy: Math.max(0.24, baseEnergy * 0.52),
      flow: 0.72,
      pulse: 0.04,
      speed: 0.000034,
      spread: 0.34,
      turbulence: 0.08
    }
  }

  return {
    energy: Math.max(0.36, baseEnergy * 0.72),
    flow: 1,
    pulse: 0.1,
    speed: 0.000054,
    spread: 0.42,
    turbulence: 0.18
  }
}

function makeAuroraTarget(classification: AmbientClassification | null): AuroraTarget {
  if (!classification) return cloneTarget(NEUTRAL_TARGET)

  const [c1, c2, c3] = semanticPalette(classification)
  const spectrumAccent = vividRgb(rotateHue(c1, 128 + classification.intensity * 72))
  const c4 = mixRgb(spectrumAccent, vividRgb(rotateHue(c2, -96)), 0.38)
  const motion = sceneMotion(classification)

  return {
    colors: [c1, c2, c3, c4],
    opacity: Math.min(
      0.58,
      Math.max(0.24, getAmbientOpacity(classification) * 1.55 + classification.intensity * 0.1)
    ),
    intensity: Math.min(1, Math.max(0, classification.intensity)),
    speed: motion.speed,
    spread: motion.spread,
    energy: motion.energy,
    turbulence: motion.turbulence,
    pulse: motion.pulse,
    flow: motion.flow
  }
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  width: number,
  yBase: number,
  amplitude: number,
  thickness: number,
  phase: number,
  colorA: Rgb,
  colorB: Rgb,
  alpha: number,
  flow = 1,
  turbulence = 0.18
): void {
  const step = Math.max(34, width / 24)
  const points: Array<[number, number]> = []

  for (let x = -step; x <= width + step; x += step) {
    const xRatio = x / Math.max(1, width)
    const y =
      yBase +
      Math.sin(xRatio * Math.PI * 2.1 * flow + phase) * amplitude +
      Math.sin(xRatio * Math.PI * 4.3 * flow + phase * 0.58) *
        amplitude *
        (0.18 + turbulence * 0.36) +
      Math.sin(xRatio * Math.PI * 8.1 + phase * 1.12) * amplitude * turbulence * 0.12
    points.push([x, y])
  }

  ctx.beginPath()
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const [x, y] = points[index]
    ctx.lineTo(x, y + thickness)
  }
  ctx.closePath()

  const gradient = ctx.createLinearGradient(0, yBase - thickness, width, yBase + thickness)
  gradient.addColorStop(0, rgba(colorA, 0))
  gradient.addColorStop(0.18, rgba(colorA, alpha * 0.82))
  gradient.addColorStop(0.5, rgba(vividRgb(mixRgb(colorA, colorB, 0.5)), alpha))
  gradient.addColorStop(0.82, rgba(colorB, alpha * 0.78))
  gradient.addColorStop(1, rgba(colorB, 0))
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawAuroraFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  target: AuroraTarget,
  live: { progress: number; velocity: number; phase: number },
  timeMs: number,
  reducedMotion: boolean
): void {
  const width = canvas.width
  const height = canvas.height
  if (width <= 0 || height <= 0) return

  const progressShift = (live.progress - 0.5) * width * 0.035
  const velocityLift = live.velocity * height * -0.018
  const basePhase = timeMs * target.speed * (reducedMotion ? 0.18 : 1) + live.phase * Math.PI * 2
  const opacity = target.opacity * (reducedMotion ? 0.78 : 1)
  const intensity = target.intensity
  const pulse = 1 + Math.sin(basePhase * 2.4) * target.pulse
  const energyScale = 1 + target.energy * 0.34
  const turbulenceScale = 1 + target.turbulence * 0.32

  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  const wash = ctx.createRadialGradient(
    width * 0.5,
    height * 0.22,
    0,
    width * 0.5,
    height * 0.2,
    height * 0.88
  )
  wash.addColorStop(0, rgba(target.colors[1], opacity * 1.05))
  wash.addColorStop(0.38, rgba(target.colors[2], opacity * 0.58))
  wash.addColorStop(0.72, rgba(target.colors[3], opacity * 0.22))
  wash.addColorStop(1, rgba(target.colors[0], 0))
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  ctx.globalCompositeOperation = 'lighter'
  drawRibbon(
    ctx,
    width,
    height * 0.08 + velocityLift,
    height * (0.035 + intensity * 0.014) * turbulenceScale,
    height * (0.18 + target.spread * 0.08) * pulse,
    basePhase,
    target.colors[0],
    target.colors[1],
    opacity * 1.22 * pulse,
    target.flow,
    target.turbulence
  )
  drawRibbon(
    ctx,
    width,
    height * 0.2 + progressShift * 0.08,
    height * (0.05 + intensity * 0.016) * energyScale,
    height * (0.2 + target.spread * 0.1),
    basePhase * 0.82 + 1.4,
    target.colors[1],
    target.colors[3],
    opacity * 1.08,
    target.flow * 0.9,
    target.turbulence * 0.82
  )
  drawRibbon(
    ctx,
    width,
    height * 0.34 - velocityLift * 0.45,
    height * (0.038 + intensity * 0.012) * energyScale,
    height * (0.17 + target.spread * 0.07),
    basePhase * 0.68 + 2.2,
    target.colors[2],
    target.colors[0],
    opacity * 0.92,
    target.flow * 0.74,
    target.turbulence * 0.68
  )
  drawRibbon(
    ctx,
    width,
    height * 0.48 + velocityLift * 0.22,
    height * (0.028 + intensity * 0.01) * energyScale,
    height * (0.13 + target.spread * 0.06),
    basePhase * 0.55 + 3.1,
    target.colors[3],
    target.colors[1],
    opacity * 0.72,
    target.flow * 0.66,
    target.turbulence * 0.55
  )
  if (target.energy > 0.64) {
    drawRibbon(
      ctx,
      width,
      height * 0.13 - velocityLift * 0.26,
      height * (0.018 + target.energy * 0.016),
      height * (0.055 + target.turbulence * 0.045),
      basePhase * 1.8 + 0.8,
      target.colors[3],
      target.colors[2],
      opacity * target.energy * 0.78,
      target.flow * 1.45,
      Math.min(1, target.turbulence * 1.2)
    )
  }

  ctx.globalCompositeOperation = 'source-over'
  const vignette = ctx.createLinearGradient(0, 0, 0, height)
  vignette.addColorStop(0, 'rgba(255,255,255,0.018)')
  vignette.addColorStop(0.46, 'rgba(255,255,255,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.055)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

export function FeelingAurora({
  classification,
  live
}: {
  classification: AmbientClassification | null
  live?: { progress: number; velocity: number; phase: number; pageNumber?: number }
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetRef = useRef<AuroraTarget | null>(null)
  const currentRef = useRef<AuroraTarget | null>(null)
  const liveRef = useRef({ progress: 0.5, velocity: 0, phase: 0 })
  const smoothLiveRef = useRef({ progress: 0.5, velocity: 0, phase: 0 })

  useEffect(() => {
    const nextTarget = makeAuroraTarget(classification)
    targetRef.current = nextTarget
    currentRef.current ??= cloneTarget(nextTarget)
  }, [classification])

  useEffect(() => {
    liveRef.current = {
      progress: live?.progress ?? 0.5,
      velocity: live?.velocity ?? 0,
      phase: live?.phase ?? 0
    }
  }, [live?.phase, live?.progress, live?.velocity])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) return undefined

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reduceQuery.matches
    let animationFrame = 0
    let previousTime = performance.now()

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 1.35)
      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
    }

    const animate = (time: number): void => {
      const delta = Math.min(64, time - previousTime)
      previousTime = time
      const paletteEase = easeForDelta(delta, 1800)
      const motionEase = easeForDelta(delta, 950)
      const target = targetRef.current ?? cloneTarget(NEUTRAL_TARGET)
      targetRef.current = target
      const current = currentRef.current ?? cloneTarget(target)
      currentRef.current = current
      const liveTarget = liveRef.current
      const smoothLive = smoothLiveRef.current

      current.colors = current.colors.map((color, index) =>
        mixRgb(color, target.colors[index], paletteEase)
      ) as [Rgb, Rgb, Rgb, Rgb]
      current.opacity = lerp(current.opacity, target.opacity, paletteEase)
      current.intensity = lerp(current.intensity, target.intensity, paletteEase)
      current.speed = lerp(current.speed, target.speed, motionEase)
      current.spread = lerp(current.spread, target.spread, motionEase)
      smoothLive.progress = lerp(smoothLive.progress, liveTarget.progress, motionEase)
      smoothLive.velocity = lerp(smoothLive.velocity, liveTarget.velocity, motionEase * 0.56)
      smoothLive.phase = lerp(smoothLive.phase, liveTarget.phase, motionEase)

      drawAuroraFrame(ctx, canvas, current, smoothLive, time, reducedMotion)
      animationFrame = window.requestAnimationFrame(animate)
    }

    const onReduceChange = (event: MediaQueryListEvent): void => {
      reducedMotion = event.matches
    }

    resize()
    window.addEventListener('resize', resize)
    reduceQuery.addEventListener('change', onReduceChange)
    animationFrame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      reduceQuery.removeEventListener('change', onReduceChange)
    }
  }, [])

  return (
    <div className="fz-ambient-shell" aria-hidden="true">
      <canvas ref={canvasRef} className="fz-ambient-canvas" />
    </div>
  )
}
