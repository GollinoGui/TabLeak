import { assignDescendingOctaves } from '@/lib/note-utils'
import type { InstrumentConfig } from '@/types'

/** Note-level alphaTex property tags this editor can attach to a fretted note.
 * `h` and `p` are visually distinct (hammer-on vs pull-off) but both compile to
 * alphaTex's single `h` tag — alphaTab infers the actual direction from pitch. */
export type NoteEffect = 'h' | 'p' | 'sl' | 'pm' | 'v' | 'nh'

/** Beat-level alphaTex property tags. */
export type BeatEffect = 'tt'

/** A bend that rises into the note, vs. a pre-bend that starts already bent
 * and (optionally) releases down. */
export type BendKind = 'bend' | 'prebend'

/** Bend size in quarter-steps: 1 = 1/4, 2 = 1/2, 4 = full, 8 = two full steps. */
export interface BendData {
  kind: BendKind
  amount: number
}

/** Selectable bend sizes, in quarter-step units, from smallest to largest. */
export const BEND_STEPS = [1, 2, 3, 4, 6, 8] as const

export const BEND_LABELS: Record<number, string> = {
  1: '1/4',
  2: '1/2',
  3: '3/4',
  4: 'full',
  6: '1 1/2',
  8: '2x',
}

export interface Cell {
  fret: number
  effects: NoteEffect[]
  bend?: BendData
}

export interface Column {
  /** Keyed by alphaTex string number: 1 = highest-pitched string. */
  cells: Record<number, Cell>
  beatEffects: BeatEffect[]
}

export interface TabGrid {
  columns: Column[]
}

const BEATS_PER_BAR = 4

export function createEmptyGrid(bars = 4): TabGrid {
  return { columns: Array.from({ length: bars * BEATS_PER_BAR }, () => emptyColumn()) }
}

export function emptyColumn(): Column {
  return { cells: {}, beatEffects: [] }
}

export function barCount(grid: TabGrid): number {
  return Math.ceil(grid.columns.length / BEATS_PER_BAR) || 1
}

function escapeTexString(value: string): string {
  return value.replace(/"/g, "'")
}

/** Tuning stored low-to-high (as edited in the UI) reversed to alphaTex's
 * high-to-low (string 1 first) order, with octave numbers assigned. */
function tuningToAlphaTex(tuningLowToHigh: string[]): string {
  const highToLow = [...tuningLowToHigh].reverse()
  const withOctaves = assignDescendingOctaves(highToLow)
  return withOctaves.map((n) => `${n.name}${n.octave}`).join(' ')
}

/** `p` (pull-off) has no dedicated alphaTex tag — alphaTab derives hammer-on vs.
 * pull-off display from the pitch difference between notes, so both compile to `h`. */
function effectToTex(effect: NoteEffect): string {
  return effect === 'p' ? 'h' : effect
}

/** alphaTex requires the bend effect to carry explicit bend points; a bare
 * `{b}` fails semantic validation and aborts the whole render. Bend type
 * (bend / release / prebend / prebend-release / ...) is inferred by alphaTab
 * from the point values, so we only need to supply the value sequence:
 * a bend rises from unbent (0) to the target size, a pre-bend starts at the
 * target size and falls back to 0. */
function bendToTex(bend: BendData): string {
  return bend.kind === 'prebend' ? `b (${bend.amount} 0)` : `b (0 ${bend.amount})`
}

function columnToTex(column: Column): string {
  const entries = Object.entries(column.cells)
  if (entries.length === 0) return 'r'

  const notes = entries.map(([stringNo, cell]) => {
    const parts = [
      ...cell.effects.map(effectToTex),
      ...(cell.bend ? [bendToTex(cell.bend)] : []),
    ]
    const effects = parts.length ? `{${parts.join(' ')}}` : ''
    return `${cell.fret}.${stringNo}${effects}`
  })

  const body = notes.length > 1 ? `(${notes.join(' ')})` : notes[0]
  const beatEffects = column.beatEffects.length ? `{${column.beatEffects.join(' ')}}` : ''
  return body + beatEffects
}

export function gridToAlphaTex(
  tabName: string,
  instrument: InstrumentConfig,
  grid: TabGrid,
  bpm = 120,
): string {
  const tuning = tuningToAlphaTex(instrument.tuning)
  const header = [
    `\\title "${escapeTexString(tabName)}"`,
    `\\tempo ${bpm}`,
    `\\track "${escapeTexString(tabName)}"`,
    '\\staff{tabs}',
    `\\tuning (${tuning})`,
  ].join('\n')

  const bars: string[] = []
  for (let i = 0; i < grid.columns.length; i += BEATS_PER_BAR) {
    const barColumns = grid.columns.slice(i, i + BEATS_PER_BAR)
    bars.push(barColumns.map(columnToTex).join(' '))
  }
  if (bars.length === 0) bars.push('r r r r')

  return `${header}\n\n:4 ${bars.join(' | ')} |`
}

export function serializeGrid(grid: TabGrid): string {
  return JSON.stringify(grid)
}

export function deserializeGrid(content: string | null): TabGrid {
  if (!content) return createEmptyGrid()
  try {
    const parsed = JSON.parse(content) as TabGrid
    if (Array.isArray(parsed.columns)) return parsed
  } catch {
    // fall through to empty grid
  }
  return createEmptyGrid()
}
