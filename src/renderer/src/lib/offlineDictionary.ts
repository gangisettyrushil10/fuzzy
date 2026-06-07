// A tiny built-in gloss map so a clicked word shows an instant definition
// while the (mocked) AI "define" reveals underneath — makes the popover feel
// alive offline. Intentionally small; the mock provider handles the long tail.

const GLOSS: Record<string, string> = {
  ubiquitous: 'present, appearing, or found everywhere.',
  ephemeral: 'lasting for a very short time.',
  paradigm: 'a typical example or pattern of something; a model.',
  juxtaposition: 'the fact of placing things close together for contrasting effect.',
  ostensibly: 'apparently or purportedly, but perhaps not actually.',
  pragmatic: 'dealing with things sensibly and realistically.',
  ameliorate: 'to make something bad or unsatisfactory better.',
  cacophony: 'a harsh, discordant mixture of sounds.',
  dichotomy: 'a division or contrast between two opposed things.',
  empirical: 'based on observation or experience rather than theory.',
  esoteric: 'intended for or understood by only a small group.',
  fastidious: 'very attentive to accuracy and detail.',
  gregarious: 'fond of company; sociable.',
  idiosyncratic: 'peculiar or individual to one person.',
  inexorable: 'impossible to stop or prevent.',
  magnanimous: 'generous or forgiving, especially toward a rival.',
  nuance: 'a subtle difference in meaning, expression, or sound.',
  obfuscate: 'to make something unclear or hard to understand.',
  paradoxical: 'seemingly self-contradictory but perhaps true.',
  quintessential: 'representing the most perfect example of a quality.',
  recalcitrant: 'stubbornly resistant to authority or control.',
  superfluous: 'unnecessary, especially through being more than enough.',
  tenacious: 'holding firmly to something; persistent.',
  ubiquity: 'the state of being everywhere at once.',
  vicarious: 'experienced through the feelings or actions of another.',
  zealous: 'showing great energy or enthusiasm for a cause.',
  anomaly: 'something that deviates from what is standard or expected.',
  benevolent: 'well meaning and kindly.',
  cognizant: 'having knowledge or awareness.',
  deleterious: 'causing harm or damage.',
  egregious: 'outstandingly bad; shocking.',
  facetious: 'treating serious issues with inappropriate humor.',
  hegemony: 'leadership or dominance, especially by one group.',
  immutable: 'unchanging over time; unable to be changed.',
  laconic: 'using very few words.',
  meticulous: 'showing great attention to detail; very careful.',
  pejorative: 'expressing contempt or disapproval.',
  surreptitious: 'kept secret because it would not be approved of.'
}

export function lookupGloss(word: string): string | null {
  return GLOSS[word.toLowerCase()] ?? null
}
