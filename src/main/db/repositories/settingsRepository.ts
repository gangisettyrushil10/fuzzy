import { getDb } from '../../services/dbService'

interface SettingsRow {
  key: string
  value: string | null
  updated_at: string
}

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare(`SELECT key, value, updated_at FROM settings WHERE key = ?`)
    .get(key) as SettingsRow | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string | null): void {
  const updatedAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, updatedAt)
}

export function deleteSetting(key: string): void {
  getDb().prepare(`DELETE FROM settings WHERE key = ?`).run(key)
}
