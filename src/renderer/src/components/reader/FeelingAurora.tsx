import { useEffect, useRef } from 'react'
import type { AmbientClassification } from '@shared/types/api'
import { getAmbientOpacity } from './ambientStyle'
import { getMoodlightPalette, mixRgb, rgba, vividRgb, type MoodlightRgb } from './moodlightColor'
import { resolveMoodlightMotionEnvelope, resolveMoodlightMotionProfile } from './moodlightMotion'
import type { MoodlightPreferences } from '../../state/ambientStore'

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
  streakDensity: number
  burstFrequency: number
  burstRadius: number
  burstStrength: number
}

interface MoodlightImpulse {
  startedAt: number
  strength: number
  radius: number
  colorIndex: number
  durationMs: number
}

const NEUTRAL_TARGET: AuroraTarget = {
  colors: [
    [93, 111, 205],
    [73, 181, 198],
    [154, 101, 195],
    [203, 176, 92]
  ],
  opacity: 0.2,
  intensity: 0.38,
  speed: 0.000055,
  spread: 0.42,
  energy: 0.3,
  turbulence: 0.13,
  pulse: 0.06,
  flow: 1,
  streakDensity: 0,
  burstFrequency: 0,
  burstRadius: 0.4,
  burstStrength: 0
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
    flow: target.flow,
    streakDensity: target.streakDensity,
    burstFrequency: target.burstFrequency,
    burstRadius: target.burstRadius,
    burstStrength: target.burstStrength
  }
}

function makeAuroraTarget(classification: AmbientClassification | null): AuroraTarget {
  if (!classification) return cloneTarget(NEUTRAL_TARGET)

  const palette = getMoodlightPalette(classification)
  const motion = resolveMoodlightMotionProfile(classification)

  return {
    colors: palette.colors,
    opacity: Math.min(
      0.46,
      Math.max(
        0.16,
        (getAmbientOpacity(classification) * 0.68 + palette.intensity * 0.05) * palette.presence
      )
    ),
    intensity: palette.intensity,
    speed: motion.speed,
    spread: motion.spread,
    energy: motion.energy,
    turbulence: motion.turbulence,
    pulse: motion.pulse,
    flow: motion.flow,
    streakDensity: motion.streaks?.density ?? 0,
    burstFrequency: motion.bursts?.frequency ?? 0,
    burstRadius: motion.bursts?.radius ?? 0.4,
    burstStrength: motion.bursts?.strength ?? 0
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
  const step = Math.max(28, width / 36)
  const points: Array<[number, number]> = []

  for (let x = -step; x <= width + step; x += step) {
    const xRatio = x / Math.max(1, width)
    const primaryFrequency = 0.72 + flow * 0.3
    const y =
      yBase +
      Math.sin(xRatio * Math.PI * 2 * primaryFrequency + phase) * amplitude +
      Math.sin(xRatio * Math.PI * 2 * (primaryFrequency * 1.86) + phase * 0.46) *
        amplitude *
        (0.14 + turbulence * 0.22) +
      Math.sin(xRatio * Math.PI * 2 * 3.7 + phase * 0.68) * amplitude * turbulence * 0.065
    points.push([x, y])
  }
  const lowerPoints = points
    .map(
      ([x, y]) =>
        [
          x,
          y +
            thickness *
              (0.9 + Math.sin((x / Math.max(1, width)) * Math.PI * 1.6 + phase * 0.3) * 0.05)
        ] as [number, number]
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
  const folds = 5
  const top = -height * 0.04
  const bottom = height * (0.9 + target.spread * 0.12)
  const gradient = ctx.createLinearGradient(0, top, 0, bottom)
  gradient.addColorStop(0, rgba(target.colors[0], 0))
  gradient.addColorStop(0.22, rgba(target.colors[1], alpha * 0.26))
  gradient.addColorStop(0.56, rgba(target.colors[2], alpha * 0.18))
  gradient.addColorStop(0.82, rgba(target.colors[0], alpha * 0.1))
  gradient.addColorStop(1, rgba(target.colors[3], 0))

  ctx.beginPath()
  ctx.moveTo(-width * 0.04, top)
  for (let i = 0; i <= folds; i += 1) {
    const x = (width / folds) * i
    const nextX = (width / folds) * (i + 0.5)
    const wave = Math.sin(i * 1.02 + phase * 0.36) * width * 0.035
    ctx.quadraticCurveTo(x + wave, top + height * 0.1, nextX, top + height * 0.025)
  }
  ctx.lineTo(width * 1.04, bottom)
  for (let i = folds; i >= 0; i -= 1) {
    const x = (width / folds) * i
    const wave = Math.sin(i * 0.94 + phase * 0.28) * width * 0.05
    ctx.quadraticCurveTo(x - wave, bottom - height * 0.13, x, bottom)
  }
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawDepthVeil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  target: AuroraTarget,
  alpha: number
): void {
  const gradient = ctx.createLinearGradient(0, height * 0.34, width, height * 0.92)
  gradient.addColorStop(0, rgba(target.colors[2], 0))
  gradient.addColorStop(0.32, rgba(target.colors[2], alpha * 0.44))
  gradient.addColorStop(0.7, rgba(target.colors[0], alpha * 0.3))
  gradient.addColorStop(1, rgba(target.colors[1], 0))

  ctx.beginPath()
  ctx.moveTo(-width * 0.08, height * 0.72)
  for (let index = 0; index <= 8; index += 1) {
    const x = (width / 8) * index
    const y =
      height * 0.7 +
      Math.sin(index * 0.82 + phase * 0.24) * height * 0.09 +
      Math.sin(index * 0.37 - phase * 0.13) * height * 0.035
    ctx.lineTo(x, y)
  }
  ctx.lineTo(width * 1.08, height * 1.08)
  ctx.lineTo(-width * 0.08, height * 1.08)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawImpulseBloom(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  target: AuroraTarget,
  impulse: MoodlightImpulse | null,
  timeMs: number,
  progress: number,
  alpha: number
): void {
  if (!impulse) return
  const elapsed = timeMs - impulse.startedAt
  const life = clamp01(elapsed / impulse.durationMs)
  if (life >= 1) return

  const rise = Math.sin(Math.PI * life)
  const envelope = rise * rise * (1 - life * 0.24)
  const radius = Math.max(width, height) * (0.18 + impulse.radius * 0.28 + life * 0.16)
  const x = width * (0.24 + progress * 0.52)
  const y = height * (0.34 + Math.sin(impulse.colorIndex * 1.8) * 0.12)
  const color = target.colors[impulse.colorIndex % target.colors.length]
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
  glow.addColorStop(0, rgba(vividRgb(color), alpha * impulse.strength * envelope * 0.48))
  glow.addColorStop(0.34, rgba(color, alpha * impulse.strength * envelope * 0.24))
  glow.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalAlpha = alpha * impulse.strength * envelope * 0.22
  ctx.strokeStyle = rgba(vividRgb(color), 0.7)
  ctx.lineWidth = Math.max(1, height * 0.002)
  ctx.beginPath()
  ctx.ellipse(x, y, radius * 0.72, radius * 0.22, -0.12, Math.PI * 0.12, Math.PI * 1.72)
  ctx.stroke()
  ctx.restore()
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
      ((((phase * 46 * target.flow + seed * 137) % (width * 1.24)) + width * 1.24) %
        (width * 1.24)) -
      width * 0.12
    const y = height * (0.08 + ((index * 0.173 + target.energy * 0.05) % 0.78))
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
  motionPhase: number,
  reducedMotion: boolean,
  preferences: MoodlightPreferences,
  impulse: MoodlightImpulse | null,
  readingActivity: number
): void {
  const width = canvas.width
  const height = canvas.height
  if (width <= 0 || height <= 0) return

  const progressShift = (live.progress - 0.5) * width * 0.035
  const velocityLift = live.velocity * height * -0.018
  const basePhase = motionPhase + live.phase * Math.PI * 0.55
  const intensityPreference = 0.56 + preferences.intensity * 0.68
  const motionPreference = reducedMotion ? 0.18 : 0.48 + preferences.motion * 0.7
  const opacity = target.opacity * intensityPreference * (reducedMotion ? 0.78 : 1)
  const intensity = target.intensity
  const envelope = resolveMoodlightMotionEnvelope(timeMs, target, reducedMotion)
  const amplitudeScale = 1 + (envelope.amplitudeScale - 1) * motionPreference
  const counterAmplitudeScale = 1 + (envelope.counterAmplitudeScale - 1) * motionPreference
  const thicknessScale = 1 + (envelope.thicknessScale - 1) * motionPreference
  const flowScale = 1 + (envelope.flowScale - 1) * motionPreference
  const verticalDrift = height * envelope.verticalOffset
  const pulseWave = Math.sin(basePhase * 2.4)
  const shapePulse = 1 + pulseWave * target.pulse * 0.55
  const luminancePulse = 1 + pulseWave * target.pulse * 0.2
  const energyScale = 1 + target.energy * 0.34
  const turbulenceScale = 1 + target.turbulence * 0.32

  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  const wash = ctx.createRadialGradient(
    width * 0.5,
    height * 0.44,
    0,
    width * 0.5,
    height * 0.46,
    height * 1.08
  )
  wash.addColorStop(0, rgba(target.colors[1], opacity * 0.7))
  wash.addColorStop(0.38, rgba(target.colors[2], opacity * 0.35))
  wash.addColorStop(0.72, rgba(target.colors[3], opacity * 0.12))
  wash.addColorStop(1, rgba(target.colors[0], 0))
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  ctx.globalCompositeOperation = 'screen'
  drawSoftCurtain(ctx, width, height, basePhase, target, opacity * 0.48)
  drawRibbon(
    ctx,
    width,
    -height * 0.04 + velocityLift * 0.4 + verticalDrift,
    height * (0.068 + intensity * 0.018) * turbulenceScale * amplitudeScale,
    height * (0.27 + target.spread * 0.09) * shapePulse * thicknessScale,
    basePhase,
    target.colors[0],
    target.colors[1],
    opacity * 0.58 * luminancePulse,
    target.flow * 0.92 * flowScale * (0.94 + motionPreference * 0.06),
    target.turbulence * 0.72
  )
  drawRibbon(
    ctx,
    width,
    height * 0.19 + progressShift * 0.04 - verticalDrift * 0.58,
    height * (0.082 + intensity * 0.022) * energyScale * counterAmplitudeScale,
    height * (0.3 + target.spread * 0.1) * (1 - (thicknessScale - 1) * 0.72),
    basePhase * 0.82 + 1.4,
    target.colors[1],
    target.colors[3],
    opacity * 0.62,
    (target.flow * 0.84) / flowScale,
    target.turbulence * 0.68
  )
  drawRibbon(
    ctx,
    width,
    height * 0.43 - velocityLift * 0.28 + verticalDrift * 0.34,
    height * (0.075 + intensity * 0.02) * energyScale * amplitudeScale,
    height * (0.28 + target.spread * 0.09) * thicknessScale,
    basePhase * 0.68 + 2.2,
    target.colors[2],
    target.colors[0],
    opacity * 0.54,
    target.flow * 0.76 * flowScale,
    target.turbulence * 0.58
  )
  drawRibbon(
    ctx,
    width,
    height * 0.66 + velocityLift * 0.14 - verticalDrift * 0.46,
    height * (0.064 + intensity * 0.018) * energyScale * counterAmplitudeScale,
    height * (0.25 + target.spread * 0.08) * (1 - (thicknessScale - 1) * 0.56),
    basePhase * 0.56 + 3.1,
    target.colors[3],
    target.colors[1],
    opacity * 0.46,
    (target.flow * 0.7) / flowScale,
    target.turbulence * 0.5
  )
  drawRibbon(
    ctx,
    width,
    height * 0.86 - velocityLift * 0.08 + verticalDrift * 0.24,
    height * (0.05 + intensity * 0.014) * energyScale * amplitudeScale,
    height * (0.2 + target.spread * 0.07) * thicknessScale,
    basePhase * 0.46 + 4.1,
    target.colors[0],
    target.colors[2],
    opacity * 0.34,
    target.flow * 0.64 * flowScale,
    target.turbulence * 0.42
  )
  drawDepthVeil(
    ctx,
    width,
    height,
    basePhase + readingActivity * 0.8,
    target,
    opacity * (0.2 + target.spread * 0.12)
  )
  drawImpulseBloom(ctx, width, height, target, impulse, timeMs, live.progress, opacity)

  if (target.energy > 0.58 && target.streakDensity > 0.2) {
    drawRibbon(
      ctx,
      width,
      height * 0.38 - velocityLift * 0.18,
      height * (0.018 + target.energy * 0.016),
      height * (0.055 + target.turbulence * 0.045),
      basePhase * 1.06 + 0.8,
      target.colors[3],
      target.colors[2],
      opacity * target.energy * 0.5,
      target.flow * 1.12,
      Math.min(1, target.turbulence * 1.2)
    )
    drawEnergyStreaks(
      ctx,
      width,
      height,
      basePhase,
      target,
      opacity * target.energy * target.streakDensity * 0.32
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
  live,
  preferences
}: {
  classification: AmbientClassification | null
  live?: { progress: number; velocity: number; phase: number; pageNumber?: number }
  preferences: MoodlightPreferences
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetRef = useRef<AuroraTarget | null>(null)
  const currentRef = useRef<AuroraTarget | null>(null)
  const liveRef = useRef({ progress: 0.5, velocity: 0, phase: 0 })
  const smoothLiveRef = useRef({ progress: 0.5, velocity: 0, phase: 0 })
  const motionPhaseRef = useRef(0)
  const readingActivityRef = useRef(0)
  const preferencesRef = useRef(preferences)
  const impulseRef = useRef<MoodlightImpulse | null>(null)
  const classificationSignatureRef = useRef<string | null>(null)
  const pageNumberRef = useRef<number | null>(null)

  useEffect(() => {
    const nextTarget = makeAuroraTarget(classification)
    const previousTarget = targetRef.current
    if (previousTarget) {
      nextTarget.colors = nextTarget.colors.map((color, index) =>
        mixRgb(color, previousTarget.colors[index], 0.1)
      ) as [Rgb, Rgb, Rgb, Rgb]
    }
    targetRef.current = nextTarget
    currentRef.current ??= cloneTarget(nextTarget)

    const signature = classification
      ? `${classification.mood}:${classification.sceneTags[0] ?? 'none'}:${classification.motion}`
      : null
    const previousSignature = classificationSignatureRef.current
    if (signature && previousSignature && signature !== previousSignature) {
      impulseRef.current = {
        startedAt: performance.now(),
        strength: Math.max(0.34, nextTarget.burstStrength * 0.72),
        radius: nextTarget.burstRadius,
        colorIndex: Math.abs(signature.length + classification!.sceneTags.length) % 4,
        durationMs: 6200 - nextTarget.burstFrequency * 1100
      }
    }
    classificationSignatureRef.current = signature
  }, [classification])

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    const pageNumber = live?.pageNumber
    if (pageNumber === undefined) return
    const previousPage = pageNumberRef.current
    pageNumberRef.current = pageNumber
    if (previousPage === null || previousPage === pageNumber) return

    const target = targetRef.current ?? NEUTRAL_TARGET
    impulseRef.current = {
      startedAt: performance.now(),
      strength: 0.3 + target.energy * 0.18,
      radius: Math.max(0.42, target.burstRadius),
      colorIndex: Math.abs(pageNumber) % 4,
      durationMs: 7200
    }
  }, [live?.pageNumber])

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
      current.streakDensity = lerp(current.streakDensity, target.streakDensity, motionEase)
      current.burstFrequency = lerp(current.burstFrequency, target.burstFrequency, motionEase)
      current.burstRadius = lerp(current.burstRadius, target.burstRadius, motionEase)
      current.burstStrength = lerp(current.burstStrength, target.burstStrength, motionEase)
      smoothLive.progress = lerp(smoothLive.progress, liveTarget.progress, liveEase)
      smoothLive.velocity = lerp(smoothLive.velocity, liveTarget.velocity, liveEase * 0.5)
      smoothLive.phase = lerp(smoothLive.phase, liveTarget.phase, liveEase)

      const envelope = resolveMoodlightMotionEnvelope(time, current, reducedMotion)
      const activityTarget = clamp01(Math.abs(smoothLive.velocity) * 18)
      const activityEase = easeForDelta(
        delta,
        activityTarget > readingActivityRef.current ? 520 : 4200
      )
      readingActivityRef.current = lerp(readingActivityRef.current, activityTarget, activityEase)
      const preference = preferencesRef.current
      const scrollLift = readingActivityRef.current * 0.08
      const motionPreference = 0.6 + preference.motion * 0.65
      motionPhaseRef.current +=
        delta *
        current.speed *
        envelope.speedScale *
        motionPreference *
        (1 + scrollLift) *
        (reducedMotion ? 0.18 : 1)
      if (motionPhaseRef.current > Math.PI * 2000) {
        motionPhaseRef.current %= Math.PI * 2
      }

      drawAuroraFrame(
        ctx,
        canvas,
        current,
        smoothLive,
        time,
        motionPhaseRef.current,
        reducedMotion,
        preference,
        impulseRef.current,
        readingActivityRef.current
      )
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
