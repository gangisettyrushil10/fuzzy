import { create } from 'zustand'
import type { AppSettings, ProviderMode } from '@shared/types/database'

interface SettingsState {
  settings: AppSettings | null
  loading: boolean
  error: string | null

  load: () => Promise<void>
  setProviderMode: (mode: ProviderMode) => Promise<void>
  setOpenaiKey: (key: string) => Promise<void>
  setOpenaiModel: (model: string) => Promise<void>
  setOpenaiBaseUrl: (url: string | null) => Promise<void>
  clearOpenaiKey: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const settings = await window.fuzzy.settings.get()
      set({ settings, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load settings'
      })
    }
  },

  setProviderMode: async (mode) => {
    const settings = await window.fuzzy.settings.setProviderMode(mode)
    set({ settings })
  },

  setOpenaiKey: async (key) => {
    const settings = await window.fuzzy.settings.setOpenaiKey(key)
    set({ settings })
  },

  setOpenaiModel: async (model) => {
    const settings = await window.fuzzy.settings.setOpenaiModel(model)
    set({ settings })
  },

  setOpenaiBaseUrl: async (url) => {
    const settings = await window.fuzzy.settings.setOpenaiBaseUrl(url)
    set({ settings })
  },

  clearOpenaiKey: async () => {
    const settings = await window.fuzzy.settings.clearOpenaiKey()
    set({ settings })
  }
}))
