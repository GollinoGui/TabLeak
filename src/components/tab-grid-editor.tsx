import * as React from 'react'

import { cn } from '@/lib/utils'
import { BEND_LABELS, type BendData, type TabGrid } from '@/lib/tab-grid'
import type { InstrumentConfig } from '@/types'

const EFFECT_LABEL: Record<string, string> = {
  h: 'h',
  p: 'p',
  sl: '/',
  pm: 'PM',
  v: '~',
  nh: 'nh',
}

function bendLabel(bend: BendData): string {
  const size = BEND_LABELS[bend.amount] ?? bend.amount
  return bend.kind === 'prebend' ? `PB ${size} ↓` : `b ${size} ↑`
}

interface TabGridEditorProps {
  grid: TabGrid
  instrument: InstrumentConfig
  cursor: { col: number; string: number }
  digitBuffer: string
  onSelectCell?: (col: number, stringNo: number) => void
}

export function TabGridEditor({
  grid,
  instrument,
  cursor,
  digitBuffer,
  onSelectCell,
}: TabGridEditorProps) {
  const stringsHighToLow = [...instrument.tuning].reverse()
  const cursorCellRef = React.useRef<HTMLTableCellElement>(null)

  React.useEffect(() => {
    cursorCellRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [cursor.col, cursor.string])

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="border-collapse text-sm">
        <tbody>
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
                  const barStart = colIndex % 4 === 0 && colIndex > 0
                  return (
                    <td
                      key={colIndex}
                      ref={isCursor ? cursorCellRef : undefined}
                      onClick={() => onSelectCell?.(colIndex, stringNo)}
                      className={cn(
                        'h-10 w-10 cursor-pointer px-0 py-0 text-center align-middle font-mono border-b border-border',
                        barStart && 'border-l-2 border-l-border',
                      )}
                    >
                      <div
                        className={cn(
                          'mx-0.5 flex h-8 w-9 flex-col items-center justify-center rounded',
                          isCursor && 'bg-primary/20 ring-2 ring-primary',
                        )}
                      >
                        <span className={cn(cell ? 'text-foreground' : 'text-muted-foreground/40')}>
                          {isCursor && digitBuffer
                            ? digitBuffer
                            : (cell?.fret ?? (isCursor ? '' : '·'))}
                        </span>
                        {cell && (cell.effects.length > 0 || cell.bend) && (
                          <span className="text-[9px] leading-none text-primary">
                            {[
                              ...cell.effects.map((e) => EFFECT_LABEL[e] ?? e),
                              ...(cell.bend ? [bendLabel(cell.bend)] : []),
                            ].join(' ')}
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
