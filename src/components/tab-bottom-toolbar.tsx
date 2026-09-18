import { LayoutMode } from '@coderline/alphatab'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Guitar,
  HelpCircle,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Save,
  Settings2,
  StretchHorizontal,
  WrapText,
  X,
} from 'lucide-react'

import { ShortcutsPanel } from '@/components/shortcuts-panel'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BEATS_PER_BAR_OPTIONS, SOUND_OPTIONS } from '@/lib/tab-grid'
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
  layoutMode: LayoutMode
  onToggleLayoutMode: () => void
  sound: number
  onSoundChange: (sound: number) => void
  beatsPerBar: number
  onBeatsPerBarChange: (beatsPerBar: number) => void
  showScore: boolean
  onToggleShowScore: () => void
  showNoteNames: boolean
  onToggleShowNoteNames: () => void
  letRingParens: boolean
  onToggleLetRingParens: () => void
  isLooping: boolean
  onToggleLoop: () => void
  hasSelection: boolean
  onClearSelection: () => void
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
  layoutMode,
  onToggleLayoutMode,
  sound,
  onSoundChange,
  beatsPerBar,
  onBeatsPerBarChange,
  showScore,
  onToggleShowScore,
  showNoteNames,
  onToggleShowNoteNames,
  letRingParens,
  onToggleLetRingParens,
  isLooping,
  onToggleLoop,
  hasSelection,
  onClearSelection,
}: TabBottomToolbarProps) {
  const isHorizontal = layoutMode === LayoutMode.Horizontal
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

        <Button
          variant={isLooping ? 'secondary' : 'ghost'}
          size="icon"
          className="rounded-full"
          onClick={onToggleLoop}
          aria-label="Repetir em loop"
          title={
            hasSelection
              ? 'Repetir em loop o trecho marcado'
              : 'Repetir a música inteira em loop'
          }
        >
          <Repeat />
        </Button>

        {hasSelection && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onClearSelection}
            aria-label="Remover marcação do trecho"
            title="Remover marcação do trecho"
          >
            <X />
          </Button>
        )}

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

        <Select value={String(beatsPerBar)} onValueChange={(v) => onBeatsPerBarChange(Number(v))}>
          <SelectTrigger
            className="h-9 w-16 justify-center rounded-full border-none px-2 shadow-none"
            aria-label="Fórmula de compasso"
            title="Fórmula de compasso"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="center">
            {BEATS_PER_BAR_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}/4
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onToggleLayoutMode}
          aria-label="Alternar layout da partitura"
          title={
            isHorizontal
              ? 'Layout horizontal (clique para quebrar compassos para baixo)'
              : 'Compassos quebram para baixo (clique para layout horizontal)'
          }
        >
          {isHorizontal ? <StretchHorizontal /> : <WrapText />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Opções de visualização"
              title="Opções de visualização"
            >
              <Settings2 />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuLabel>Visualização</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showScore} onCheckedChange={onToggleShowScore}>
              Mostrar partitura
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showNoteNames}
              onCheckedChange={onToggleShowNoteNames}
            >
              Mostrar nome das notas
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={letRingParens}
              onCheckedChange={onToggleLetRingParens}
            >
              Let ring com parênteses
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={String(sound)} onValueChange={(v) => onSoundChange(Number(v))}>
          <SelectTrigger
            className="h-9 w-9 justify-center rounded-full border-none p-0 shadow-none [&>svg:last-child]:hidden"
            aria-label="Som da reprodução"
            title="Som da reprodução"
          >
            <Music className="size-4" />
            {/* SelectValue ignores className (Radix quirk) — wrap it instead. */}
            <span className="sr-only">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent align="center">
            {SOUND_OPTIONS.map((opt) => (
              <SelectItem key={opt.program} value={String(opt.program)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
              'invisible absolute right-0 bottom-full mb-3 max-h-[min(26rem,70vh)] w-[min(26rem,calc(100vw-2rem))]',
              '-translate-y-1 overflow-y-auto rounded-lg border border-border bg-popover p-3 opacity-0 shadow-lg',
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
