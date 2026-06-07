import './lib/polyfills'

// Bundled reading fonts (self-hosted woff2 via Fontsource; Vite hashes + bundles
// the files for both dev and packaged builds). Variable index.css covers the
// upright weight axis; the wght-italic imports give real italics for <em>.
import '@fontsource-variable/literata/index.css'
import '@fontsource-variable/literata/wght-italic.css'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource/opendyslexic/400.css'
import '@fontsource/opendyslexic/700.css'
import '@fontsource/opendyslexic/400-italic.css'

import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

if (import.meta.env.DEV || window.fuzzy?.e2e) {
  void import('./testBridge').then((m) => m.attachTestBridge())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
