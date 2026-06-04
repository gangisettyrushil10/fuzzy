import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const repoRoot = path.join(__dirname, '..')

test.describe('Fuzzy Electron smoke', () => {
  test('import sample → mock explain → save note → persists', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fuzzy-e2e-'))

    const app = await electron.launch({
      args: [path.join(repoRoot, 'out/main/index.js')],
      cwd: repoRoot,
      env: {
        ...process.env,
        FUZZY_E2E: '1',
        FUZZY_USER_DATA: userData,
        ELECTRON_RUN_AS_NODE: ''
      },
      timeout: 120_000
    })

    try {
      const page = await app.firstWindow({ timeout: 60_000 })
      await page.waitForLoadState('domcontentloaded')

      await page.evaluate(async () => {
        await window.fuzzy.settings.setProviderMode('mock')
      })

      await page.getByRole('button', { name: /try sample document/i }).click()
      await page.waitForTimeout(3000)

      const docId = await page.evaluate(async () => {
        const docs = await window.fuzzy.documents.list()
        return docs[0]?.id ?? null
      })
      expect(docId).toBeTruthy()

      await page.evaluate(
        async ({ id }) => {
          window.__FUZZY_TEST__?.seedSelection({
            documentId: id as string,
            pageNumber: 1,
            text: 'Select this sentence and click Explain.'
          })
        },
        { id: docId }
      )

      await page.evaluate(async () => {
        const sel = { documentId: (await window.fuzzy.documents.list())[0].id, pageNumber: 1 }
        await window.fuzzy.ai.runAction({
          documentId: sel.documentId,
          pageNumber: 1,
          action: 'explain',
          selectedText: 'Select this sentence and click Explain.',
          contextText: null
        })
      })

      // Save note via IPC (deterministic; does not depend on UI automation for drag-select).
      await page.evaluate(async () => {
        const docs = await window.fuzzy.documents.list()
        const id = docs[0].id
        await window.fuzzy.annotations.create({
          documentId: id,
          pageNumber: 1,
          selectedText: 'Select this sentence and click Explain.',
          note: 'Mock explanation note for e2e.',
          annotationType: 'ai_note',
          position: {
            pageNumber: 1,
            rectsOnPage: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.05 }]
          }
        })
      })

      const count1 = await page.evaluate(() => window.__FUZZY_TEST__?.getAnnotationCount() ?? 0)
      expect(count1).toBeGreaterThan(0)

      await app.close()

      const app2 = await electron.launch({
        args: [path.join(repoRoot, 'out/main/index.js')],
        cwd: repoRoot,
        env: {
          ...process.env,
          FUZZY_E2E: '1',
          FUZZY_USER_DATA: userData,
          ELECTRON_RUN_AS_NODE: ''
        },
        timeout: 120_000
      })

      const page2 = await app2.firstWindow({ timeout: 60_000 })
      await page2.waitForLoadState('domcontentloaded')
      await page2.waitForTimeout(2000)

      const count2 = await page2.evaluate(async () => {
        const docs = await window.fuzzy.documents.list()
        if (!docs[0]) return 0
        const anns = await window.fuzzy.annotations.listForDocument(docs[0].id)
        return anns.length
      })
      expect(count2).toBeGreaterThan(0)

      await app2.close()
    } finally {
      try {
        await app.close()
      } catch {
        /* already closed */
      }
    }
  })
})
