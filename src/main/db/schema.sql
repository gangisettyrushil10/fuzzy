CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT,
  page_count INTEGER,
  file_size INTEGER,
  imported_at TEXT NOT NULL,
  last_opened_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash)
  WHERE file_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  text_content TEXT,
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
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_document ON pages(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_document ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_document ON ai_responses(document_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_document ON reading_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_study_packs_document ON study_packs(document_id);
