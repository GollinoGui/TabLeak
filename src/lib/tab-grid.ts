import { assignDescendingOctaves } from '@/lib/note-utils'
import type { InstrumentConfig } from '@/types'

/** Note-level alphaTex property tags this editor can attach to a fretted note.
 * `h` and `p` are visually distinct (hammer-on vs pull-off) but both compile to
 * alphaTex's single `h` tag — alphaTab infers the actual direction from pitch.
 * `sl` connects to the following note (its direction is inferred from pitch too).
 * `sib`/`sia` mark a slide with no defined starting fret — the note is entered
 * by sliding up from below (`sib`) or down from above (`sia`) an unspecified fret.
 * `sou`/`sod` mark a slide *out* with no defined landing fret — the finger
 * slides off the fretboard upward (`sou`) or downward (`sod`) after the note,
 * the mirror image of `sib`/`sia`. Mutually exclusive with `sl`/each other,
 * same as `sib`/`sia` are with each other — a note only slides out one way.
 * `lr` (let ring) marks the note as tied into the next occurrence of the same
 * pitch on the same string, so it keeps ringing instead of being cut off —
 * mark both the starting note and the note it rings into. See `effectToTex`
 * for why this compiles to a tie rather than alphaTex's own `lr` tag. */
export type NoteEffect =
  | 'h'
  | 'p'
  | 'sl'
  | 'sib'
  | 'sia'
  | 'sou'
  | 'sod'
  | 'pm'
  | 'v'
  | 'nh'
  | 'ph'
  | 'lr'

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

/** A tempo override bounded to `[startBar, endBar]` (inclusive) — playback
 * reverts to whatever tempo was in effect before `startBar` as soon as
 * `endBar` ends. Bounded (rather than "from here to the end of the piece")
 * so that raising the tab's base BPM always speeds up every bar that isn't
 * explicitly overridden, instead of a stale override silently continuing to
 * dictate most of the piece's actual playback speed. */
export interface TempoChange {
  startBar: number
  endBar: number
  bpm: number
}

export interface TabGrid {
  columns: Column[]
  tempoChanges?: TempoChange[]
}

export const DEFAULT_BEATS_PER_BAR = 4

/** Selectable time signatures. Denominator is fixed at a quarter note — the
 * grid's columns are always one quarter note each (see the global `:4` in
 * `gridToAlphaTex`), so only the numerator (beats per bar) is configurable.
 * Signatures like 6/8 would need a different note-duration unit for the
 * whole grid, which is out of scope for now. */
export const BEATS_PER_BAR_OPTIONS = [2, 3, 4, 5, 6] as const

export function createEmptyGrid(bars = 4, beatsPerBar = DEFAULT_BEATS_PER_BAR): TabGrid {
  return { columns: Array.from({ length: bars * beatsPerBar }, () => emptyColumn()), tempoChanges: [] }
}

/** The tempo in effect at `bar` — the override covering it, if any, otherwise
 * the tab's base BPM. Overlapping ranges shouldn't exist (see
 * `setTempoChangeForRange`), so at most one covers any given bar. */
export function effectiveBpmAtBar(tempoChanges: TempoChange[], bar: number, baseBpm: number): number {
  const covering = tempoChanges.find((tc) => bar >= tc.startBar && bar <= tc.endBar)
  return covering ? covering.bpm : baseBpm
}

/** Sets (or, with `bpm: null`, clears) the tempo override covering
 * `[startBar, endBar]`. Any existing override that overlaps this range is
 * replaced outright rather than clipped — ranges never partially overlap. */
export function setTempoChangeForRange(
  grid: TabGrid,
  startBar: number,
  endBar: number,
  bpm: number | null,
): TabGrid {
  const existing = grid.tempoChanges ?? []
  const withoutOverlap = existing.filter((tc) => tc.endBar < startBar || tc.startBar > endBar)
  if (bpm === null) return { ...grid, tempoChanges: withoutOverlap }
  return {
    ...grid,
    tempoChanges: [...withoutOverlap, { startBar, endBar, bpm }].sort((a, b) => a.startBar - b.startBar),
  }
}

export function emptyColumn(): Column {
  return { cells: {}, beatEffects: [] }
}

export function barCount(grid: TabGrid, beatsPerBar = DEFAULT_BEATS_PER_BAR): number {
  return Math.ceil(grid.columns.length / beatsPerBar) || 1
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
function effectToTex(effect: Exclude<NoteEffect, 'lr'>): string {
  if (effect === 'p') return 'h'
  return effect
}

/** `lr` (let ring) has two rendering styles in the wild, both kept as a global
 * display toggle (`letRingParens`) rather than per-note, since which one a
 * given tab uses is a style choice, not something that varies note to note:
 *
 * - With parens: the note is marked as a tied note (alphaTab's own `t` tag,
 *   same as the app already used before this toggle existed). alphaTab only
 *   ever shows a tied note's fret number — in parens — when it falls on the
 *   first beat of a bar or carries a bend; everywhere else a tied note
 *   renders with no number at all, just the slur curve into it.
 * - Without parens: the ringing note is marked with alphaTab's native `lr`
 *   tag instead (drawn as a dashed "let ring" line above the staff), and the
 *   note(s) it rings into are left as plain, untagged notes — so their fret
 *   number always shows normally, never in parens.
 *
 * `lrOpenByString` tracks, per string, whether the previous `lr`-marked note
 * on that string is still waiting for its "rings into" note — i.e. whether
 * the *next* `lr`-marked note on that string is the origin of a new pair or
 * the destination completing the current one. Only relevant to the
 * without-parens style; the parens style tags every `lr` note the same way
 * regardless of position, matching the original implementation exactly. */
function letRingTag(
  stringNo: number,
  letRingParens: boolean,
  lrOpenByString: Set<number>,
): string | null {
  if (letRingParens) return 't'
  if (lrOpenByString.has(stringNo)) {
    lrOpenByString.delete(stringNo)
    return null
  }
  lrOpenByString.add(stringNo)
  return 'lr'
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

function columnToTex(
  column: Column,
  letRingParens: boolean,
  lrOpenByString: Set<number>,
): string {
  const entries = Object.entries(column.cells)
  if (entries.length === 0) return 'r'

  const notes = entries.map(([stringNoStr, cell]) => {
    const stringNo = Number(stringNoStr)
    const isLetRing = cell.effects.includes('lr')
    const lrTag = isLetRing ? letRingTag(stringNo, letRingParens, lrOpenByString) : null
    const parts = [
      ...cell.effects.filter((e): e is Exclude<NoteEffect, 'lr'> => e !== 'lr').map(effectToTex),
      ...(lrTag ? [lrTag] : []),
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

/** Bass-range instruments (4/5 strings, e.g. standard bass tunings) read in
 * bass (F4) clef on the standard notation staff; everything else (6+ string
 * guitars) reads in treble (G2) clef. There's no explicit "is this a bass"
 * flag on `InstrumentConfig`, so string count is the closest available proxy. */
function clefFor(instrument: InstrumentConfig): string {
  return instrument.strings <= 5 ? 'F4' : 'G2'
}

export function gridToAlphaTex(
  tabName: string,
  instrument: InstrumentConfig,
  grid: TabGrid,
  bpm = 120,
  sound = DEFAULT_SOUND,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
  showScore = false,
  letRingParens = true,
): string {
  const tuning = tuningToAlphaTex(instrument.tuning)
  const header = [
    `\\title "${escapeTexString(tabName)}"`,
    `\\tempo ${bpm}`,
    `\\track "${escapeTexString(tabName)}"`,
    `\\instrument ${sound}`,
    showScore ? '\\staff{score tabs}' : '\\staff{tabs}',
    `\\tuning (${tuning})`,
  ].join('\n')

  // Bar-scoped `\tempo` directives change alphaTab's playback tempo starting
  // at that bar — how per-section speed-up/slow-down markers reach the
  // player. Emitted only where the effective tempo actually changes from the
  // previous bar, so a bounded `TempoChange` naturally gets a second
  // directive reverting to the base BPM right after it ends.
  const tempoChanges = grid.tempoChanges ?? []

  const bars: string[] = []
  const lrOpenByString = new Set<number>()
  let previousEffectiveBpm = bpm
  for (let i = 0; i < grid.columns.length; i += beatsPerBar) {
    const barIndex = i / beatsPerBar
    const barColumns = grid.columns.slice(i, i + beatsPerBar)
    const effectiveBpm = effectiveBpmAtBar(tempoChanges, barIndex, bpm)
    const tempoPrefix = effectiveBpm !== previousEffectiveBpm ? `\\tempo ${effectiveBpm} ` : ''
    previousEffectiveBpm = effectiveBpm
    bars.push(tempoPrefix + barColumns.map((c) => columnToTex(c, letRingParens, lrOpenByString)).join(' '))
  }
  if (bars.length === 0) bars.push(Array.from({ length: beatsPerBar }, () => 'r').join(' '))

  // Clef/time signature meta only needs to appear once, at the very start —
  // it stays in effect for the rest of the piece until changed again. They
  // must come before the `:4` global default-duration shorthand — alphaTex's
  // parser rejects a meta tag once it's inside note-content mode.
  const meta = `\\clef ${clefFor(instrument)} \\ts (${beatsPerBar} 4)`

  return `${header}\n\n${meta} :4 ${bars.join(' | ')} |`
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
