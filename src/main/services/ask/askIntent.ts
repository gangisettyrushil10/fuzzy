// Pure, dependency-free intent detection for the Ask box, so "summarize this
// chapter" is handled by reading the chapter's text rather than semantic Q&A
// retrieval (which returns scattered chunks and can't actually summarize).
// Unit-tested in the node env.

export interface AskIntent {
  mode: 'qa' | 'summary'
  // Explicit 1-based chapter/page the user named ("summarize chapter 12");
  // null means "the current one" — the caller substitutes the reader's page.
  page: number | null
}

// Verbs/phrases that mean "give me a summary", not "answer a question".
const SUMMARY_RE =
  /\b(summar(?:y|ise|ize|ised|ized|ising|izing)|recap|tl;?dr|gist|synops(?:is|es)|overview|sum\s+up|key\s+points|main\s+points|key\s+takeaways|what\s+happens|what\s+happened|catch\s+me\s+up)\b/i

// "chapter 12", "ch 3", "page 45", "pg. 7", "section 2".
const PAGE_RE = /\b(?:chapter|chap|ch|section|sec|page|pg)\.?\s*(\d{1,4})\b/i

export function detectAskIntent(question: string): AskIntent {
  const q = question.trim()
  if (!SUMMARY_RE.test(q)) return { mode: 'qa', page: null }
  const m = PAGE_RE.exec(q)
  const page = m ? Number.parseInt(m[1], 10) : null
  return { mode: 'summary', page: Number.isFinite(page as number) ? page : null }
}

// Crude extractive summary for the no-API-key (mock) path: lead sentences plus a
// closing one, so a summary request still returns something coherent offline.
export function extractiveSummary(text: string, maxSentences = 4): string {
  const sentences = (text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?:["')\]]+)?/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (sentences.length === 0) return text.slice(0, 400).trim()
  if (sentences.length <= maxSentences) return sentences.join(' ')
  const lead = sentences.slice(0, maxSentences - 1)
  return [...lead, sentences[sentences.length - 1]].join(' ')
}
