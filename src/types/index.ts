export type PlanName = 'free' | 'pro' | 'musico'

export interface Plan {
  name: PlanName
  maxTabs: number
  maxFolders: number
  maxBarsPerTab: number
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl?: string
  plan: PlanName
}

export interface InstrumentConfig {
  strings: number
  tuning: string[]
  gauge: string
}

export interface Folder {
  id: string
  name: string
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
}

export interface Tab {
  id: string
  name: string
  folderId: string | null
  instrumentConfig: InstrumentConfig
  content: string | null
  bpm: number
  /** General MIDI program number (0-127) used for audio playback. Optional
   * because tabs saved before this feature existed don't have it — callers
   * fall back to a default. */
  sound?: number
  /** Beats per bar (time signature numerator, denominator fixed at 4). Optional
   * because tabs saved before this feature existed don't have it — callers
   * fall back to 4. */
  beatsPerBar?: number
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
