import * as React from 'react'

import { cn } from '@/lib/utils'
import { BEND_LABELS, DEFAULT_BEATS_PER_BAR, type BendData, type TabGrid } from '@/lib/tab-grid'
import { noteNameAtFret } from '@/lib/note-utils'
import type { InstrumentConfig } from '@/types'

/** Pixel size of one grid column / the sticky corner column — must match the
 * `w-10` (2.5rem) classes on the `<td>`s below. Exported so the floating
 * selection pill can anchor itself to a column range using plain arithmetic
 * instead of measuring the DOM. */
export const GRID_COLUMN_WIDTH_PX = 40
export const GRID_CORNER_WIDTH_PX = 40

const EFFECT_LABEL: Record<string, string> = {
  h: 'h',
  p: 'p',
  sl: '/',
  sib: '/',
  sia: '\\',
  sou: '↗',
  sod: '↘',
  pm: 'PM',
  v: '~',
  nh: 'nh',
  ph: 'PH',
  lr: 'LR',
}

function bendLabel(bend: BendData): string {
  const size = BEND_LABELS[bend.amount] ?? bend.amount
  return bend.kind === 'prebend' ? `PB ${size} ↓` : `b ${size} ↑`
}

/** alphaTab has no separate alphaTex tag for pull-off — `h` and `p` both
 * compile to the same `{h}` tag, and alphaTab renders whichever letter
 * actually matches the pitch change to the *next* note on the same string
 * (fret comparison on the tab staff), ignoring which of the two the player
 * chose. Mirroring that comparison here (rather than trusting the stored
 * 'h'/'p') keeps this grid's label from silently lying about what the
 * notation preview will actually show — e.g. a note marked "pull-off" whose
 * next note on the string is actually higher renders as a hammer-on. */
function hammerPullLabel(grid: TabGrid, colIndex: number, stringNo: number, fret: number): string | null {
  for (let i = colIndex + 1; i < grid.columns.length; i++) {
    const destCell = grid.columns[i].cells[stringNo]
    if (destCell && !destCell.dead) return destCell.fret >= fret ? 'h' : 'p'
  }
  // No later note on this string for alphaTab to slur into — it silently
  // drops the effect in this case, so no label should render either.
  return null
}

export interface GridSelection {
  start: number
  end: number
}

interface TabGridEditorProps {
  grid: TabGrid
  instrument: InstrumentConfig
  cursor: { col: number; string: number }
  digitBuffer: string
  onSelectCell?: (col: number, stringNo: number) => void
  beatsPerBar?: number
  showNoteNames?: boolean
  /** Column currently sounding during playback (from alphaTab's
   * `activeBeatsChanged`), if any — distinct from `cursor`, which is where
   * the user is editing. Highlights that column plus the rest of its bar. */
  activeColumn?: number | null
  /** Column range selected by click-hold-drag, if any — shaded across every
   * string, independent of the single-cell `cursor`. */
  selection?: GridSelection | null
  onCellMouseDown?: (col: number) => void
  onCellMouseEnter?: (col: number) => void
  onCellMouseUp?: () => void
  /** Attached to the horizontally-scrolling wrapper so the selection pill
   * (rendered by the parent, outside this memoized component) can anchor
   * itself to the selection's on-screen position. */
  scrollContainerRef?: React.Ref<HTMLDivElement>
}

// The grid renders one <td> per string per beat, so a full re-render can mean
// hundreds of cells — memoized because during playback the page re-renders on
// every throttled position tick, and none of that touches this component's
// props except `activeColumn` (and even that only a few times a second).
// Re-rendering it anyway measurably competed with audio playback for the
// main thread and caused audible crackling.
export const TabGridEditor = React.memo(function TabGridEditor({
  grid,
  instrument,
  cursor,
  digitBuffer,
  onSelectCell,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
  showNoteNames = false,
  activeColumn = null,
  selection = null,
  onCellMouseDown,
  onCellMouseEnter,
  onCellMouseUp,
  scrollContainerRef,
}: TabGridEditorProps) {
  const activeBarStart =
    activeColumn != null ? Math.floor(activeColumn / beatsPerBar) * beatsPerBar : null
  const stringsHighToLow = [...instrument.tuning].reverse()
  const cursorCellRef = React.useRef<HTMLTableCellElement>(null)

  React.useEffect(() => {
    cursorCellRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [cursor.col, cursor.string])

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-card"
    >
      <table className="border-collapse text-sm">
        <tbody>
          <tr>
            <td className="sticky left-0 z-10 w-10 shrink-0 border-r border-border bg-card" />
            {grid.columns.map((column, colIndex) => {
              const barStart = colIndex % beatsPerBar === 0 && colIndex > 0
              const inActiveBar =
                activeBarStart !== null &&
                colIndex >= activeBarStart &&
                colIndex < activeBarStart + beatsPerBar
              const inSelection = selection !== null && colIndex >= selection.start && colIndex <= selection.end
              const stroke = column.beatEffects.includes('su')
                ? '↑'
                : column.beatEffects.includes('sd')
                  ? '↓'
                  : ''
              return (
                <td
                  key={colIndex}
                  className={cn(
                    'h-4 w-10 px-0 py-0 text-center align-middle text-xs leading-none font-bold text-primary',
                    barStart && 'border-l-2 border-l-border',
                    inActiveBar && 'bg-accent/10',
                    colIndex === activeColumn && 'bg-accent/25',
                    inSelection && 'bg-primary/15',
                  )}
                >
                  {stroke}
                </td>
              )
            })}
          </tr>
          {stringsHighToLow.map((openNote, idx) => {
            const stringNo = idx + 1
            return (
              <tr key={stringNo}>
                <td className="sticky left-0 z-10 w-10 shrink-0 border-r border-border bg-card px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                  {openNote}
                </td>
                {grid.columns.map((column, colIndex) => {
                  const isCursor = cursor.col === colIndex && cursor.string === stringNo
                  const cell = column.cells[stringNo]
                  const barStart = colIndex % beatsPerBar === 0 && colIndex > 0
                  const inActiveBar =
                    activeBarStart !== null &&
                    colIndex >= activeBarStart &&
                    colIndex < activeBarStart + beatsPerBar
                  const inSelection =
                    selection !== null && colIndex >= selection.start && colIndex <= selection.end
                  return (
                    <td
                      key={colIndex}
                      ref={isCursor ? cursorCellRef : undefined}
                      onClick={() => onSelectCell?.(colIndex, stringNo)}
                      onMouseDown={() => onCellMouseDown?.(colIndex)}
                      onMouseEnter={() => onCellMouseEnter?.(colIndex)}
                      onMouseUp={() => onCellMouseUp?.()}
                      className={cn(
                        'h-10 w-10 min-h-10 cursor-pointer px-0 py-0.5 text-center align-middle font-mono border-b border-border select-none',
                        barStart && 'border-l-2 border-l-border',
                        inActiveBar && 'bg-accent/10',
                        colIndex === activeColumn && 'bg-accent/25',
                        inSelection && 'bg-primary/15',
                      )}
                    >
                      <div
                        className={cn(
                          'mx-0.5 flex min-h-8 w-9 flex-col items-center justify-center gap-0.5 rounded',
                          isCursor && 'bg-primary/20 ring-2 ring-primary',
                        )}
                      >
                        <span className={cn(cell ? 'text-foreground' : 'text-muted-foreground/40')}>
                          {isCursor && digitBuffer
                            ? digitBuffer
                            : cell?.dead
                              ? 'X'
                              : (cell?.fret ?? (isCursor ? '' : '·'))}
                        </span>
                        {cell && cell.effects.length > 0 && (() => {
                          const labels = cell.effects
                            .map((e) => {
                              if (e === 'h' || e === 'p') {
                                const real = hammerPullLabel(grid, colIndex, stringNo, cell.fret)
                                return real ? EFFECT_LABEL[real] : null
                              }
                              return EFFECT_LABEL[e] ?? e
                            })
                            .filter((label): label is string => label !== null)
                          return (
                            labels.length > 0 && (
                              <span className="text-[9px] leading-none text-primary">
                                {labels.join(' ')}
                              </span>
                            )
                          )
                        })()}
                        {cell?.bend && (
                          <span className="text-[9px] leading-none text-primary">
                            {bendLabel(cell.bend)}
                          </span>
                        )}
                        {showNoteNames && cell && !cell.dead && (
                          <span className="text-[9px] leading-none text-muted-foreground">
                            {noteNameAtFret(openNote, cell.fret)}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
