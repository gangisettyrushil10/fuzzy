// Renders a Project to a paste-ready document — quotes grouped by source with
// citations, free-form notes, saved syntheses, and a deduped bibliography.
// Pure functions so they unit-test without a DB.

import type {
  CitationFormat,
  ExportFormat,
  ProjectDetail,
  ProjectEvidenceRecord
} from '@shared/types/database'

// Strip a trailing page locator so a work appears once in the bibliography.
function stripPage(citation: string): string {
  return citation
    .replace(/,?\s*p\.\s*\d+\.?$/i, '')
    .replace(/\s*\(p\.\s*\d+\)\.?$/i, '')
    .replace(/,?\s*\d+\.$/, '')
    .trim()
}

function groupByDocument(
  evidence: ProjectEvidenceRecord[]
): Array<{ title: string; items: ProjectEvidenceRecord[] }> {
  const order: string[] = []
  const map = new Map<string, ProjectEvidenceRecord[]>()
  for (const e of evidence) {
    if (!map.has(e.documentId)) {
      map.set(e.documentId, [])
      order.push(e.documentId)
    }
    map.get(e.documentId)!.push(e)
  }
  return order.map((id) => ({ title: map.get(id)![0].documentTitle, items: map.get(id)! }))
}

export function buildProjectMarkdown(detail: ProjectDetail, format: CitationFormat): string {
  const { project, evidence, notes, syntheses } = detail
  const out: string[] = []
  out.push(`# ${project.title}`)
  if (project.thesis.trim()) out.push(`\n**Thesis:** ${project.thesis.trim()}`)

  if (evidence.length > 0) {
    out.push('\n## Evidence')
    for (const group of groupByDocument(evidence)) {
      out.push(`\n### ${group.title}`)
      for (const e of group.items) {
        out.push(`\n> ${e.snippet}\n>\n> — ${e.citations[format]}`)
      }
    }
  }

  if (syntheses.length > 0) {
    out.push('\n## Synthesis')
    for (const s of syntheses) {
      out.push(`\n_${s.thesis}_`)
      for (const sub of s.result.subClaims) {
        out.push(`\n**${sub.claim}**`)
        for (const ev of sub.evidence) {
          out.push(`- "${ev.quote}" — ${ev.citations[format]}`)
        }
      }
      if (s.result.tensions.length > 0) {
        out.push(`\n*Tensions:* ${s.result.tensions.join('; ')}`)
      }
      if (s.result.summary) out.push(`\n${s.result.summary}`)
    }
  }

  if (notes.length > 0) {
    out.push('\n## Notes')
    for (const n of notes) out.push(`\n${n.content}`)
  }

  const bib = [...new Set(evidence.map((e) => stripPage(e.citations[format])))].sort()
  if (bib.length > 0) {
    out.push('\n## Bibliography')
    for (const entry of bib) out.push(`- ${entry}`)
  }

  return out.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Minimal HTML (opens cleanly in Word/Docs — the practical ".docx" path for v1).
export function buildProjectHtml(detail: ProjectDetail, format: CitationFormat): string {
  const md = buildProjectMarkdown(detail, format)
  const body = md
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`
      if (line.startsWith('> ')) return `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`
      if (line.startsWith('- ')) return `<li>${escapeHtml(line.slice(2))}</li>`
      if (line.trim() === '') return ''
      return `<p>${escapeHtml(line)}</p>`
    })
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(
    detail.project.title
  )}</title>\n${body}`
}

export function exportProject(
  detail: ProjectDetail,
  format: CitationFormat,
  exportFormat: ExportFormat
): string {
  return exportFormat === 'html'
    ? buildProjectHtml(detail, format)
    : buildProjectMarkdown(detail, format)
}
