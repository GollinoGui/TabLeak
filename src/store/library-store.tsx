import * as React from 'react'

import { PLANS } from '@/lib/plans'
import { DEFAULT_SOUND } from '@/lib/tab-grid'
import type { Folder, InstrumentConfig, Tab, UserProfile } from '@/types'

const STORAGE_KEY = 'tableak.library.v1'

interface LibraryState {
  user: UserProfile
  folders: Folder[]
  tabs: Tab[]
}

function loadState(): LibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as LibraryState
  } catch {
    // ignore corrupted storage
  }
  return {
    user: {
      id: 'mock-user-1',
      name: 'Guilherme Gollino',
      email: 'gollino.gollino@gmail.com',
      plan: 'free',
    },
    folders: [],
    tabs: [],
  }
}

function saveState(state: LibraryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable, continue without persistence
  }
}

export class LimitExceededError extends Error {}

interface LibraryContextValue {
  user: UserProfile
  folders: Folder[]
  tabs: Tab[]
  activeFolders: Folder[]
  activeTabs: Tab[]
  trashedFolders: Folder[]
  trashedTabs: Tab[]
  activeFolderCount: number
  activeTabCount: number
  maxFolders: number
  maxTabs: number
  maxBarsPerTab: number
  createFolder: (name: string) => Folder
  softDeleteFolder: (id: string) => void
  restoreFolder: (id: string) => void
  createTab: (input: {
    name: string
    folderId: string | null
    instrumentConfig: InstrumentConfig
  }) => Tab
  softDeleteTab: (id: string) => void
  restoreTab: (id: string) => void
  updateTabContent: (id: string, content: string) => void
  updateTabBpm: (id: string, bpm: number) => void
  updateTabSound: (id: string, sound: number) => void
  renameTab: (id: string, name: string) => void
  getTab: (id: string) => Tab | undefined
}

const LibraryContext = React.createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LibraryState>(loadState)

  React.useEffect(() => {
    saveState(state)
  }, [state])

  const plan = PLANS[state.user.plan]

  const activeFolders = state.folders.filter((f) => !f.isDeleted)
  const activeTabs = state.tabs.filter((t) => !t.isDeleted)
  const trashedFolders = state.folders.filter((f) => f.isDeleted)
  const trashedTabs = state.tabs.filter((t) => t.isDeleted)

  const createFolder = React.useCallback(
    (name: string) => {
      if (activeFolders.length >= plan.maxFolders) {
        throw new LimitExceededError(
          `Limite de ${plan.maxFolders} pastas do plano ${plan.name} atingido.`,
        )
      }
      const folder: Folder = {
        id: crypto.randomUUID(),
        name,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, folders: [...s.folders, folder] }))
      return folder
    },
    [activeFolders.length, plan.maxFolders, plan.name],
  )

  const softDeleteFolder = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isDeleted: true, deletedAt: new Date().toISOString() } : f,
      ),
      tabs: s.tabs.map((t) => (t.folderId === id ? { ...t, folderId: null } : t)),
    }))
  }, [])

  const restoreFolder = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isDeleted: false, deletedAt: null } : f,
      ),
    }))
  }, [])

  const createTab = React.useCallback(
    (input: { name: string; folderId: string | null; instrumentConfig: InstrumentConfig }) => {
      if (activeTabs.length >= plan.maxTabs) {
        throw new LimitExceededError(
          `Limite de ${plan.maxTabs} tablaturas do plano ${plan.name} atingido.`,
        )
      }
      const now = new Date().toISOString()
      const tab: Tab = {
        id: crypto.randomUUID(),
        name: input.name,
        folderId: input.folderId,
        instrumentConfig: input.instrumentConfig,
        content: null,
        bpm: 120,
        sound: DEFAULT_SOUND,
        isDeleted: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      setState((s) => ({ ...s, tabs: [...s.tabs, tab] }))
      return tab
    },
    [activeTabs.length, plan.maxTabs, plan.name],
  )

  const softDeleteTab = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, isDeleted: true, deletedAt: new Date().toISOString() } : t,
      ),
    }))
  }, [])

  const restoreTab = React.useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isDeleted: false, deletedAt: null } : t)),
    }))
  }, [])

  const updateTabContent = React.useCallback((id: string, content: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, updatedAt: new Date().toISOString() } : t,
      ),
    }))
  }, [])

  const updateTabBpm = React.useCallback((id: string, bpm: number) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, bpm, updatedAt: new Date().toISOString() } : t,
      ),
    }))
  }, [])

  const updateTabSound = React.useCallback((id: string, sound: number) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, sound, updatedAt: new Date().toISOString() } : t,
      ),
    }))
  }, [])

  const renameTab = React.useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, name, updatedAt: new Date().toISOString() } : t,
      ),
    }))
  }, [])

  const getTab = React.useCallback((id: string) => state.tabs.find((t) => t.id === id), [
    state.tabs,
  ])

  const value: LibraryContextValue = {
    user: state.user,
    folders: state.folders,
    tabs: state.tabs,
    activeFolders,
    activeTabs,
    trashedFolders,
    trashedTabs,
    activeFolderCount: activeFolders.length,
    activeTabCount: activeTabs.length,
    maxFolders: plan.maxFolders,
    maxTabs: plan.maxTabs,
    maxBarsPerTab: plan.maxBarsPerTab,
    createFolder,
    softDeleteFolder,
    restoreFolder,
    createTab,
    softDeleteTab,
    restoreTab,
    updateTabContent,
    updateTabBpm,
    updateTabSound,
    renameTab,
    getTab,
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const ctx = React.useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary deve ser usado dentro de LibraryProvider')
  return ctx
}
