// Pure affect/tone lexicon (no electron/openai/db imports — unit-tested). Powers
// "Ctrl-F for tone": rank passages by how strongly their diction evokes a mood,
// entirely locally ($0 API). Not a sentiment model — a curated, literary-leaning
// word lexicon, good enough to surface candidate passages for close reading.

// Canonical tone → diction that tends to create it.
const TONE_LEXICON: Record<string, string[]> = {
  joyful: ['joy', 'delight', 'laughter', 'laughed', 'smile', 'smiled', 'bright', 'merry', 'glee', 'cheer', 'radiant', 'gleeful', 'happy', 'elated'],
  sad: ['sorrow', 'grief', 'tears', 'wept', 'weeping', 'mourned', 'mournful', 'cried', 'lonely', 'loss', 'aching', 'heartbroken', 'despair'],
  melancholic: ['melancholy', 'wistful', 'longing', 'faded', 'fading', 'autumn', 'dusk', 'shadow', 'silence', 'memory', 'remembered', 'distant', 'pale', 'gray', 'forlorn', 'yearning'],
  fearful: ['fear', 'afraid', 'terror', 'dread', 'trembling', 'trembled', 'horror', 'panic', 'shuddered', 'cold', 'darkness', 'whisper', 'creeping', 'lurking'],
  tense: ['suddenly', 'silence', 'gripped', 'frozen', 'breath', 'breathless', 'waiting', 'edge', 'sharp', 'tight', 'racing', 'pounding', 'sweat', 'still'],
  angry: ['anger', 'angry', 'rage', 'fury', 'furious', 'shouted', 'screamed', 'snarled', 'clenched', 'glared', 'seething', 'wrath', 'bitter'],
  hopeful: ['hope', 'hopeful', 'dawn', 'light', 'rise', 'rising', 'promise', 'bright', 'future', 'new', 'begin', 'beginning', 'renewed', 'faith'],
  nostalgic: ['remember', 'remembered', 'childhood', 'once', 'used', 'old', 'past', 'memory', 'memories', 'long', 'ago', 'younger', 'home', 'familiar'],
  peaceful: ['calm', 'quiet', 'still', 'gentle', 'soft', 'serene', 'peace', 'peaceful', 'warm', 'rest', 'slow', 'tranquil', 'easy', 'breeze'],
  romantic: ['love', 'beloved', 'tender', 'tenderly', 'embrace', 'kiss', 'longing', 'heart', 'gaze', 'beautiful', 'desire', 'caress', 'devotion', 'adore'],
  somber: ['grave', 'solemn', 'dark', 'heavy', 'silent', 'cold', 'stone', 'gray', 'bleak', 'bleak', 'ash', 'funeral', 'shadow', 'mourning'],
  triumphant: ['victory', 'triumph', 'won', 'glory', 'soared', 'rose', 'conquered', 'cheered', 'proud', 'rising', 'blazing', 'unstoppable']
}

// Free-text tone words → canonical tone.
const TONE_ALIASES: Record<string, string> = {
  happy: 'joyful', joyful: 'joyful', joy: 'joyful', cheerful: 'joyful', merry: 'joyful',
  sad: 'sad', sorrowful: 'sad', grief: 'sad', grieving: 'sad', depressing: 'sad',
  melancholy: 'melancholic', melancholic: 'melancholic', wistful: 'melancholic', pensive: 'melancholic',
  scary: 'fearful', fear: 'fearful', fearful: 'fearful', frightening: 'fearful', dread: 'fearful', ominous: 'fearful',
  tense: 'tense', suspense: 'tense', suspenseful: 'tense', anxious: 'tense', nervous: 'tense',
  angry: 'angry', anger: 'angry', furious: 'angry', rage: 'angry', wrathful: 'angry',
  hope: 'hopeful', hopeful: 'hopeful', optimistic: 'hopeful', uplifting: 'hopeful',
  nostalgic: 'nostalgic', nostalgia: 'nostalgic', reminiscent: 'nostalgic',
  peaceful: 'peaceful', calm: 'peaceful', serene: 'peaceful', tranquil: 'peaceful',
  romantic: 'romantic', loving: 'romantic', tender: 'romantic', amorous: 'romantic',
  somber: 'somber', solemn: 'somber', grave: 'somber', bleak: 'somber', gloomy: 'somber',
  triumphant: 'triumphant', victorious: 'triumphant', heroic: 'triumphant'
}

export function availableTones(): string[] {
  return Object.keys(TONE_LEXICON)
}

// Resolve a user's tone phrasing to a canonical tone + its diction set. Falls
// back to the cleaned query as the tone with no words (caller can still LLM it).
export function resolveTone(query: string): { tone: string; words: string[] } {
  const lower = query.toLowerCase()
  for (const [alias, canonical] of Object.entries(TONE_ALIASES)) {
    if (lower.includes(alias)) return { tone: canonical, words: TONE_LEXICON[canonical] }
  }
  // Direct canonical name match.
  for (const tone of Object.keys(TONE_LEXICON)) {
    if (lower.includes(tone)) return { tone, words: TONE_LEXICON[tone] }
  }
  return { tone: query.trim().toLowerCase() || 'unknown', words: [] }
}

// Score a passage's affinity to a tone by its diction. Returns a 0..1-ish score
// (density of matched tone words) and the distinct matched words for display.
export function scoreText(text: string, words: string[]): { score: number; matched: string[] } {
  if (words.length === 0) return { score: 0, matched: [] }
  const lower = text.toLowerCase()
  const matched: string[] = []
  let hits = 0
  for (const w of words) {
    const re = new RegExp(`\\b${w}`, 'g')
    const m = lower.match(re)
    if (m) {
      hits += m.length
      matched.push(w)
    }
  }
  if (hits === 0) return { score: 0, matched: [] }
  const wordCount = Math.max(1, lower.split(/\s+/).length)
  // Density per 100 words, softly capped to 0..1. Reward distinct matches too.
  const density = (hits / wordCount) * 100
  const distinct = matched.length
  const score = Math.min(1, density / 8 + distinct / 12)
  return { score, matched }
}
