import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { noteNameAtFret } from '@/lib/note-utils'
import { cn } from '@/lib/utils'

export const FRETBOARD_MAX_FRET = 15

interface FretboardPickerProps {
  tuningLowToHigh: string[]
  selection: { string: number; fret: number }
  onSelect: (stringNo: number, fret: number) => void
  onClose: () => void
}

export function FretboardPicker({
  tuningLowToHigh,
  selection,
  onSelect,
  onClose,
}: FretboardPickerProps) {
  const stringsHighToLow = [...tuningLowToHigh].reverse()

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Teclado virtual
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Fechar teclado virtual">
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <tbody>
            {stringsHighToLow.map((openNote, idx) => {
              const stringNo = idx + 1
              const isActiveRow = selection.string === stringNo
              return (
                <tr key={stringNo}>
                  <td
                    className={cn(
                      'sticky left-0 z-10 w-9 shrink-0 border-r border-border bg-card px-1.5 py-1 text-center font-mono text-muted-foreground',
                      isActiveRow && 'text-primary',
                    )}
                  >
                    {openNote}
                  </td>
                  {Array.from({ length: FRETBOARD_MAX_FRET + 1 }, (_, fret) => {
                    const isSelected = isActiveRow && selection.fret === fret
                    return (
                      <td key={fret} className="border-b border-border p-0.5">
                        <button
                          type="button"
                          onClick={() => onSelect(stringNo, fret)}
                          className={cn(
                            'flex h-7 w-8 items-center justify-center rounded font-mono transition-colors hover:bg-secondary',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : fret === 0
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground',
                          )}
                        >
                          {noteNameAtFret(openNote, fret)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Setas para navegar, Enter para inserir a nota, Esc para fechar.
      </p>
    </div>
  )
}
