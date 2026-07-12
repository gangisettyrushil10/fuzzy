import { useEffect, useRef, useState } from 'react'
import type { AmbientClassification } from '@shared/types/api'
import { getAmbientStyle } from './ambientStyle'

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

interface LayerSnapshot {
  classification: AmbientClassification | null
  signature: string
}

function classificationSignature(classification: AmbientClassification | null): string {
  if (!classification) return 'neutral'
  return [
    classification.mood,
    classification.secondaryMood ?? 'none',
    classification.motion,
    classification.sceneTags.slice(0, 2).join(','),
    classification.paletteHints.slice(0, 3).join(',')
  ].join(':')
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
  const x = (progress - 0.5) * depth * 7 + (phase - 0.5) * depth * 2.5
  const y = velocity * depth * -6
  const rotate = velocity * depth * -0.45
  const scale = 1 + Math.abs(velocity) * depth * 0.014

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
  const signature = classificationSignature(classification)
  const lastLayerRef = useRef<LayerSnapshot | null>(null)
  const [previousLayer, setPreviousLayer] = useState<LayerSnapshot | null>(null)

  useEffect(() => {
    const nextLayer = { classification, signature }
    const lastLayer = lastLayerRef.current

    if (lastLayer && lastLayer.signature !== signature) {
      setPreviousLayer(lastLayer)
      const clearTimer = window.setTimeout(() => setPreviousLayer(null), 680)
      lastLayerRef.current = nextLayer
      return () => window.clearTimeout(clearTimer)
    }

    lastLayerRef.current = nextLayer
    return undefined
  }, [classification, signature])

  return (
    <div className="fz-ambient-shell" style={withLive({}, live)} aria-hidden="true">
      {previousLayer && (
        <AmbientLayer
          key={`previous:${previousLayer.signature}`}
          classification={previousLayer.classification}
          live={live}
          layerClassName="fz-ambient-layer-exit"
          showBurst={false}
        />
      )}
      <AmbientLayer
        key={`current:${signature}`}
        classification={classification}
        live={live}
        layerClassName="fz-ambient-layer-enter"
        showBurst
      />
    </div>
  )
}

function AmbientLayer({
  classification,
  live,
  layerClassName,
  showBurst
}: {
  classification: AmbientClassification | null
  live?: { progress: number; velocity: number; phase: number; pageNumber?: number }
  layerClassName: string
  showBurst: boolean
}): React.JSX.Element {
  const pageKey = `${live?.pageNumber ?? 0}:${classification?.mood ?? 'neutral'}:${classification?.sceneTags[0] ?? 'none'}`
  const burstKind = getBurstKind(classification)
  const family = getFamily(classification)

  return (
    <div
      className={`fz-ambient-layer ${layerClassName} fz-ambient-family-${family}`}
      style={withLive(getAmbientStyle(classification), live)}
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
      {showBurst && burstKind && (
        <div
          className={`fz-ambient-burst fz-ambient-burst-${burstKind}`}
          key={`burst:${pageKey}`}
        />
      )}
      <div className="fz-ambient-vignette" />
    </div>
  )
}
