import { randomUUID } from 'crypto'
import { getDb } from '../../services/dbService'
import type {
  CitationFormat,
  ProjectDetail,
  ProjectEvidenceRecord,
  ProjectNoteRecord,
  ProjectRecord,
  ProjectSynthesisRecord,
  RankedPassage,
  SynthesisResult
} from '@shared/types/database'

// ---- projects ----

interface ProjectRow {
  id: string
  title: string
  thesis: string
  created_at: string
  updated_at: string
}

function toProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    title: row.title,
    thesis: row.thesis,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function createProject(title: string, thesis = ''): ProjectRecord {
  const id = randomUUID()
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO projects (id, title, thesis, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, title, thesis, now, now)
  return { id, title, thesis, createdAt: now, updatedAt: now }
}

export function listProjects(): ProjectRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM projects ORDER BY updated_at DESC`)
    .all() as ProjectRow[]
  return rows.map(toProject)
}

export function getProject(id: string): ProjectRecord | null {
  const row = getDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
    | ProjectRow
    | undefined
  return row ? toProject(row) : null
}

export function updateProject(
  id: string,
  patch: { title?: string; thesis?: string }
): ProjectRecord | null {
  const sets: string[] = []
  const values: string[] = []
  if (patch.title !== undefined) {
    sets.push('title = ?')
    values.push(patch.title)
  }
  if (patch.thesis !== undefined) {
    sets.push('thesis = ?')
    values.push(patch.thesis)
  }
  sets.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)
  getDb()
    .prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values)
  return getProject(id)
}

export function deleteProject(id: string): void {
  getDb().prepare(`DELETE FROM projects WHERE id = ?`).run(id)
}

function touchProject(projectId: string): void {
  getDb()
    .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), projectId)
}

// ---- evidence ----

interface EvidenceRow {
  id: string
  project_id: string
  document_id: string
  document_title: string
  page_number: number
  snippet: string
  citations_json: string
  score: number
  created_at: string
}

function toEvidence(row: EvidenceRow): ProjectEvidenceRecord | null {
  let citations: Record<CitationFormat, string>
  try {
    citations = JSON.parse(row.citations_json)
  } catch (err) {
    console.error(`[fuzzy db] malformed citations_json for evidence ${row.id}`, err)
    return null
  }
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    pageNumber: row.page_number,
    snippet: row.snippet,
    citations,
    score: row.score,
    createdAt: row.created_at
  }
}

export function addEvidence(projectId: string, passage: RankedPassage): ProjectEvidenceRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO project_evidence
       (id, project_id, document_id, document_title, page_number, snippet, citations_json, score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      projectId,
      passage.documentId,
      passage.documentTitle,
      passage.pageNumber,
      passage.snippet,
      JSON.stringify(passage.citations),
      passage.score,
      createdAt
    )
  touchProject(projectId)
  return {
    id,
    projectId,
    documentId: passage.documentId,
    documentTitle: passage.documentTitle,
    pageNumber: passage.pageNumber,
    snippet: passage.snippet,
    citations: passage.citations,
    score: passage.score,
    createdAt
  }
}

export function listEvidence(projectId: string): ProjectEvidenceRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM project_evidence WHERE project_id = ? ORDER BY created_at ASC`)
    .all(projectId) as EvidenceRow[]
  return rows.map(toEvidence).filter((r): r is ProjectEvidenceRecord => r !== null)
}

export function removeEvidence(id: string): void {
  getDb().prepare(`DELETE FROM project_evidence WHERE id = ?`).run(id)
}

// ---- notes ----

interface NoteRow {
  id: string
  project_id: string
  content: string
  created_at: string
  updated_at: string
}

function toNote(row: NoteRow): ProjectNoteRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function addNote(projectId: string, content: string): ProjectNoteRecord {
  const id = randomUUID()
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO project_notes (id, project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, projectId, content, now, now)
  touchProject(projectId)
  return { id, projectId, content, createdAt: now, updatedAt: now }
}

export function updateNote(id: string, content: string): void {
  getDb()
    .prepare(`UPDATE project_notes SET content = ?, updated_at = ? WHERE id = ?`)
    .run(content, new Date().toISOString(), id)
}

export function removeNote(id: string): void {
  getDb().prepare(`DELETE FROM project_notes WHERE id = ?`).run(id)
}

export function listNotes(projectId: string): ProjectNoteRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM project_notes WHERE project_id = ? ORDER BY created_at ASC`)
    .all(projectId) as NoteRow[]
  return rows.map(toNote)
}

// ---- syntheses ----

interface SynthesisRow {
  id: string
  project_id: string
  thesis: string
  result_json: string
  created_at: string
}

function toSynthesis(row: SynthesisRow): ProjectSynthesisRecord | null {
  let result: SynthesisResult
  try {
    result = JSON.parse(row.result_json)
  } catch (err) {
    console.error(`[fuzzy db] malformed result_json for synthesis ${row.id}`, err)
    return null
  }
  return {
    id: row.id,
    projectId: row.project_id,
    thesis: row.thesis,
    result,
    createdAt: row.created_at
  }
}

export function addSynthesis(
  projectId: string,
  thesis: string,
  result: SynthesisResult
): ProjectSynthesisRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO project_syntheses (id, project_id, thesis, result_json, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, projectId, thesis, JSON.stringify(result), createdAt)
  touchProject(projectId)
  return { id, projectId, thesis, result, createdAt }
}

export function removeSynthesis(id: string): void {
  getDb().prepare(`DELETE FROM project_syntheses WHERE id = ?`).run(id)
}

export function listSyntheses(projectId: string): ProjectSynthesisRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM project_syntheses WHERE project_id = ? ORDER BY created_at DESC`)
    .all(projectId) as SynthesisRow[]
  return rows.map(toSynthesis).filter((r): r is ProjectSynthesisRecord => r !== null)
}

// ---- aggregate ----

export function getProjectDetail(id: string): ProjectDetail | null {
  const project = getProject(id)
  if (!project) return null
  return {
    project,
    evidence: listEvidence(id),
    notes: listNotes(id),
    syntheses: listSyntheses(id)
  }
}
