import { BrowserWindow, dialog } from 'electron'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import type { HighlightImportResult } from '@shared/types/database'
import { importHighlightsBatch } from '../../db/repositories/highlightRepository'
import { parseHighlightImport } from './highlightImportParsers'

function buildImportFilters(): Electron.FileFilter[] {
  return [
    { name: 'Highlight exports', extensions: ['txt', 'csv', 'json', 'md'] },
    { name: 'Text', extensions: ['txt', 'md'] },
    { name: 'CSV', extensions: ['csv'] },
    { name: 'JSON', extensions: ['json'] }
  ]
}

export async function openHighlightImportDialog(
  parent: BrowserWindow | null
): Promise<HighlightImportResult | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Import highlights',
    properties: ['openFile'],
    filters: buildImportFilters()
  }
  const picker = parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
  const { canceled, filePaths } = await picker
  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const raw = await readFile(filePath, 'utf-8')
  const parsed = parseHighlightImport(basename(filePath), raw)
  const counts = importHighlightsBatch(parsed.sourceKind, parsed.sourceLabel, parsed.items)
  return {
    sourceKind: parsed.sourceKind,
    sourceLabel: parsed.sourceLabel,
    importedCount: counts.importedCount,
    dedupedCount: counts.dedupedCount
  }
}
