import { describe, it, expect } from 'vitest'
import { detectGenre } from '../src/main/services/genre/genreDetector'
import type { ExtractedDocument } from '../src/shared/types/database'

function doc(text: string): ExtractedDocument {
  return { pageCount: 1, pages: [{ pageNumber: 1, textContent: text, estimatedWordCount: 100 }] }
}

describe('detectGenre', () => {
  it('classifies dialogue-heavy prose as fiction', () => {
    const text = `"Good morning," said Darcy. Elizabeth replied with a smile.
    "You are too kind," she whispered. He asked her to stay, and she said yes.
    The garden was quiet as they walked together along the lane.`
    expect(detectGenre(doc(text))).toBe('fiction')
  })

  it('classifies an academic paper', () => {
    const text = `Abstract. We present a methodology and report results in this study.
    Introduction. Prior work by Smith et al. (2019) and Jones (2020) is relevant to our hypothesis.
    Methods. We describe the experimental methodology and data collection procedures in detail here.
    Results. The results indicate a significant effect across all measured conditions in the study.
    Discussion. Conclusion. References. Bibliography. See the appendix for additional figures.`
    expect(detectGenre(doc(text))).toBe('paper')
  })

  it('classifies a transcript with timestamps and speaker turns', () => {
    const text = `00:01 ALICE: Let's begin the meeting today and walk through the agenda items together.
00:14 BOB: Sure, I think we should discuss the roadmap and the timeline before anything else.
00:32 ALICE: Agreed. Here is the first item on the agenda that I wanted us to cover today.
01:05 BOB: That sounds reasonable to me overall, and I have a few thoughts to add on it.
01:30 ALICE: Great, let's hear them and then move on to the next point on our list.`
    expect(detectGenre(doc(text))).toBe('transcript')
  })

  it('returns null for too-short input', () => {
    expect(detectGenre(doc('Hi.'))).toBeNull()
  })
})
