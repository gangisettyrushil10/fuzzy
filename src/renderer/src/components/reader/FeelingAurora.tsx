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
  spread: 0.42
}

interface Hsl {
  h: number
  s: number
  l: number
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
    spread: target.spread
  }
}

function makeAuroraTarget(classification: AmbientClassification | null): AuroraTarget {
  if (!classification) return cloneTarget(NEUTRAL_TARGET)

  const [c1, c2, c3] = getAmbientPalette(classification).map((color) =>
    vividRgb(hexToRgb(color))
  ) as [Rgb, Rgb, Rgb]
  const spectrumAccent = vividRgb(rotateHue(c1, 128 + classification.intensity * 72))
  const c4 = mixRgb(spectrumAccent, vividRgb(rotateHue(c2, -96)), 0.38)
  const motionSpeed =
    classification.motion === 'wave'
      ? 0.000064
      : classification.motion === 'shimmer'
        ? 0.00006
        : classification.motion === 'mist'
          ? 0.000042
          : classification.motion === 'still'
            ? 0.000032
            : 0.000052

  return {
    colors: [c1, c2, c3, c4],
    opacity: Math.min(
      0.58,
      Math.max(0.24, getAmbientOpacity(classification) * 1.55 + classification.intensity * 0.1)
    ),
    intensity: Math.min(1, Math.max(0, classification.intensity)),
    speed: motionSpeed,
    spread: classification.motion === 'mist' || classification.motion === 'still' ? 0.34 : 0.44
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
  alpha: number
): void {
  const step = Math.max(34, width / 24)
  const points: Array<[number, number]> = []

  for (let x = -step; x <= width + step; x += step) {
    const xRatio = x / Math.max(1, width)
    const y =
      yBase +
      Math.sin(xRatio * Math.PI * 2.1 + phase) * amplitude +
      Math.sin(xRatio * Math.PI * 4.3 + phase * 0.58) * amplitude * 0.36
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
    height * (0.035 + intensity * 0.014),
    height * (0.18 + target.spread * 0.08),
    basePhase,
    target.colors[0],
    target.colors[1],
    opacity * 1.22
  )
  drawRibbon(
    ctx,
    width,
    height * 0.2 + progressShift * 0.08,
    height * (0.05 + intensity * 0.016),
    height * (0.2 + target.spread * 0.1),
    basePhase * 0.82 + 1.4,
    target.colors[1],
    target.colors[3],
    opacity * 1.08
  )
  drawRibbon(
    ctx,
    width,
    height * 0.34 - velocityLift * 0.45,
    height * (0.038 + intensity * 0.012),
    height * (0.17 + target.spread * 0.07),
    basePhase * 0.68 + 2.2,
    target.colors[2],
    target.colors[0],
    opacity * 0.92
  )
  drawRibbon(
    ctx,
    width,
    height * 0.48 + velocityLift * 0.22,
    height * (0.028 + intensity * 0.01),
    height * (0.13 + target.spread * 0.06),
    basePhase * 0.55 + 3.1,
    target.colors[3],
    target.colors[1],
    opacity * 0.72
  )

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
