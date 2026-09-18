import * as React from 'react'
import { Check, Copy, Gauge, Play, Trash2, X } from 'lucide-react'

import { GRID_COLUMN_WIDTH_PX, GRID_CORNER_WIDTH_PX, type GridSelection } from '@/components/tab-grid-editor'
import { Button } from '@/components/ui/button'
import { effectiveBpmAtBar, type TempoChange } from '@/lib/tab-grid'
import { cn } from '@/lib/utils'

const COPIED_FEEDBACK_MS = 1200

interface GridSelectionPillProps {
  selection: GridSelection
  beatsPerBar: number
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  baseBpm: number
  minBpm: number
  maxBpm: number
  tempoChanges: TempoChange[]
  onSetTempo: (bpm: number | null) => void
  onPlay: () => void
  onCopy: () => void
  onDelete: () => void
  onClose: () => void
}

export function GridSelectionPill({
  selection,
  beatsPerBar,
  scrollContainerRef,
  baseBpm,
  minBpm,
  maxBpm,
  tempoChanges,
  onSetTempo,
  onPlay,
  onCopy,
  onDelete,
  onClose,
}: GridSelectionPillProps) {
  const [panel, setPanel] = React.useState<'menu' | 'bpm'>('menu')
  const [copied, setCopied] = React.useState(false)
  const [scrollLeft, setScrollLeft] = React.useState(0)
  const copiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => setScrollLeft(el.scrollLeft)
    onScroll()
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollContainerRef])

  React.useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    }
  }, [])

  const startBar = Math.floor(selection.start / beatsPerBar)
  const endBar = Math.floor(selection.end / beatsPerBar)
  const existing = tempoChanges.find((tc) => tc.startBar === startBar && tc.endBar === endBar)
  const barsLabel = startBar === endBar ? `Compasso ${startBar + 1}` : `Compassos ${startBar + 1}–${endBar + 1}`

  const centerPx =
    GRID_CORNER_WIDTH_PX +
    (selection.start + (selection.end - selection.start + 1) / 2) * GRID_COLUMN_WIDTH_PX -
    scrollLeft

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  const commitBpm = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      onSetTempo(null)
    } else {
      const parsed = Math.round(Number(trimmed))
      if (!Number.isNaN(parsed)) onSetTempo(Math.min(maxBpm, Math.max(minBpm, parsed)))
    }
    setPanel('menu')
  }

  return (
    <div
      className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover p-1 shadow-lg"
      style={{ left: `${centerPx}px`, top: '-2.75rem' }}
      // Selecting inside the pill (e.g. the BPM input) shouldn't start a new
      // grid drag-selection — the grid's mousedown handler lives on the <td>s
      // underneath, so stopping propagation here is enough.
      onMouseDown={(e) => e.stopPropagation()}
    >
      {panel === 'bpm' ? (
        <>
          <input
            type="number"
            autoFocus
            min={minBpm}
            max={maxBpm}
            defaultValue={existing?.bpm ?? effectiveBpmAtBar(tempoChanges, startBar, baseBpm)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setPanel('menu')
            }}
            onBlur={(e) => commitBpm(e.target.value)}
            className="h-7 w-16 rounded-full border border-border bg-background px-2 text-center font-mono text-xs tabular-nums"
            aria-label={`Andamento para ${barsLabel}`}
          />
          {existing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => {
                onSetTempo(null)
                setPanel('menu')
              }}
              aria-label="Remover mudança de andamento"
              title="Remover mudança de andamento"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </>
      ) : (
        <>
          <span className="pl-2 pr-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
            {barsLabel}
          </span>
          <Button
            variant={existing ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setPanel('bpm')}
            aria-label="Mudar andamento deste trecho"
            title={existing ? `Andamento: ${existing.bpm} BPM neste trecho` : 'Mudar andamento deste trecho'}
          >
            <Gauge className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onPlay}
            aria-label="Reproduzir este trecho em loop"
            title="Reproduzir este trecho em loop"
          >
            <Play className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7 rounded-full', copied && 'text-primary')}
            onClick={handleCopy}
            aria-label="Copiar trecho selecionado"
            title="Copiar (cole com Ctrl+V no cursor)"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onDelete}
            aria-label="Apagar trecho selecionado"
            title="Apagar trecho selecionado"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onClose}
            aria-label="Cancelar seleção"
            title="Cancelar seleção"
          >
            <X className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}
