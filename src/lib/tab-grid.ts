import { assignDescendingOctaves } from '@/lib/note-utils'
import type { InstrumentConfig } from '@/types'

/** Note-level alphaTex property tags this editor can attach to a fretted note.
 * `h` and `p` are visually distinct (hammer-on vs pull-off) but both compile to
 * alphaTex's single `h` tag — alphaTab infers the actual direction from pitch.
 * `sl` connects to the following note (its direction is inferred from pitch too).
 * `sib`/`sia` mark a slide with no defined starting fret — the note is entered
 * by sliding up from below (`sib`) or down from above (`sia`) an unspecified fret.
 * `lr` (let ring) marks the note as tied into the next occurrence of the same
 * pitch on the same string, so it keeps ringing instead of being cut off —
 * mark both the starting note and the note it rings into. See `effectToTex`
 * for why this compiles to a tie rather than alphaTex's own `lr` tag. */
export type NoteEffect = 'h' | 'p' | 'sl' | 'sib' | 'sia' | 'pm' | 'v' | 'nh' | 'lr'

/** Beat-level alphaTex property tags. `su`/`sd` mark the pick-stroke direction
 * (up/down) shown above the beat; they're mutually exclusive with each other. */
export type BeatEffect = 'tt' | 'su' | 'sd'

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

/** General MIDI program numbers for the playback timbres offered in the UI.
 * Same soundfont either way — this only changes which instrument patch (and
 * therefore articulation/tone) alphaTab's synth plays the notes with. */
export const SOUND_OPTIONS = [
  { program: 25, label: 'Violão de aço' },
  { program: 24, label: 'Violão de nylon' },
  { program: 27, label: 'Guitarra limpa' },
  { program: 28, label: 'Guitarra abafada' },
  { program: 29, label: 'Guitarra overdrive' },
  { program: 30, label: 'Guitarra distorcida' },
  { program: 33, label: 'Baixo (dedo)' },
  { program: 34, label: 'Baixo (palheta)' },
] as const

export const DEFAULT_SOUND = 25

export interface Cell {
  fret: number
  effects: NoteEffect[]
  bend?: BendData
  /** Dead/muted note — fretting hand mutes the string for a percussive thump
   * with no defined pitch. Renders as alphaTex's `x` fret marker instead of
   * `fret`, which is kept around so the picker/digit entry has a value to
   * fall back to if the note is un-muted later. */
  dead?: boolean
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
/** `lr` (let ring) compiles to a tie (`t`) rather than alphaTex's own `lr` tag:
 * `lr` draws as a "Let Ring" label plus a dashed line above the staff, but a
 * tie draws as a plain slur — visually identical to a hammer-on/pull-off arc,
 * just without the H/P letter — which reads much more clearly as "this note
 * keeps ringing into the next one" in a guitar tab. */
function effectToTex(effect: NoteEffect): string {
  if (effect === 'p') return 'h'
  if (effect === 'lr') return 't'
  return effect
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
    const fret = cell.dead ? 'x' : cell.fret
    return `${fret}.${stringNo}${effects}`
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
  sound = DEFAULT_SOUND,
): string {
  const tuning = tuningToAlphaTex(instrument.tuning)
  const header = [
    `\\title "${escapeTexString(tabName)}"`,
    `\\tempo ${bpm}`,
    `\\track "${escapeTexString(tabName)}"`,
    `\\instrument ${sound}`,
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

/** Tabs saved before bends carried an explicit size stored `'b'` directly in
 * `effects` (always rendered as a full-step bend-and-hold). Migrate that into
 * the current `bend` field so old saves keep rendering instead of producing
 * a bare `{b}` tag, which alphaTab's parser can't handle and aborts on. */
function migrateLegacyBend(grid: TabGrid): TabGrid {
  let changed = false
  const columns = grid.columns.map((column) => {
    let columnChanged = false
    const cells: Column['cells'] = {}
    for (const [stringNo, cell] of Object.entries(column.cells)) {
      const legacyEffects = cell.effects as string[]
      if (legacyEffects.includes('b')) {
        columnChanged = true
        cells[Number(stringNo)] = {
          ...cell,
          effects: cell.effects.filter((e) => (e as string) !== 'b'),
          bend: cell.bend ?? { kind: 'bend', amount: 4 },
        }
      } else {
        cells[Number(stringNo)] = cell
      }
    }
    if (!columnChanged) return column
    changed = true
    return { ...column, cells }
  })
  return changed ? { columns } : grid
}

export function deserializeGrid(content: string | null): TabGrid {
  if (!content) return createEmptyGrid()
  try {
    const parsed = JSON.parse(content) as TabGrid
    if (Array.isArray(parsed.columns)) return migrateLegacyBend(parsed)
  } catch {
    // fall through to empty grid
  }
  return createEmptyGrid()
}
