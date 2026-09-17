import type { Plan, PlanName } from '@/types'

export const PLANS: Record<PlanName, Plan> = {
  free: { name: 'free', maxTabs: 5, maxFolders: 2, maxBarsPerTab: 100 },
  pro: { name: 'pro', maxTabs: 50, maxFolders: 20, maxBarsPerTab: 500 },
  musico: { name: 'musico', maxTabs: 200, maxFolders: 100, maxBarsPerTab: 2000 },
}

// Ordenado da corda mais grave para a mais aguda.
export const DEFAULT_TUNING_BY_STRINGS: Record<number, string[]> = {
  4: ['E', 'A', 'D', 'G'],
  5: ['B', 'E', 'A', 'D', 'G'],
  6: ['E', 'A', 'D', 'G', 'B', 'E'],
  7: ['B', 'E', 'A', 'D', 'G', 'B', 'E'],
  8: ['F#', 'B', 'E', 'A', 'D', 'G', 'B', 'E'],
  9: ['C#', 'F#', 'B', 'E', 'A', 'D', 'G', 'B', 'E'],
}
