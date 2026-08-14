export type SoundtrackQuerySource = 'embedding' | 'openai' | 'fallback'

export interface SoundtrackQueryPlan {
  lane: string
  query: string
  queries?: string[]
  source: SoundtrackQuerySource
}
