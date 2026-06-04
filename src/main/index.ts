import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/registerHandlers'
import { closeDb, initDb } from './services/dbService'
import { isAllowedExternalScheme } from './services/urlSafety'

// Isolated userData for Playwright smoke tests (see e2e/smoke.spec.ts).
if (process.env.FUZZY_USER_DATA) {
  app.setPath('userData', process.env.FUZZY_USER_DATA)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0b0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox: true is the recommended Electron hardening. Our preload only
      // uses ipcRenderer + contextBridge, both of which work in a sandboxed
      // preload — no Node APIs needed there.
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalScheme(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // The renderer must never navigate the main BrowserWindow away from the
  // bundled app shell. Any link click that would replace the current frame
  // is intercepted: web/mailto links are routed to the default browser, and
  // everything else is dropped silently.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    if (isAllowedExternalScheme(url)) {
      shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fuzzy.study')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDb()
})
