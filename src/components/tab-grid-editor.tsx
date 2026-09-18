import * as React from 'react'

import { cn } from '@/lib/utils'
import { BEND_LABELS, DEFAULT_BEATS_PER_BAR, type BendData, type TabGrid } from '@/lib/tab-grid'
import { noteNameAtFret } from '@/lib/note-utils'
import type { InstrumentConfig } from '@/types'

const EFFECT_LABEL: Record<string, string> = {
  h: 'h',
  p: 'p',
  sl: '/',
  sib: '/',
  sia: '\\',
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

interface TabGridEditorProps {
  grid: TabGrid
  instrument: InstrumentConfig
  cursor: { col: number; string: number }
  digitBuffer: string
  onSelectCell?: (col: number, stringNo: number) => void
  beatsPerBar?: number
  showNoteNames?: boolean
}

export function TabGridEditor({
  grid,
  instrument,
  cursor,
  digitBuffer,
  onSelectCell,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
  showNoteNames = false,
}: TabGridEditorProps) {
  const stringsHighToLow = [...instrument.tuning].reverse()
  const cursorCellRef = React.useRef<HTMLTableCellElement>(null)

  React.useEffect(() => {
    cursorCellRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [cursor.col, cursor.string])

  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-card">
      <table className="border-collapse text-sm">
        <tbody>
          <tr>
            <td className="sticky left-0 z-10 w-10 shrink-0 border-r border-border bg-card" />
            {grid.columns.map((column, colIndex) => {
              const barStart = colIndex % beatsPerBar === 0 && colIndex > 0
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
                  return (
                    <td
                      key={colIndex}
                      ref={isCursor ? cursorCellRef : undefined}
                      onClick={() => onSelectCell?.(colIndex, stringNo)}
                      className={cn(
                        'h-10 w-10 min-h-10 cursor-pointer px-0 py-0.5 text-center align-middle font-mono border-b border-border',
                        barStart && 'border-l-2 border-l-border',
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
}
