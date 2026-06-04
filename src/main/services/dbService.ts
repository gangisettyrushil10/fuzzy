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
