import type {
  HighlightExportTarget,
  HighlightRecord
} from '@shared/types/database'

function escapeCsv(value: string): string {
  const normalized = value.replace(/\r/g, ' ').replace(/\n/g, ' ')
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function groupBySource(highlights: HighlightRecord[]): Array<{ key: string; items: HighlightRecord[] }> {
  const order: string[] = []
  const map = new Map<string, HighlightRecord[]>()
  for (const highlight of highlights) {
    const key = `${highlight.sourceTitle}|||${highlight.sourceAuthor ?? ''}`
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(highlight)
  }
  return order.map((key) => ({ key, items: map.get(key)! }))
}

function sourceHeading(highlight: HighlightRecord): string {
  return highlight.sourceAuthor ? `${highlight.sourceTitle} — ${highlight.sourceAuthor}` : highlight.sourceTitle
}

function buildCsv(highlights: HighlightRecord[]): string {
  const header = [
    'Source',
    'Author',
    'Highlight',
    'Note',
    'Tags',
    'URL',
    'Location',
    'Favorite',
    'Highlighted At',
    'Source Kind',
    'Content Kind'
  ]
  const rows = highlights.map((highlight) =>
    [
      highlight.sourceTitle,
      highlight.sourceAuthor ?? '',
      highlight.text,
      highlight.note,
      highlight.tags.join(', '),
      highlight.sourceUrl ?? '',
      highlight.sourceLocation ?? '',
      highlight.isFavorite ? 'Yes' : 'No',
      highlight.highlightedAt,
      highlight.sourceLabel,
      highlight.contentKind
    ]
      .map(escapeCsv)
      .join(',')
  )
  return [header.join(','), ...rows].join('\n')
}

function buildMarkdown(highlights: HighlightRecord[], bulletPrefix = '-'): string {
  const lines: string[] = ['# Fuzzy Highlights Export']
  for (const group of groupBySource(highlights)) {
    const first = group.items[0]
    lines.push('', `## ${sourceHeading(first)}`)
    for (const highlight of group.items) {
      lines.push('', `${bulletPrefix} ${highlight.text}`)
      if (highlight.note.trim()) lines.push(`  ${bulletPrefix} Note: ${highlight.note.trim()}`)
      if (highlight.tags.length > 0) {
        lines.push(`  ${bulletPrefix} Tags: ${highlight.tags.map((tag) => `#${tag}`).join(' ')}`)
      }
      const meta = [
        highlight.sourceLabel,
        highlight.sourceLocation,
        highlight.sourceUrl
      ].filter(Boolean)
      if (meta.length > 0) lines.push(`  ${bulletPrefix} ${meta.join(' · ')}`)
    }
  }
  return lines.join('\n')
}

function buildRoam(highlights: HighlightRecord[]): string {
  const lines: string[] = ['- Fuzzy highlights']
  for (const group of groupBySource(highlights)) {
    const first = group.items[0]
    lines.push(`  - ${sourceHeading(first)}`)
    for (const highlight of group.items) {
      lines.push(`    - ${highlight.text}`)
      if (highlight.note.trim()) lines.push(`      - Note:: ${highlight.note.trim()}`)
      if (highlight.tags.length > 0) lines.push(`      - Tags:: ${highlight.tags.join(', ')}`)
      if (highlight.sourceLocation) lines.push(`      - Location:: ${highlight.sourceLocation}`)
      if (highlight.sourceUrl) lines.push(`      - URL:: ${highlight.sourceUrl}`)
    }
  }
  return lines.join('\n')
}

function buildEvernoteHtml(highlights: HighlightRecord[]): string {
  const blocks: string[] = ['<!doctype html>', '<meta charset="utf-8">', '<h1>Fuzzy Highlights Export</h1>']
  for (const group of groupBySource(highlights)) {
    const first = group.items[0]
    blocks.push(`<h2>${escapeHtml(sourceHeading(first))}</h2>`, '<ul>')
    for (const highlight of group.items) {
      blocks.push('<li>')
      blocks.push(`<p>${escapeHtml(highlight.text)}</p>`)
      if (highlight.note.trim()) blocks.push(`<p><strong>Note:</strong> ${escapeHtml(highlight.note.trim())}</p>`)
      if (highlight.tags.length > 0) {
        blocks.push(`<p><strong>Tags:</strong> ${escapeHtml(highlight.tags.join(', '))}</p>`)
      }
      const meta = [highlight.sourceLabel, highlight.sourceLocation, highlight.sourceUrl]
        .filter(Boolean)
        .map((part) => escapeHtml(part!))
        .join(' · ')
      if (meta) blocks.push(`<p>${meta}</p>`)
      blocks.push('</li>')
    }
    blocks.push('</ul>')
  }
  return blocks.join('\n')
}

export function exportHighlightsText(
  highlights: HighlightRecord[],
  target: HighlightExportTarget
): string {
  switch (target) {
    case 'notion':
    case 'csv':
      return buildCsv(highlights)
    case 'obsidian':
    case 'logseq':
    case 'markdown':
      return buildMarkdown(highlights)
    case 'roam':
      return buildRoam(highlights)
    case 'evernote':
      return buildEvernoteHtml(highlights)
    case 'json':
      return JSON.stringify(highlights, null, 2)
  }
}

export function exportExtensionForTarget(target: HighlightExportTarget): string {
  switch (target) {
    case 'notion':
    case 'csv':
      return 'csv'
    case 'evernote':
      return 'html'
    case 'json':
      return 'json'
    default:
      return 'md'
  }
}

export function exportLabelForTarget(target: HighlightExportTarget): string {
  switch (target) {
    case 'notion':
      return 'Notion CSV'
    case 'obsidian':
      return 'Obsidian Markdown'
    case 'evernote':
      return 'Evernote HTML'
    case 'roam':
      return 'Roam bullets'
    case 'logseq':
      return 'Logseq Markdown'
    case 'markdown':
      return 'Markdown'
    case 'csv':
      return 'CSV'
    case 'json':
      return 'JSON'
  }
}
