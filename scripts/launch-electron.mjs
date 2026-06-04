#!/usr/bin/env node
// Launch electron-vite (dev | preview) with a clean Electron environment.
//
// Why this wrapper exists:
//   VS Code, Cursor, and other Electron-based IDEs set ELECTRON_RUN_AS_NODE=1
//   in the environment of their integrated terminals so that *their own*
//   extension host runs as Node. That variable is inherited by `pnpm dev`
//   when developers run scripts from inside the IDE, and Electron 39 honours
//   it strictly: the spawned `electron` binary then behaves as plain Node and
//   `require('electron')` returns a string instead of the Electron API.
//   `@electron-toolkit/utils` calls `electron.app.isPackaged` at module-load
//   time, which crashes with
//     TypeError: Cannot read properties of undefined (reading 'isPackaged')
//
// Fix: delete the variable from the child's environment before spawning
// electron-vite. Outside an IDE this is a no-op.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const mode = process.argv[2] === 'preview' ? 'preview' : 'dev'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const isWin = process.platform === 'win32'
const bin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  isWin ? 'electron-vite.cmd' : 'electron-vite'
)

const child = spawn(bin, [mode], { stdio: 'inherit', env })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
