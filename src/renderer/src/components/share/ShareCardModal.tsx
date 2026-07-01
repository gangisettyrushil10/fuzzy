import { useEffect, useRef, useState } from 'react'
import { useShareCardStore } from '../../state/shareCardStore'
import { useAppearanceStore } from '../../state/appearanceStore'
import { resolveTheme, resolveAccent } from '../../theme/applyTheme'
import { renderShareCardToCanvas, canvasToPngBlob } from '../../lib/shareCardRenderer'
import { toast } from '../../state/toastStore'
import { Modal, Button } from '../ui'

const isMac = window.fuzzy.platform === 'darwin'

export function ShareCardModal(): React.JSX.Element | null {
  const open = useShareCardStore((s) => s.open)
  const excerpt = useShareCardStore((s) => s.excerpt)
  const close = useShareCardStore((s) => s.close)
  const appearancePrefs = useAppearanceStore((s) => s.prefs)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pngBytes, setPngBytes] = useState<Uint8Array | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !excerpt || !canvasRef.current) return
    let cancelled = false
    const theme = resolveTheme(appearancePrefs.themeId)
    const { accent } = resolveAccent(appearancePrefs, theme)

    renderShareCardToCanvas(canvasRef.current, {
      excerptText: excerpt.excerptText,
      sourceTitle: excerpt.sourceTitle,
      sourceAuthor: excerpt.sourceAuthor,
      pageNumber: excerpt.pageNumber,
      bgHex: theme.palette.surface,
      fgHex: theme.palette.fg,
      mutedHex: theme.palette['fg-muted'],
      accentHex: accent
    })
      .then(() => canvasToPngBlob(canvasRef.current!))
      .then(async (blob) => {
        if (cancelled) return
        const bytes = new Uint8Array(await blob.arrayBuffer())
        setPngBytes(bytes)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      })
      .catch((err) => console.error('[fuzzy] share card render failed', err))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, excerpt, appearancePrefs.themeId, appearancePrefs.accentId, appearancePrefs.customAccent])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (!open || !excerpt) return null

  const handleClose = (): void => {
    close()
    setPreviewUrl(null)
    setPngBytes(null)
  }

  const withBusy = async (id: string, fn: () => Promise<void>): Promise<void> => {
    setBusyAction(id)
    try {
      await fn()
    } finally {
      setBusyAction(null)
    }
  }

  const handleSave = (): Promise<void> =>
    withBusy('save', async () => {
      if (!pngBytes) return
      const name = `${excerpt.sourceTitle.replace(/[^\w-]+/g, '-').slice(0, 60) || 'excerpt'}.png`
      const result = await window.fuzzy.share.savePng(pngBytes, name)
      if (result.ok) toast.success('Saved image')
    })

  const handleCopy = (): Promise<void> =>
    withBusy('copy', async () => {
      if (!pngBytes) return
      await window.fuzzy.share.copyImage(pngBytes)
      toast.success('Copied image to clipboard')
    })

  const handleTwitter = (): Promise<void> =>
    withBusy('twitter', async () => {
      const text = `"${excerpt.excerptText}" — ${excerpt.sourceTitle}`
      await window.fuzzy.share.openTwitterIntent(text)
    })

  const handleMessages = (): Promise<void> =>
    withBusy('messages', async () => {
      if (!pngBytes) return
      const result = await window.fuzzy.share.toMessages(pngBytes)
      if (result.ok) toast.success('Image copied — paste it into Messages')
      else toast.error(result.error ?? 'Could not open Messages')
    })

  return (
    <Modal
      title="Share excerpt"
      size="lg"
      onClose={handleClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busyAction === 'twitter'}
            onClick={handleTwitter}
            title="Shares text only — image isn't attached"
          >
            Share to X
          </Button>
          {isMac && (
            <Button
              variant="secondary"
              size="sm"
              loading={busyAction === 'messages'}
              disabled={!pngBytes}
              onClick={handleMessages}
              title="Copies image — paste into Messages"
            >
              Share to Messages
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={busyAction === 'copy'}
            disabled={!pngBytes}
            onClick={handleCopy}
          >
            Copy Image
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={busyAction === 'save'}
            disabled={!pngBytes}
            onClick={handleSave}
          >
            Save Image…
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-center rounded-fz border border-fz-border bg-fz-bg p-3">
        {previewUrl ? (
          <img src={previewUrl} alt="Share card preview" className="max-w-full rounded" />
        ) : (
          <div className="flex h-[315px] w-[600px] items-center justify-center text-fz-micro text-fz-fg-subtle">
            Rendering…
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </Modal>
  )
}
