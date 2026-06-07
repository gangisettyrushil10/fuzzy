import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Shown in the fallback so the user knows which area failed. */
  label?: string
  /** Optional reset hook — when this key changes, the boundary clears. */
  resetKey?: string | number | null
  children: ReactNode
}

interface State {
  error: Error | null
}

// Renderer error boundary. Before this existed, any uncaught render error took
// down the whole window (the "app goes blank" symptom). Now a failure is
// contained: we show a recoverable fallback and keep the rest of the shell
// alive. Wrap volatile subtrees (the document reader, panels) individually.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[fuzzy] render error boundary caught:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private reset = (): void => this.setState({ error: null })

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="text-sm font-medium text-fz-fg">
            {this.props.label ?? 'Something went wrong'}
          </div>
          <p className="max-w-md text-xs leading-relaxed text-fz-fg-muted">
            This part of the app hit an unexpected error and was contained so the rest of Fuzzy
            keeps working.
          </p>
          <pre className="max-w-md overflow-auto rounded border border-fz-border bg-fz-bg px-3 py-2 text-left text-[10px] text-fz-fg-muted">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border border-fz-border bg-fz-surface-2 px-3 py-1.5 text-xs text-fz-fg hover:bg-fz-bg focus-visible:ring-2 focus-visible:ring-fz-accent"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
