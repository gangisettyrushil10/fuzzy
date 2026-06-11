/**
 * Marketing screenshot script for Fuzzy.
 * Launches the built app against the real library (which must already have
 * The Great Gatsby imported), navigates to it, and captures screenshots.
 *
 * Run: node scripts/screenshot.mjs
 */
import { _electron as electron } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = '/Users/rushilgangisetty/Desktop/Projects/fuzzy-website/assets'
const REAL_USER_DATA = path.join(os.homedir(), 'Library/Application Support/fuzzy')

fs.mkdirSync(OUT_DIR, { recursive: true })

const electronPath = path.join(
  ROOT,
  'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
)

// Strip the VS Code / Cursor leak that makes Electron behave as plain Node
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

console.log('Launching Fuzzy against real library…')
const app = await electron.launch({
  executablePath: electronPath,
  args: [
    path.join(ROOT, 'out/main/index.js'),
    `--user-data-dir=${REAL_USER_DATA}`
  ],
  env,
  timeout: 30_000
})

await app.firstWindow()
await new Promise(r => setTimeout(r, 4000))

const ui = app.windows().find(w => !w.url().startsWith('devtools://'))
  ?? (await app.firstWindow())
await new Promise(r => setTimeout(r, 1000))

const ss = async (name, delayMs = 800) => {
  await new Promise(r => setTimeout(r, delayMs))
  const p = path.join(OUT_DIR, `${name}.png`)
  await ui.screenshot({ path: p, fullPage: false })
  console.log(`  ✓ ${p}`)
}

// ----- Helper: click the Gatsby doc in the sidebar -----
console.log('Opening The Great Gatsby…')
const docOpened = await ui.evaluate(() => {
  // Sidebar lists documents — find the Gatsby title
  const allButtons = [...document.querySelectorAll('button')]
  const gatsby = allButtons.find(b => b.textContent?.includes('Great Gatsby'))
  if (gatsby) { gatsby.click(); return 'clicked: ' + gatsby.textContent?.trim() }

  // Fallback: try any list item with that text
  const anyEl = [...document.querySelectorAll('*')].find(
    el => el.children.length === 0 && el.textContent?.trim() === 'The Great Gatsby'
  )
  if (anyEl) { anyEl.closest('button, li')?.click(); return 'clicked-fallback' }
  return 'NOT_FOUND'
})
console.log('  doc open result:', docOpened)

// Wait for EPUB reader to mount and extract pages (poll until "Extracting" gone)
console.log('Waiting for EPUB extraction to complete…')
try {
  await ui.waitForFunction(
    () => !document.body.innerText.includes('Extracting'),
    { timeout: 90_000, polling: 1000 }
  )
} catch {
  console.log('  (extraction timeout — proceeding anyway)')
}
// Add extra buffer after extraction for any post-processing / rendering
await new Promise(r => setTimeout(r, 4000))
console.log('  extraction done')

// 1. Home / initial load (take this first in case open fails)
await ss('home', 200)

// ----- Scroll the reader to the actual novel prose -----
// Section 1 starts with PG preamble; the novel begins ~3000 chars in.
// Scroll the reader card until we see "younger" (the famous opening line).
const scrolledToGatsby = await ui.evaluate(() => {
  const scrollEl = document.querySelector('.overflow-auto')
    ?? [...document.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 200)
  if (!scrollEl) return 'no-scroll-el'
  // Scroll down substantially to get past the PG license
  scrollEl.scrollTop = 2400
  return 'scrolled'
})
console.log('  scroll to prose:', scrolledToGatsby)
await new Promise(r => setTimeout(r, 800))

// 2. Reader view (main money shot — Gatsby prose)
await ss('reader', 600)

// 3. Expand chapters in left sidebar
const expanded = await ui.evaluate(() => {
  const btns = [...document.querySelectorAll('aside button')]
  // Find the toggle arrow next to the Gatsby doc row
  const toggle = btns.find(b => b.textContent?.trim() === '›' || b.dataset?.expand !== undefined)
    ?? btns.find(b => b.className?.includes('expand') || b.title?.toLowerCase().includes('expand'))
  if (toggle) { toggle.click(); return 'toggled' }
  return 'no-toggle-found'
})
console.log('  expand chapters:', expanded)
await ss('library', 1200)

// 4. Tutor panel — click the Ask tab
await ui.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const ask = btns.find(b => b.textContent?.trim() === 'Ask')
    ?? btns.find(b => b.textContent?.trim() === 'Tutor')
  ask?.click()
})
await ss('tutor', 600)

// 5. Full app with panels open
await ss('fullapp', 400)

// 6. Typography popover
const typoOpened = await ui.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const aa = btns.find(b => b.textContent?.trim() === 'Aa' || b.title?.toLowerCase().includes('typograph'))
  if (aa) { aa.click(); return 'opened' }
  return 'not-found'
})
console.log('  typography popover:', typoOpened)
await ss('typography', 800)
await ui.keyboard.press('Escape')

console.log('\nDone! Screenshots saved to:', OUT_DIR)
await app.close()
