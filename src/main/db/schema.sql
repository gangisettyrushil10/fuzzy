CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  page_count INTEGER,
  file_size INTEGER,
  imported_at TEXT NOT NULL,
  last_opened_at TEXT,
  author TEXT,
  year INTEGER,
  publisher TEXT,
  source_url TEXT,
  -- Detected (or user-overridden) document genre. Selects the genre adapter
  -- (segmentation/entity-kind/locator/prompts). NULL = not yet classified.
  genre TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash)
  WHERE file_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  text_content TEXT,
  -- Sanitized rich HTML for reflowable formats (epub/docx/md). NULL for PDF and
  -- plain text; the reader falls back to text_content. text_content stays the
  -- canonical string for search/word-index alignment (DB migration v10).
  html_content TEXT,
  estimated_word_count INTEGER DEFAULT 0,
  complexity_score REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, page_number)
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER,
  selected_text TEXT NOT NULL,
  note TEXT NOT NULL,
  annotation_type TEXT NOT NULL,
  color TEXT,
  position_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_responses (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER,
  action_type TEXT NOT NULL,
  input_text TEXT NOT NULL,
  context_text TEXT,
  output_text TEXT NOT NULL,
  model TEXT,
  provider TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  available_minutes INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_packs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  flashcards_json TEXT,
  quiz_json TEXT,
  key_concepts_json TEXT,
  -- Generation options used for this pack (StudyPackOptions JSON). NULL for
  -- packs created before the customizable-study-pack feature (DB migration v8).
  options_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Completed interactive quiz runs, for score history (DB migration v8).
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  study_pack_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (study_pack_id) REFERENCES study_packs(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Spaced-repetition (SM-2 lite) state, one row per (pack, card) (DB migration v8).
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id TEXT PRIMARY KEY,
  study_pack_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  card_index INTEGER NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (study_pack_id) REFERENCES study_packs(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(study_pack_id, card_index)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- Projects: durable research workspaces (thesis + evidence + notes + syntheses).
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thesis TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_evidence (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_title TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  snippet TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  score REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_syntheses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  thesis TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Focus sessions: timed distraction-free reading, for stats + streaks.
CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  words_read INTEGER NOT NULL DEFAULT 0,
  wpm REAL,
  page_start INTEGER,
  page_end INTEGER,
  goal_type TEXT NOT NULL DEFAULT 'none',
  goal_target INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Entity/structure index built at import (best-effort). `kind` is the genre
-- discriminator: character (fiction) today; claim|citation|speaker|concept
-- later. The roster is deduped per (document, kind, normalized_name).
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'character',
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  mention_count INTEGER NOT NULL DEFAULT 0,
  first_page INTEGER,
  salience REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local',
  attributes_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, kind, normalized_name)
);

-- Per-page occurrence index. One row per (entity, page) so co-occurrence of two
-- entities on a page is an index-only self-join. document_id is denormalized
-- for fast doc-scoped queries.
CREATE TABLE IF NOT EXISTS entity_mentions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  surface_form TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(entity_id, page_number)
);

-- One cached embedding vector per sentence chunk. text_hash guards staleness so
-- re-indexing only re-embeds changed chunks. vector is raw Float32 little-endian
-- bytes (dim floats).
CREATE TABLE IF NOT EXISTS chunk_embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  text_hash TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Essays: the writing workspace. A thesis + an evidence-grounded outline (JSON)
-- + a compiled draft. Library-spanning (no document FK) since an essay draws on
-- many sources.
CREATE TABLE IF NOT EXISTS essays (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thesis TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'library',
  outline_json TEXT,
  draft_md TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_document ON pages(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_document ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_document ON ai_responses(document_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_document ON reading_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_study_packs_document ON study_packs(document_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_doc ON quiz_attempts(document_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_due ON flashcard_reviews(due_at);
CREATE INDEX IF NOT EXISTS idx_project_evidence_project ON project_evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_syntheses_project ON project_syntheses(project_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_entities_doc_kind ON entities(document_id, kind);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_doc_page ON entity_mentions(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_doc ON chunk_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_essays_updated ON essays(updated_at);
