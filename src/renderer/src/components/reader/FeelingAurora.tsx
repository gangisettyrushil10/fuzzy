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
    [109, 140, 255],
    [75, 214, 240],
    [185, 199, 255],
    [112, 170, 255]
  ],
  opacity: 0.1,
  intensity: 0.38,
  speed: 0.000055,
  spread: 0.42
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

  const [c1, c2, c3] = getAmbientPalette(classification).map(hexToRgb) as [Rgb, Rgb, Rgb]
  const c4 = mixRgb(c2, c3, 0.42)
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
    opacity: Math.min(0.24, Math.max(0.075, getAmbientOpacity(classification) * 0.72)),
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
  gradient.addColorStop(0.22, rgba(colorA, alpha * 0.62))
  gradient.addColorStop(0.5, rgba(mixRgb(colorA, colorB, 0.5), alpha))
  gradient.addColorStop(0.78, rgba(colorB, alpha * 0.58))
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
  const opacity = target.opacity * (reducedMotion ? 0.75 : 1)
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
  wash.addColorStop(0, rgba(target.colors[1], opacity * 0.7))
  wash.addColorStop(0.42, rgba(target.colors[2], opacity * 0.28))
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
    opacity * 0.95
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
    opacity * 0.84
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
    opacity * 0.62
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
