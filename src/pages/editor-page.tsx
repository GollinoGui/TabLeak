import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { FRETBOARD_MAX_FRET, FretboardPicker } from '@/components/fretboard-picker'
import { TabBottomToolbar } from '@/components/tab-bottom-toolbar'
import { TabGridEditor } from '@/components/tab-grid-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAlphaTab } from '@/hooks/use-alpha-tab'
import {
  BEND_STEPS,
  type BeatEffect,
  type BendData,
  type BendKind,
  type NoteEffect,
  type TabGrid,
  barCount,
  deserializeGrid,
  gridToAlphaTex,
  serializeGrid,
} from '@/lib/tab-grid'
import { fretForNote, normalizeNoteName } from '@/lib/note-utils'
import { useLibrary } from '@/store/library-store'

const BEATS_PER_BAR = 4
const DIGIT_COMMIT_MS = 550
const AUTOSAVE_MS = 1500
const SAVED_FEEDBACK_MS = 1500
const NOTE_LETTERS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
const MIN_BPM = 30
const MAX_BPM = 300
const BPM_STEP = 5

export function EditorPage() {
  const { tabId } = useParams<{ tabId: string }>()
  const { getTab, updateTabContent, updateTabBpm, renameTab, maxBarsPerTab } = useLibrary()
  const tab = tabId ? getTab(tabId) : undefined

  const containerRef = React.useRef<HTMLDivElement>(null)
  const { setTex, playPause, stop, isPlaying, error: alphaTabError } = useAlphaTab(containerRef)

  const [grid, setGrid] = React.useState<TabGrid>(() => deserializeGrid(tab?.content ?? null))
  const [bpm, setBpm] = React.useState(tab?.bpm ?? 120)
  const [cursor, setCursor] = React.useState({ col: 0, string: 1 })
  const [digitBuffer, setDigitBuffer] = React.useState('')
  const [noteNameMode, setNoteNameMode] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(tab?.name ?? '')
  const [justSaved, setJustSaved] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickerSelection, setPickerSelection] = React.useState({ string: 1, fret: 0 })
  const digitTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNoteRef = React.useRef<{ col: number; string: number; letter: string } | null>(null)
  const pendingNoteTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const stringCount = tab?.instrumentConfig.strings ?? 6
  const bars = barCount(grid)
  const atBarLimit = bars >= maxBarsPerTab

  // Regenerate the AlphaTab render whenever the underlying grid or tempo changes.
  React.useEffect(() => {
    if (!tab) return
    setTex(gridToAlphaTex(tab.name, tab.instrumentConfig, grid, bpm))
  }, [grid, bpm, tab, setTex])

  // Keep the notation preview scrolled to where the cursor currently is.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) return
    const totalCols = Math.max(grid.columns.length - 1, 1)
    el.scrollTo({ left: (cursor.col / totalCols) * maxScroll, behavior: 'smooth' })
  }, [cursor.col, grid.columns.length])

  // Debounced autosave.
  React.useEffect(() => {
    if (!tab) return
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    autosaveTimeoutRef.current = setTimeout(() => {
      updateTabContent(tab.id, serializeGrid(grid))
      if (bpm !== tab.bpm) updateTabBpm(tab.id, bpm)
    }, AUTOSAVE_MS)
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, bpm, tab?.id])

  React.useEffect(() => {
    return () => {
      if (savedFeedbackTimeoutRef.current) clearTimeout(savedFeedbackTimeoutRef.current)
      if (pendingNoteTimeoutRef.current) clearTimeout(pendingNoteTimeoutRef.current)
    }
  }, [])

  const commitDigitBuffer = React.useCallback(() => {
    setDigitBuffer((buffer) => {
      if (buffer) {
        const fret = Number(buffer)
        setGrid((g) => setCellFret(g, cursor.col, cursor.string, fret))
      }
      return ''
    })
    if (digitTimeoutRef.current) {
      clearTimeout(digitTimeoutRef.current)
      digitTimeoutRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.col, cursor.string])

  const ensureColumn = React.useCallback(
    (col: number) => {
      setGrid((g) => {
        if (col < g.columns.length) return g
        const barsNeeded = Math.ceil((col + 1) / BEATS_PER_BAR)
        if (barsNeeded > maxBarsPerTab) return g
        const extra = barsNeeded * BEATS_PER_BAR - g.columns.length
        if (extra <= 0) return g
        return { columns: [...g.columns, ...Array.from({ length: extra }, emptyColumnLocal)] }
      })
    },
    [maxBarsPerTab],
  )

  const moveCursor = React.useCallback(
    (delta: number) => {
      commitDigitBuffer()
      if (delta > 0) {
        const next = cursor.col + delta
        ensureColumn(next)
        setCursor((c) => ({ ...c, col: Math.min(next, maxBarsPerTab * BEATS_PER_BAR - 1) }))
      } else {
        setCursor((c) => ({ ...c, col: Math.max(0, c.col + delta) }))
      }
    },
    [cursor.col, commitDigitBuffer, ensureColumn, maxBarsPerTab],
  )

  const handleSelectCell = React.useCallback(
    (col: number, stringNo: number) => {
      commitDigitBuffer()
      ensureColumn(col)
      setCursor({ col, string: stringNo })
    },
    [commitDigitBuffer, ensureColumn],
  )

  const commitPick = React.useCallback(
    (stringNo: number, fret: number) => {
      setGrid((g) => setCellFret(g, cursor.col, stringNo, fret))
      setPickerSelection({ string: stringNo, fret })
      const next = cursor.col + 1
      ensureColumn(next)
      setCursor(() => ({ col: Math.min(next, maxBarsPerTab * BEATS_PER_BAR - 1), string: stringNo }))
    },
    [cursor.col, ensureColumn, maxBarsPerTab],
  )

  const toggleFretboard = React.useCallback(() => {
    commitDigitBuffer()
    setPickerOpen((open) => {
      if (!open) setPickerSelection({ string: cursor.string, fret: 0 })
      return !open
    })
  }, [cursor.string, commitDigitBuffer])

  const handleManualSave = React.useCallback(() => {
    if (!tab) return
    commitDigitBuffer()
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    updateTabContent(tab.id, serializeGrid(grid))
    if (bpm !== tab.bpm) updateTabBpm(tab.id, bpm)
    setJustSaved(true)
    if (savedFeedbackTimeoutRef.current) clearTimeout(savedFeedbackTimeoutRef.current)
    savedFeedbackTimeoutRef.current = setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS)
  }, [tab, grid, bpm, commitDigitBuffer, updateTabContent, updateTabBpm])

  const handleBpmChange = React.useCallback((next: number) => {
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, next)))
  }, [])

  const handleRestart = React.useCallback(() => {
    commitDigitBuffer()
    stop()
    setCursor({ col: 0, string: 1 })
    containerRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [stop, commitDigitBuffer])

  React.useEffect(() => {
    if (!tab) return

    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return

      if (pickerOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setPickerOpen(false)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setPickerSelection((s) => ({ ...s, string: Math.max(1, s.string - 1) }))
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setPickerSelection((s) => ({ ...s, string: Math.min(stringCount, s.string + 1) }))
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setPickerSelection((s) => ({ ...s, fret: Math.max(0, s.fret - 1) }))
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setPickerSelection((s) => ({ ...s, fret: Math.min(FRETBOARD_MAX_FRET, s.fret + 1) }))
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          commitPick(pickerSelection.string, pickerSelection.fret)
          return
        }
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        commitDigitBuffer()
        playPause()
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveCursor(1)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveCursor(-1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        commitDigitBuffer()
        setCursor((c) => ({ ...c, string: Math.max(1, c.string - 1) }))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        commitDigitBuffer()
        setCursor((c) => ({ ...c, string: Math.min(stringCount, c.string + 1) }))
        return
      }

      if (e.key === 'Escape') {
        commitDigitBuffer()
        setNoteNameMode(false)
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        setDigitBuffer('')
        setGrid((g) => clearCell(g, cursor.col, cursor.string))
        return
      }

      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        commitDigitBuffer()
        setNoteNameMode((v) => !v)
        return
      }

      if (noteNameMode) {
        if (
          e.key === '#' &&
          pendingNoteRef.current &&
          pendingNoteRef.current.col === cursor.col &&
          pendingNoteRef.current.string === cursor.string &&
          tab
        ) {
          e.preventDefault()
          const highToLow = [...tab.instrumentConfig.tuning].reverse()
          const openNote = highToLow[cursor.string - 1]
          const fret = fretForNote(openNote, normalizeNoteName(`${pendingNoteRef.current.letter}#`))
          setGrid((g) => setCellFret(g, cursor.col, cursor.string, fret))
          pendingNoteRef.current = null
          return
        }

        const letter = e.key.toUpperCase()
        if (NOTE_LETTERS.has(letter) && tab) {
          e.preventDefault()
          const highToLow = [...tab.instrumentConfig.tuning].reverse()
          const openNote = highToLow[cursor.string - 1]
          const fret = fretForNote(openNote, normalizeNoteName(letter))
          setGrid((g) => setCellFret(g, cursor.col, cursor.string, fret))
          pendingNoteRef.current = { col: cursor.col, string: cursor.string, letter }
          if (pendingNoteTimeoutRef.current) clearTimeout(pendingNoteTimeoutRef.current)
          pendingNoteTimeoutRef.current = setTimeout(() => {
            pendingNoteRef.current = null
          }, DIGIT_COMMIT_MS)
        }
        return
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        setDigitBuffer((buffer) => {
          const next = (buffer + e.key).slice(0, 2)
          if (digitTimeoutRef.current) clearTimeout(digitTimeoutRef.current)
          digitTimeoutRef.current = setTimeout(commitDigitBuffer, DIGIT_COMMIT_MS)
          return next
        })
        return
      }

      const key = e.key.toLowerCase()

      if (key === 'b') {
        e.preventDefault()
        commitDigitBuffer()
        const kind: BendKind = e.shiftKey ? 'prebend' : 'bend'
        setGrid((g) => cycleBend(g, cursor.col, cursor.string, kind))
        return
      }

      const noteEffectByKey: Record<string, NoteEffect> = {
        h: 'h',
        p: 'p',
        '/': 'sl',
        '\\': 'sl',
        m: 'pm',
        '~': 'v',
        k: 'nh',
      }
      if (key in noteEffectByKey) {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleNoteEffect(g, cursor.col, cursor.string, noteEffectByKey[key]))
        return
      }
      if (key === 't') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleBeatEffect(g, cursor.col, 'tt'))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    tab,
    cursor,
    noteNameMode,
    stringCount,
    maxBarsPerTab,
    commitDigitBuffer,
    ensureColumn,
    moveCursor,
    playPause,
    pickerOpen,
    pickerSelection,
    commitPick,
  ])

  if (!tab) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Tablatura não encontrada.</p>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-28 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft />
            </Link>
          </Button>
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              const finalName = nameDraft.trim() || tab.name
              setNameDraft(finalName)
              if (finalName !== tab.name) renameTab(tab.id, finalName)
            }}
            className="h-9 w-56 border-none bg-transparent text-lg font-semibold shadow-none focus-visible:bg-secondary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {bars}/{maxBarsPerTab} compassos
        </span>
      </header>

      <div className="flex min-w-0 flex-col gap-4">
        <div
          ref={containerRef}
          className="min-h-64 overflow-x-auto overflow-y-visible rounded-lg border border-border bg-white p-2"
        />

        {alphaTabError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Não foi possível renderizar a partitura, verifique as notas inseridas.
          </p>
        )}

        <TabGridEditor
          grid={grid}
          instrument={tab.instrumentConfig}
          cursor={cursor}
          digitBuffer={digitBuffer}
          onSelectCell={handleSelectCell}
        />

        {atBarLimit && (
          <p className="text-xs text-muted-foreground">
            Limite de {maxBarsPerTab} compassos do plano atingido.
          </p>
        )}
        {noteNameMode && (
          <p className="text-xs text-primary">
            Modo de inserção por nome de nota ativo — pressione A–G (# para sustenido). (N para
            sair)
          </p>
        )}

        {pickerOpen && (
          <FretboardPicker
            tuningLowToHigh={tab.instrumentConfig.tuning}
            selection={pickerSelection}
            onSelect={commitPick}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      <TabBottomToolbar
        isPlaying={isPlaying}
        onPlayPause={playPause}
        onRestart={handleRestart}
        onMoveLeft={() => moveCursor(-1)}
        onMoveRight={() => moveCursor(1)}
        onSave={handleManualSave}
        justSaved={justSaved}
        fretboardOpen={pickerOpen}
        onToggleFretboard={toggleFretboard}
        bpm={bpm}
        onBpmChange={handleBpmChange}
        bpmStep={BPM_STEP}
        minBpm={MIN_BPM}
        maxBpm={MAX_BPM}
      />
    </div>
  )
}

function emptyColumnLocal() {
  return { cells: {}, beatEffects: [] as BeatEffect[] }
}

function setCellFret(grid: TabGrid, col: number, stringNo: number, fret: number): TabGrid {
  if (col >= grid.columns.length || Number.isNaN(fret)) return grid
  const columns = grid.columns.slice()
  const column = columns[col]
  const existing = column.cells[stringNo]
  columns[col] = {
    ...column,
    cells: { ...column.cells, [stringNo]: { fret, effects: existing?.effects ?? [] } },
  }
  return { columns }
}

function clearCell(grid: TabGrid, col: number, stringNo: number): TabGrid {
  if (col >= grid.columns.length) return grid
  const columns = grid.columns.slice()
  const column = columns[col]
  if (!(stringNo in column.cells)) return grid
  const cells = { ...column.cells }
  delete cells[stringNo]
  columns[col] = { ...column, cells }
  return { columns }
}

/** Hammer-on and pull-off describe the same slur in opposite directions —
 * a note can't be both, so enabling one clears the other. */
const MUTUALLY_EXCLUSIVE_EFFECTS: Partial<Record<NoteEffect, NoteEffect>> = {
  h: 'p',
  p: 'h',
}

function toggleNoteEffect(
  grid: TabGrid,
  col: number,
  stringNo: number,
  effect: NoteEffect,
): TabGrid {
  if (col >= grid.columns.length) return grid
  const column = grid.columns[col]
  const cell = column.cells[stringNo]
  if (!cell) return grid
  const has = cell.effects.includes(effect)
  const opposite = MUTUALLY_EXCLUSIVE_EFFECTS[effect]
  const effects = has
    ? cell.effects.filter((e) => e !== effect)
    : [...cell.effects.filter((e) => e !== opposite), effect]
  const columns = grid.columns.slice()
  columns[col] = { ...column, cells: { ...column.cells, [stringNo]: { ...cell, effects } } }
  return { columns }
}

/** Cycles a cell's bend through BEND_STEPS (1/4, 1/2, 3/4, full, 1 1/2, 2x),
 * switching kind (bend/prebend) resets to the first step, and cycling past
 * the last step clears the bend. */
function cycleBend(grid: TabGrid, col: number, stringNo: number, kind: BendKind): TabGrid {
  if (col >= grid.columns.length) return grid
  const column = grid.columns[col]
  const cell = column.cells[stringNo]
  if (!cell) return grid

  let bend: BendData | undefined
  if (!cell.bend || cell.bend.kind !== kind) {
    bend = { kind, amount: BEND_STEPS[0] }
  } else {
    const currentIndex = BEND_STEPS.indexOf(cell.bend.amount as (typeof BEND_STEPS)[number])
    const nextIndex = currentIndex + 1
    bend = nextIndex < BEND_STEPS.length ? { kind, amount: BEND_STEPS[nextIndex] } : undefined
  }

  const columns = grid.columns.slice()
  columns[col] = { ...column, cells: { ...column.cells, [stringNo]: { ...cell, bend } } }
  return { columns }
}

function toggleBeatEffect(grid: TabGrid, col: number, effect: BeatEffect): TabGrid {
  if (col >= grid.columns.length) return grid
  const column = grid.columns[col]
  const has = column.beatEffects.includes(effect)
  const beatEffects = has
    ? column.beatEffects.filter((e) => e !== effect)
    : [...column.beatEffects, effect]
  const columns = grid.columns.slice()
  columns[col] = { ...column, beatEffects }
  return { columns }
}
