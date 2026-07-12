import { useEffect, useRef } from 'react'
import type { AmbientClassification } from '@shared/types/api'
import { getAmbientOpacity } from './ambientStyle'
import { getMoodlightPalette, mixRgb, rgba, vividRgb, type MoodlightRgb } from './moodlightColor'
import { resolveMoodlightMotionProfile } from './moodlightMotion'

type Rgb = MoodlightRgb

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

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

function easeForDelta(deltaMs: number, durationMs: number): number {
  return 1 - Math.exp(-Math.max(0, deltaMs) / durationMs)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
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

function makeAuroraTarget(classification: AmbientClassification | null): AuroraTarget {
  if (!classification) return cloneTarget(NEUTRAL_TARGET)

  const palette = getMoodlightPalette(classification)
  const motion = resolveMoodlightMotionProfile(classification)

  return {
    colors: palette.colors,
    opacity: Math.min(
      0.68,
      Math.max(0.3, getAmbientOpacity(classification) * 1.72 + palette.intensity * 0.14)
    ),
    intensity: palette.intensity,
    speed: motion.speed,
    spread: motion.spread,
    energy: motion.energy,
    turbulence: motion.turbulence,
    pulse: motion.pulse,
    flow: motion.flow
  }
}

function traceSmoothPoints(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  moveToStart: boolean
): void {
  if (points.length === 0) return
  const [firstX, firstY] = points[0]
  if (moveToStart) ctx.moveTo(firstX, firstY)
  else ctx.lineTo(firstX, firstY)

  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index]
    const [nextX, nextY] = points[index + 1]
    ctx.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2)
  }

  const [lastX, lastY] = points[points.length - 1]
  ctx.lineTo(lastX, lastY)
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
  const step = Math.max(22, width / 44)
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
  const lowerPoints = points
    .map(
      ([x, y], index) =>
        [x, y + thickness * (0.86 + Math.sin(index * 0.72 + phase) * 0.035)] as [number, number]
    )
    .reverse()

  ctx.beginPath()
  traceSmoothPoints(ctx, points, true)
  traceSmoothPoints(ctx, lowerPoints, false)
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

function drawSoftCurtain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  target: AuroraTarget,
  alpha: number
): void {
  const folds = 7
  const top = height * 0.03
  const bottom = height * (0.48 + target.spread * 0.1)
  const gradient = ctx.createLinearGradient(0, top, 0, bottom)
  gradient.addColorStop(0, rgba(target.colors[0], 0))
  gradient.addColorStop(0.24, rgba(target.colors[1], alpha * 0.34))
  gradient.addColorStop(0.58, rgba(target.colors[2], alpha * 0.2))
  gradient.addColorStop(1, rgba(target.colors[3], 0))

  ctx.beginPath()
  ctx.moveTo(-width * 0.04, top)
  for (let i = 0; i <= folds; i += 1) {
    const x = (width / folds) * i
    const nextX = (width / folds) * (i + 0.5)
    const wave = Math.sin(i * 1.13 + phase * 0.7) * width * 0.026
    ctx.quadraticCurveTo(x + wave, top + height * 0.06, nextX, top + height * 0.02)
  }
  ctx.lineTo(width * 1.04, bottom)
  for (let i = folds; i >= 0; i -= 1) {
    const x = (width / folds) * i
    const wave = Math.sin(i * 1.04 + phase * 0.53) * width * 0.038
    ctx.quadraticCurveTo(x - wave, bottom - height * 0.08, x, bottom)
  }
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawEnergyStreaks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  target: AuroraTarget,
  alpha: number
): void {
  const count = Math.round(2 + target.energy * 5)
  ctx.lineCap = 'round'
  ctx.globalAlpha = clamp01(alpha)
  for (let index = 0; index < count; index += 1) {
    const seed = index * 1.73
    const x =
      ((((phase * 92 * target.flow + seed * 137) % (width * 1.24)) + width * 1.24) %
        (width * 1.24)) -
      width * 0.12
    const y = height * (0.08 + ((index * 0.137 + target.energy * 0.05) % 0.34))
    const length = width * (0.06 + target.energy * 0.055)
    const color = target.colors[index % target.colors.length]
    const gradient = ctx.createLinearGradient(x - length, y, x + length, y)
    gradient.addColorStop(0, rgba(color, 0))
    gradient.addColorStop(0.5, rgba(vividRgb(color), alpha * 0.72))
    gradient.addColorStop(1, rgba(color, 0))
    ctx.strokeStyle = gradient
    ctx.lineWidth = height * (0.0025 + target.turbulence * 0.002)
    ctx.beginPath()
    ctx.moveTo(x - length, y + Math.sin(phase + seed) * height * 0.008)
    ctx.lineTo(x + length, y + Math.cos(phase * 0.7 + seed) * height * 0.012)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
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
  drawSoftCurtain(ctx, width, height, basePhase, target, opacity * 0.9)
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
    drawEnergyStreaks(ctx, width, height, basePhase, target, opacity * target.energy * 0.52)
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
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
    }

    const animate = (time: number): void => {
      const delta = Math.min(64, time - previousTime)
      previousTime = time
      const paletteEase = easeForDelta(delta, 2600)
      const motionEase = easeForDelta(delta, 1700)
      const liveEase = easeForDelta(delta, 1200)
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
      current.energy = lerp(current.energy, target.energy, motionEase)
      current.turbulence = lerp(current.turbulence, target.turbulence, motionEase)
      current.pulse = lerp(current.pulse, target.pulse, motionEase)
      current.flow = lerp(current.flow, target.flow, motionEase)
      smoothLive.progress = lerp(smoothLive.progress, liveTarget.progress, liveEase)
      smoothLive.velocity = lerp(smoothLive.velocity, liveTarget.velocity, liveEase * 0.5)
      smoothLive.phase = lerp(smoothLive.phase, liveTarget.phase, liveEase)

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
