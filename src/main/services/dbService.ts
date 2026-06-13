import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import schemaSql from '../db/schema.sql?raw'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() during app startup.')
  }
  return db
}

export function initDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'fuzzy.db')
  if (is.dev) {
    console.log('[fuzzy db] opening', dbPath)
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  db.exec(schemaSql)

  applyMigrations(db)

  return db
}

// ---------------------------------------------------------------------------
// Versioned migrations
// ---------------------------------------------------------------------------
//
// `CREATE TABLE IF NOT EXISTS` in schema.sql handles greenfield installs; the
// migration runner below covers users whose DB pre-dates a given column.
//
// Each migration is keyed on a monotonic integer. The current applied version
// is stored in the `settings` table under `db.schemaVersion`. Migrations whose
// version > current schemaVersion run inside a single better-sqlite3
// transaction; on success, the new version is committed atomically.
//
// To add a migration: append a new entry with `version = lastVersion + 1` and
// an `up(db)` callback that performs the structural change. Do NOT edit prior
// migrations — they're frozen, since old DBs still need them to converge.

const SCHEMA_VERSION_KEY = 'db.schemaVersion'

interface Migration {
  version: number
  up: (database: Database.Database) => void
}

const migrations: Migration[] = [
  {
    // v2: backfill the columns added during the cost/safety pass. New
    // installs already have these via schema.sql; users on a pre-v2 DB get
    // them added here.
    version: 2,
    up: (database) => {
      ensureColumn(database, 'documents', 'file_size', 'INTEGER')
      ensureColumn(database, 'ai_responses', 'provider', 'TEXT')
      ensureColumn(database, 'ai_responses', 'input_tokens', 'INTEGER')
      ensureColumn(database, 'ai_responses', 'output_tokens', 'INTEGER')
      ensureColumn(database, 'ai_responses', 'latency_ms', 'INTEGER')
      ensureColumn(database, 'ai_responses', 'cost_usd', 'REAL')
    }
  },
  {
    // v3: multi-format support. Existing rows were all PDFs, so the column
    // defaults to 'pdf' and backfills any NULLs to the same.
    version: 3,
    up: (database) => {
      ensureColumn(database, 'documents', 'file_type', "TEXT NOT NULL DEFAULT 'pdf'")
      database.exec(`UPDATE documents SET file_type = 'pdf' WHERE file_type IS NULL`)
    }
  },
  {
    // v4: citation metadata for the Thesis Workspace. All nullable; best-effort
    // auto-extracted at import and user-editable. Mirrored in schema.sql for
    // fresh installs — keep the (name, type, nullable) identical on both paths.
    version: 4,
    up: (database) => {
      ensureColumn(database, 'documents', 'author', 'TEXT')
      ensureColumn(database, 'documents', 'year', 'INTEGER')
      ensureColumn(database, 'documents', 'publisher', 'TEXT')
      ensureColumn(database, 'documents', 'source_url', 'TEXT')
    }
  },
  {
    // v5: Projects workspace (thesis + evidence + notes + syntheses). Tables are
    // also created by schema.sql for fresh installs; this covers existing DBs.
    version: 5,
    up: (database) => {
      database.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_project_evidence_project ON project_evidence(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_syntheses_project ON project_syntheses(project_id);
      `)
    }
  },
  {
    // v6: focus sessions (timed reading) for stats + streaks. Also created by
    // schema.sql for fresh installs.
    version: 6,
    up: (database) => {
      database.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);
      `)
    }
  },
  {
    // v7: entity/structure index + cached embeddings + document genre. The
    // tables are also created by schema.sql for fresh installs; this covers
    // existing DBs. DDL is kept identical to schema.sql (the v4/v5 discipline).
    version: 7,
    up: (database) => {
      ensureColumn(database, 'documents', 'genre', 'TEXT')
      database.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_entities_doc_kind ON entities(document_id, kind);
        CREATE INDEX IF NOT EXISTS idx_entity_mentions_doc_page ON entity_mentions(document_id, page_number);
        CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(entity_id);
        CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_doc ON chunk_embeddings(document_id);
      `)
    }
  },
  {
    // v8: customizable study packs. `options_json` records how a pack was
    // generated (history chips + per-section scope); quiz_attempts stores
    // interactive quiz scores; flashcard_reviews holds SM-2 lite scheduling.
    // Mirrored in schema.sql for fresh installs (keep DDL identical).
    version: 8,
    up: (database) => {
      ensureColumn(database, 'study_packs', 'options_json', 'TEXT')
      database.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_doc ON quiz_attempts(document_id);
        CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_due ON flashcard_reviews(due_at);
      `)
    }
  },
  {
    // v9: the Essay Workspace ("cursor for writing essays"). Also created by
    // schema.sql for fresh installs; DDL kept identical (the v4/v5 discipline).
    version: 9,
    up: (database) => {
      database.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_essays_updated ON essays(updated_at);
      `)
    }
  },
  {
    // v10: sanitized rich HTML per reflowable section (epub/docx/md), so the
    // reader can render real book formatting instead of a plain-text wall.
    // Additive + nullable — old rows fall back to text_content. Mirrored in
    // schema.sql for fresh installs (the v4/v5 discipline).
    version: 10,
    up: (database) => {
      ensureColumn(database, 'pages', 'html_content', 'TEXT')
    }
  },
  {
    // v11: per-document reading position high-water mark. Drives resume-on-open
    // and the spoiler-safe retrieval boundary. Nullable — NULL = never read.
    version: 11,
    up: (database) => {
      ensureColumn(database, 'documents', 'last_read_page', 'INTEGER')
    }
  },
  {
    // v12: cross-source highlight memory (imports, offline FTS, daily review).
    // Fresh installs get the same DDL from schema.sql.
    version: 12,
    up: (database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS highlights (
          id TEXT PRIMARY KEY,
          source_kind TEXT NOT NULL,
          content_kind TEXT NOT NULL DEFAULT 'other',
          source_label TEXT NOT NULL,
          source_title TEXT NOT NULL,
          source_author TEXT,
          source_url TEXT,
          source_location TEXT,
          external_id TEXT,
          text TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          tags_json TEXT NOT NULL DEFAULT '[]',
          is_favorite INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          dedupe_hash TEXT NOT NULL,
          ease REAL NOT NULL DEFAULT 2.5,
          interval_days REAL NOT NULL DEFAULT 0,
          repetitions INTEGER NOT NULL DEFAULT 0,
          due_at TEXT NOT NULL,
          last_reviewed_at TEXT,
          highlighted_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_dedupe_hash ON highlights(dedupe_hash);
        CREATE INDEX IF NOT EXISTS idx_highlights_due ON highlights(due_at);
        CREATE INDEX IF NOT EXISTS idx_highlights_favorite ON highlights(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_highlights_source_kind ON highlights(source_kind);
        CREATE VIRTUAL TABLE IF NOT EXISTS highlights_fts USING fts5(
          highlight_id UNINDEXED,
          source_title,
          source_author,
          text,
          note,
          tags,
          source_label,
          tokenize = 'porter unicode61'
        );
      `)
    }
  }
]

function readSchemaVersion(database: Database.Database): number {
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(SCHEMA_VERSION_KEY) as { value: string | null } | undefined
  if (!row || row.value === null) return 1
  const n = Number.parseInt(row.value, 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

function writeSchemaVersion(database: Database.Database, version: number): void {
  const now = new Date().toISOString()
  database
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(SCHEMA_VERSION_KEY, String(version), now)
}

function applyMigrations(database: Database.Database): void {
  // Seed the schema_version row on first open.
  const row = database
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(SCHEMA_VERSION_KEY) as { value: string | null } | undefined
  if (!row) {
    writeSchemaVersion(database, 1)
  }

  const current = readSchemaVersion(database)
  const ordered = [...migrations].sort((a, b) => a.version - b.version)
  for (const migration of ordered) {
    if (migration.version <= current) continue
    // better-sqlite3's `Database.transaction(fn)` wraps the body in a real
    // BEGIN/COMMIT and rolls back if the callback throws. We bump the
    // schema_version row inside the same transaction so a partial migration
    // can never be observed.
    const run = database.transaction(() => {
      migration.up(database)
      writeSchemaVersion(database, migration.version)
    })
    run()
    console.log(`[fuzzy db] applied migration v${migration.version}`)
  }
}

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  type: string
): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string
  }>
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
