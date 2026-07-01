import { ipcMain, shell, clipboard, nativeImage, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { IpcChannels } from '@shared/ipc/channels'
import { saveBinaryFile } from '../services/fileService'

function asBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
}

// Foreground Messages so the user can paste the (already clipboard-copied)
// image into a conversation. A fully scripted "attach to a new compose
// window" isn't reliably automatable across macOS versions without a
// pre-selected recipient, so this is the honest v1 behavior rather than a
// silent broken promise.
function foregroundMessages(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('open', ['-a', 'Messages'], (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export function registerShareIpc(): void {
  ipcMain.handle(IpcChannels.shareSavePng, (event, data: Uint8Array, defaultName: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return saveBinaryFile(win, { defaultName, data })
  })

  ipcMain.handle(IpcChannels.shareCopyImage, (_e, data: Uint8Array) => {
    clipboard.writeImage(nativeImage.createFromBuffer(asBuffer(data)))
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.shareToMessages, async (_e, data: Uint8Array) => {
    if (process.platform !== 'darwin') {
      return { ok: false, error: 'Messages sharing is only available on macOS.' }
    }
    clipboard.writeImage(nativeImage.createFromBuffer(asBuffer(data)))
    try {
      await foregroundMessages()
      return { ok: true, method: 'clipboard-fallback' as const }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to open Messages.' }
    }
  })

  ipcMain.handle(IpcChannels.shareOpenTwitterIntent, async (_e, text: string) => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    await shell.openExternal(url)
    return { ok: true }
  })
}
