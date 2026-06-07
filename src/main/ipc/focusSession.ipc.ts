import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc/channels'
import {
  endFocusSession,
  finalizeOpenSessions,
  listFocusSessions,
  startFocusSession,
  updateFocusProgress
} from '../db/repositories/focusSessionRepository'
import { computeStats } from '../services/stats/statsService'
import type {
  FocusGoalType,
  FocusSessionProgress,
  StartFocusSessionInput
} from '@shared/types/database'

function toGoalType(v: unknown): FocusGoalType {
  return v === 'time' || v === 'words' ? v : 'none'
}

function toProgress(v: unknown): FocusSessionProgress {
  const p = (v ?? {}) as Partial<FocusSessionProgress>
  return {
    elapsedSeconds: Math.max(0, Math.floor(Number(p.elapsedSeconds) || 0)),
    wordsRead: Math.max(0, Math.floor(Number(p.wordsRead) || 0)),
    pageEnd: typeof p.pageEnd === 'number' ? p.pageEnd : null
  }
}

export function registerFocusSessionIpc(): void {
  ipcMain.handle(IpcChannels.focusStart, (_e, input: unknown) => {
    const i = (input ?? {}) as Partial<StartFocusSessionInput>
    if (typeof i.documentId !== 'string' || !i.documentId) throw new Error('documentId is required.')
    return startFocusSession({
      documentId: i.documentId,
      pageStart: typeof i.pageStart === 'number' ? i.pageStart : null,
      goalType: toGoalType(i.goalType),
      goalTarget: typeof i.goalTarget === 'number' ? i.goalTarget : null
    })
  })

  ipcMain.handle(IpcChannels.focusUpdate, (_e, id: unknown, progress: unknown) => {
    if (typeof id !== 'string') throw new Error('id is required.')
    updateFocusProgress(id, toProgress(progress))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.focusEnd, (_e, id: unknown, progress: unknown) => {
    if (typeof id !== 'string') throw new Error('id is required.')
    return endFocusSession(id, toProgress(progress))
  })

  ipcMain.handle(IpcChannels.focusFinalizeOpen, () => {
    finalizeOpenSessions()
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.focusList, () => listFocusSessions())

  ipcMain.handle(IpcChannels.focusStats, () =>
    computeStats(listFocusSessions(), Date.now(), new Date().getTimezoneOffset())
  )
}
