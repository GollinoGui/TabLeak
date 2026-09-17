import {
  Check,
  ChevronLeft,
  ChevronRight,
  Guitar,
  HelpCircle,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'

import { ShortcutsPanel } from '@/components/shortcuts-panel'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TabBottomToolbarProps {
  isPlaying: boolean
  onPlayPause: () => void
  onRestart: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onSave: () => void
  justSaved: boolean
  fretboardOpen: boolean
  onToggleFretboard: () => void
  bpm: number
  onBpmChange: (bpm: number) => void
  bpmStep: number
  minBpm: number
  maxBpm: number
}

export function TabBottomToolbar({
  isPlaying,
  onPlayPause,
  onRestart,
  onMoveLeft,
  onMoveRight,
  onSave,
  justSaved,
  fretboardOpen,
  onToggleFretboard,
  bpm,
  onBpmChange,
  bpmStep,
  minBpm,
  maxBpm,
}: TabBottomToolbarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onMoveLeft} aria-label="Mover para a esquerda">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onMoveRight} aria-label="Mover para a direita">
          <ChevronRight />
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onRestart}
          aria-label="Voltar ao início"
          title="Voltar ao início"
        >
          <RotateCcw />
        </Button>

        <Button onClick={onPlayPause} size="sm" className="rounded-full">
          {isPlaying ? <Pause /> : <Play />}
          {isPlaying ? 'Pausar' : 'Reproduzir'}
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-0.5 rounded-full bg-secondary/60 px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => onBpmChange(bpm - bpmStep)}
            disabled={bpm <= minBpm}
            aria-label="Diminuir BPM"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-14 text-center font-mono text-xs tabular-nums text-foreground" title="Andamento (BPM)">
            {bpm} BPM
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => onBpmChange(bpm + bpmStep)}
            disabled={bpm >= maxBpm}
            aria-label="Aumentar BPM"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <Button
          variant={fretboardOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="rounded-full"
          onClick={onToggleFretboard}
          aria-label="Teclado virtual"
          title="Teclado virtual"
        >
          <Guitar />
        </Button>

        <span className="mx-1 h-6 w-px bg-border" />

        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          className={cn('rounded-full', justSaved && 'text-primary')}
          onClick={onSave}
          aria-label="Salvar tablatura"
          title="Salvar"
        >
          {justSaved ? <Check /> : <Save />}
        </Button>

        <div className="group relative">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Atalhos de teclado">
            <HelpCircle />
          </Button>
          <div
            className={cn(
              'invisible absolute right-0 bottom-full mb-3 w-72 -translate-y-1 rounded-lg border border-border bg-popover p-3 opacity-0 shadow-lg',
              'transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100',
              'group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100',
            )}
          >
            <ShortcutsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
