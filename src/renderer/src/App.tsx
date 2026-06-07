import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/common/ErrorBoundary'

function App(): React.JSX.Element {
  return (
    <ErrorBoundary label="Fuzzy hit an unexpected error">
      <AppShell />
    </ErrorBoundary>
  )
}

export default App
