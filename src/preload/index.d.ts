import type { FuzzyApi } from '@shared/types/api'

declare global {
  interface Window {
    fuzzy: FuzzyApi
  }
}
