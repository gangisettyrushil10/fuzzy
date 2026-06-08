// Shared HTML helpers for the rich reflowable extractors (epub/docx/md/mobi).
//
// Two jobs, both run in the MAIN process at extraction time:
//   1. sanitizeReaderHtml — strip everything dangerous so the renderer can
//      dangerouslySetInnerHTML the stored column safely (the persisted column
//      is the trust boundary; the renderer never sees raw source HTML).
//   2. htmlToProjection — derive a readable plain-text projection from the SAME
//      sanitized HTML, so text_content (search index + reading-aid fallback)
//      and html_content stay in lockstep.

import sanitizeHtml from 'sanitize-html'

// Tag allow-list: the structural + inline elements a book actually uses. No
// class/style attributes survive — styling is owned by the .prose-fz stylesheet
// so every document inherits the chosen reading theme/typography.
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'q', 'cite',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'em', 'strong', 'i', 'b', 'u', 's', 'small', 'sub', 'sup', 'span',
  'a', 'img', 'figure', 'figcaption',
  'hr', 'br', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'section', 'article', 'div'
]

export function sanitizeReaderHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan']
    },
    // Links may point anywhere safe; images must already be inlined as data URIs
    // (the extractors do this) — no http(s) image fetches from the reader.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['data'] },
    // Drop the entire subtree for these (content too, not just the tag).
    nonTextTags: ['script', 'style', 'head', 'title', 'noscript', 'iframe', 'object', 'embed'],
    disallowedTagsMode: 'discard'
  }).trim()
}

const BLOCK_TAGS =
  'address|article|aside|blockquote|div|dl|dd|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul'

// Strip (already-sanitized) HTML to readable plain text, preserving paragraph
// breaks at block boundaries. Inline tags collapse to nothing (their text runs
// together as it reads). Used for the canonical text_content.
export function htmlToProjection(html: string): string {
  let text = html
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(new RegExp(`</(?:${BLOCK_TAGS})>`, 'gi'), '\n\n')
  text = text.replace(new RegExp(`<(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeEntities(text)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  text = text.replace(/[ \t\f\v]+/g, ' ')
  text = text.replace(/ *\n */g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'"
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    const lower = body.toLowerCase()
    if (lower[0] === '#') {
      const codePoint =
        lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
      if (Number.isFinite(codePoint) && codePoint > 0) {
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return whole
        }
      }
      return whole
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower) ? NAMED_ENTITIES[lower] : whole
  })
}

// One section's two representations: sanitized rich HTML + its plain projection.
export interface RichSection {
  html: string
  text: string
}

// Sanitize raw HTML and pair it with its projection. Returns null when the
// section has no readable text (drop empty chapters/front-matter).
export function toRichSection(rawHtml: string): RichSection | null {
  const html = sanitizeReaderHtml(rawHtml)
  const text = htmlToProjection(html)
  if (!text.trim()) return null
  return { html, text }
}

// Guess an image MIME type from a file path/extension for data-URI inlining.
export function guessImageMime(pathOrName: string): string | null {
  const ext = pathOrName.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'svg':
      return 'image/svg+xml'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    default:
      return null
  }
}
