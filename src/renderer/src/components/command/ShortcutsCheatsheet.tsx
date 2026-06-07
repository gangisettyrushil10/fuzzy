import { Kbd, Modal } from '../ui'

// Keyboard shortcut reference. Opened from the command palette or `?`.
const GROUPS: ReadonlyArray<{ title: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    title: 'General',
    items: [
      { keys: ['⌘', 'K'], label: 'Command palette' },
      { keys: ['⌘', 'O'], label: 'Import document' },
      { keys: ['⌘', ','], label: 'Settings' },
      { keys: ['?'], label: 'This shortcuts sheet' },
      { keys: ['Esc'], label: 'Dismiss menus / overlays' }
    ]
  },
  {
    title: 'Reading',
    items: [
      { keys: ['⌘', '⇧', 'P'], label: 'Plan study session' },
      { keys: ['⌘', '⇧', 'S'], label: 'Open study pack' },
      { keys: ['←', '→'], label: 'Previous / next page' },
      { keys: ['⇧', 'F'], label: 'Toggle focus mode' }
    ]
  },
  {
    title: 'Pacer (when active)',
    items: [
      { keys: ['Space'], label: 'Play / pause' },
      { keys: ['['], label: 'Slower (−10 wpm)' },
      { keys: [']'], label: 'Faster (+10 wpm)' }
    ]
  }
]

export function ShortcutsCheatsheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <Modal title="Keyboard shortcuts" size="md" onClose={onClose}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-fz-label font-semibold uppercase tracking-wider text-fz-fg-subtle">
              {group.title}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-fz-ui text-fz-fg-muted">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
