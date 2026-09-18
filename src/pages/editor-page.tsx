import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LayoutMode } from '@coderline/alphatab'

import { FRETBOARD_MAX_FRET, FretboardPicker } from '@/components/fretboard-picker'
import { GridSelectionPill } from '@/components/grid-selection-pill'
import { PlaybackProgressBar } from '@/components/playback-progress-bar'
import { TabBottomToolbar } from '@/components/tab-bottom-toolbar'
import { TabGridEditor, type GridSelection } from '@/components/tab-grid-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAlphaTab } from '@/hooks/use-alpha-tab'
import {
  BEND_STEPS,
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_SOUND,
  type BeatEffect,
  type BendData,
  type BendKind,
  type Column,
  type NoteEffect,
  type TabGrid,
  barCount,
  deserializeGrid,
  gridToAlphaTex,
  serializeGrid,
  setTempoChangeForRange,
} from '@/lib/tab-grid'
import { fretForNote, normalizeNoteName } from '@/lib/note-utils'
import { useLibrary } from '@/store/library-store'

const DIGIT_COMMIT_MS = 550
const AUTOSAVE_MS = 1500
const SAVED_FEEDBACK_MS = 1500
const NOTE_LETTERS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
const MIN_BPM = 30
const MAX_BPM = 300
const BPM_STEP = 5
const LAYOUT_MODE_STORAGE_KEY = 'tableak.layoutMode'
const SHOW_SCORE_STORAGE_KEY = 'tableak.showScore'
const SHOW_NOTE_NAMES_STORAGE_KEY = 'tableak.showNoteNames'
const LET_RING_PARENS_STORAGE_KEY = 'tableak.letRingParens'
const SLASH_DOUBLE_TAP_MS = 400

/** Notation layout is a display preference, not tab content — kept in
 * localStorage (shared across tabs) instead of the saved tab data. */
function getInitialLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return LayoutMode.Horizontal
  return window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) === 'page'
    ? LayoutMode.Page
    : LayoutMode.Horizontal
}

/** Whether to render the standard notation staff alongside the tab, and
 * whether to show each fretted note's letter name in the grid — both display
 * preferences, not tab content, same reasoning as the layout mode above. */
function getInitialBooleanPref(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue
  const stored = window.localStorage.getItem(key)
  if (stored === null) return defaultValue
  return stored === 'true'
}

export function EditorPage() {
  const { tabId } = useParams<{ tabId: string }>()
  const {
    getTab,
    updateTabContent,
    updateTabBpm,
    updateTabSound,
    updateTabBeatsPerBar,
    renameTab,
    maxBarsPerTab,
  } = useLibrary()
  const tab = tabId ? getTab(tabId) : undefined

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [layoutMode, setLayoutModeState] = React.useState<LayoutMode>(getInitialLayoutMode)
  const {
    setTex,
    playPause,
    stop,
    isPlaying,
    error: alphaTabError,
    scrollToCursor,
    setLayoutMode,
    position,
    activeBeat,
    seek,
    isLooping,
    setLooping,
    hasSelection,
    selectionRange,
    clearSelection,
    playRange,
  } = useAlphaTab(containerRef, layoutMode)

  const [grid, setGrid] = React.useState<TabGrid>(() => deserializeGrid(tab?.content ?? null))
  const [bpm, setBpm] = React.useState(tab?.bpm ?? 120)
  const [sound, setSound] = React.useState(tab?.sound ?? DEFAULT_SOUND)
  const [beatsPerBar, setBeatsPerBar] = React.useState(tab?.beatsPerBar ?? DEFAULT_BEATS_PER_BAR)
  const [showScore, setShowScore] = React.useState(() =>
    getInitialBooleanPref(SHOW_SCORE_STORAGE_KEY, true),
  )
  const [showNoteNames, setShowNoteNames] = React.useState(() =>
    getInitialBooleanPref(SHOW_NOTE_NAMES_STORAGE_KEY, true),
  )
  const [letRingParens, setLetRingParens] = React.useState(() =>
    getInitialBooleanPref(LET_RING_PARENS_STORAGE_KEY, true),
  )
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
  const lastSlashPressRef = React.useRef<number>(0)

  // Click-hold-drag range selection in the grid (distinct from `cursor`,
  // which is the single-cell edit position). Used for copy/delete/move and
  // for scoping a tempo change / loop playback to a specific stretch.
  const [gridSelection, setGridSelection] = React.useState<GridSelection | null>(null)
  const gridScrollRef = React.useRef<HTMLDivElement>(null)
  const gridDragRef = React.useRef<{
    mode: 'select' | 'move'
    anchorCol: number
    origStart: number
    origEnd: number
    previewStart: number
    moved: boolean
  } | null>(null)
  const justDraggedRef = React.useRef(false)
  const clipboardRef = React.useRef<Column[] | null>(null)

  const stringCount = tab?.instrumentConfig.strings ?? 6
  const bars = barCount(grid, beatsPerBar)
  const atBarLimit = bars >= maxBarsPerTab
  const activeColumn =
    activeBeat != null ? activeBeat.barIndex * beatsPerBar + activeBeat.beatIndex : null

  // Regenerate the AlphaTab render whenever the underlying grid, tempo, time
  // signature, or notation display preferences change.
  React.useEffect(() => {
    if (!tab) return
    setTex(
      gridToAlphaTex(
        tab.name,
        tab.instrumentConfig,
        grid,
        bpm,
        sound,
        beatsPerBar,
        showScore,
        letRingParens,
      ),
    )
  }, [grid, bpm, sound, beatsPerBar, showScore, letRingParens, tab, setTex])

  // Keep the notation preview scrolled to where the cursor currently is —
  // reapplied by the hook after every render too, so editing far into the
  // tab while scrolled elsewhere in the preview still brings it into view.
  React.useEffect(() => {
    scrollToCursor(Math.floor(cursor.col / beatsPerBar), cursor.col % beatsPerBar)
  }, [cursor.col, beatsPerBar, scrollToCursor])

  // Debounced autosave.
  React.useEffect(() => {
    if (!tab) return
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    autosaveTimeoutRef.current = setTimeout(() => {
      updateTabContent(tab.id, serializeGrid(grid))
      if (bpm !== tab.bpm) updateTabBpm(tab.id, bpm)
      if (sound !== (tab.sound ?? DEFAULT_SOUND)) updateTabSound(tab.id, sound)
      if (beatsPerBar !== (tab.beatsPerBar ?? DEFAULT_BEATS_PER_BAR)) {
        updateTabBeatsPerBar(tab.id, beatsPerBar)
      }
    }, AUTOSAVE_MS)
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, bpm, sound, beatsPerBar, tab?.id])

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
        const barsNeeded = Math.ceil((col + 1) / beatsPerBar)
        if (barsNeeded > maxBarsPerTab) return g
        const extra = barsNeeded * beatsPerBar - g.columns.length
        if (extra <= 0) return g
        return { columns: [...g.columns, ...Array.from({ length: extra }, emptyColumnLocal)] }
      })
    },
    [maxBarsPerTab, beatsPerBar],
  )

  const moveCursor = React.useCallback(
    (delta: number) => {
      commitDigitBuffer()
      if (delta > 0) {
        const next = cursor.col + delta
        ensureColumn(next)
        setCursor((c) => ({ ...c, col: Math.min(next, maxBarsPerTab * beatsPerBar - 1) }))
      } else {
        setCursor((c) => ({ ...c, col: Math.max(0, c.col + delta) }))
      }
    },
    [cursor.col, commitDigitBuffer, ensureColumn, maxBarsPerTab, beatsPerBar],
  )

  const handleSelectCell = React.useCallback(
    (col: number, stringNo: number) => {
      // A plain click also fires right after a drag-select/drag-move
      // finishes (mouseup's click event targets whatever cell the pointer
      // is over) — skip the click's own effects there so it doesn't
      // immediately move the cursor into and clear the selection just made.
      if (justDraggedRef.current) {
        justDraggedRef.current = false
        return
      }
      commitDigitBuffer()
      ensureColumn(col)
      setCursor({ col, string: stringNo })
      setGridSelection(null)
    },
    [commitDigitBuffer, ensureColumn],
  )

  const handleCellMouseDown = React.useCallback(
    (col: number) => {
      if (gridSelection && col >= gridSelection.start && col <= gridSelection.end) {
        gridDragRef.current = {
          mode: 'move',
          anchorCol: col,
          origStart: gridSelection.start,
          origEnd: gridSelection.end,
          previewStart: gridSelection.start,
          moved: false,
        }
      } else {
        gridDragRef.current = {
          mode: 'select',
          anchorCol: col,
          origStart: col,
          origEnd: col,
          previewStart: col,
          moved: false,
        }
      }
    },
    [gridSelection],
  )

  const handleCellMouseEnter = React.useCallback(
    (col: number) => {
      const drag = gridDragRef.current
      if (!drag) return
      if (col !== drag.anchorCol) drag.moved = true
      if (drag.mode === 'select') {
        const start = Math.min(drag.anchorCol, col)
        const end = Math.max(drag.anchorCol, col)
        drag.previewStart = start
        setGridSelection(start === end ? null : { start, end })
      } else {
        const length = drag.origEnd - drag.origStart + 1
        const delta = col - drag.anchorCol
        const maxStart = Math.max(0, maxBarsPerTab * beatsPerBar - length)
        const newStart = Math.max(0, Math.min(drag.origStart + delta, maxStart))
        drag.previewStart = newStart
        setGridSelection({ start: newStart, end: newStart + length - 1 })
      }
    },
    [maxBarsPerTab, beatsPerBar],
  )

  const handleCellMouseUp = React.useCallback(() => {
    const drag = gridDragRef.current
    gridDragRef.current = null
    if (!drag) return
    if (drag.moved) justDraggedRef.current = true
    if (drag.mode === 'move' && drag.previewStart !== drag.origStart) {
      setGrid((g) => moveColumnRange(g, drag.origStart, drag.origEnd, drag.previewStart))
    }
  }, [])

  // Safety net for a drag that ends outside the grid entirely (mouse
  // released over the toolbar, etc.) — the per-cell mouseup above won't
  // fire there, so the drag would otherwise never get finalized.
  React.useEffect(() => {
    window.addEventListener('mouseup', handleCellMouseUp)
    return () => window.removeEventListener('mouseup', handleCellMouseUp)
  }, [handleCellMouseUp])

  const handleSetTempoForSelection = React.useCallback(
    (bpm: number | null) => {
      if (!gridSelection) return
      const startBar = Math.floor(gridSelection.start / beatsPerBar)
      const endBar = Math.floor(gridSelection.end / beatsPerBar)
      setGrid((g) => setTempoChangeForRange(g, startBar, endBar, bpm))
    },
    [gridSelection, beatsPerBar],
  )

  const handlePlaySelection = React.useCallback(() => {
    if (!gridSelection) return
    const startBar = Math.floor(gridSelection.start / beatsPerBar)
    const startBeat = gridSelection.start % beatsPerBar
    const endBar = Math.floor(gridSelection.end / beatsPerBar)
    const endBeat = gridSelection.end % beatsPerBar
    playRange(startBar, startBeat, endBar, endBeat)
  }, [gridSelection, beatsPerBar, playRange])

  const handleCopySelection = React.useCallback(() => {
    if (!gridSelection) return
    clipboardRef.current = grid.columns.slice(gridSelection.start, gridSelection.end + 1)
  }, [gridSelection, grid])

  const handleDeleteSelection = React.useCallback(() => {
    if (!gridSelection) return
    setGrid((g) => clearColumnRange(g, gridSelection.start, gridSelection.end))
  }, [gridSelection])

  const handleCloseSelection = React.useCallback(() => {
    setGridSelection(null)
  }, [])

  const handlePaste = React.useCallback(() => {
    const clip = clipboardRef.current
    if (!clip || clip.length === 0) return
    commitDigitBuffer()
    setGrid((g) => insertColumnsAt(g, cursor.col, clip, maxBarsPerTab * beatsPerBar))
  }, [cursor.col, maxBarsPerTab, beatsPerBar, commitDigitBuffer])

  const commitPick = React.useCallback(
    (stringNo: number, fret: number) => {
      setGrid((g) => setCellFret(g, cursor.col, stringNo, fret))
      setPickerSelection({ string: stringNo, fret })
      const next = cursor.col + 1
      ensureColumn(next)
      setCursor(() => ({ col: Math.min(next, maxBarsPerTab * beatsPerBar - 1), string: stringNo }))
    },
    [cursor.col, ensureColumn, maxBarsPerTab, beatsPerBar],
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
    if (sound !== (tab.sound ?? DEFAULT_SOUND)) updateTabSound(tab.id, sound)
    if (beatsPerBar !== (tab.beatsPerBar ?? DEFAULT_BEATS_PER_BAR)) {
      updateTabBeatsPerBar(tab.id, beatsPerBar)
    }
    setJustSaved(true)
    if (savedFeedbackTimeoutRef.current) clearTimeout(savedFeedbackTimeoutRef.current)
    savedFeedbackTimeoutRef.current = setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS)
  }, [
    tab,
    grid,
    bpm,
    sound,
    beatsPerBar,
    commitDigitBuffer,
    updateTabContent,
    updateTabBpm,
    updateTabSound,
    updateTabBeatsPerBar,
  ])

  const handleToggleLayoutMode = React.useCallback(() => {
    setLayoutModeState((mode) => {
      const next = mode === LayoutMode.Horizontal ? LayoutMode.Page : LayoutMode.Horizontal
      window.localStorage.setItem(
        LAYOUT_MODE_STORAGE_KEY,
        next === LayoutMode.Page ? 'page' : 'horizontal',
      )
      setLayoutMode(next)
      return next
    })
  }, [setLayoutMode])

  const handleBpmChange = React.useCallback((next: number) => {
    setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, next)))
  }, [])

  const handleBeatsPerBarChange = React.useCallback((next: number) => {
    setBeatsPerBar(next)
  }, [])

  const handleToggleShowScore = React.useCallback(() => {
    setShowScore((v) => {
      const next = !v
      window.localStorage.setItem(SHOW_SCORE_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const handleToggleShowNoteNames = React.useCallback(() => {
    setShowNoteNames((v) => {
      const next = !v
      window.localStorage.setItem(SHOW_NOTE_NAMES_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const handleToggleLetRingParens = React.useCallback(() => {
    setLetRingParens((v) => {
      const next = !v
      window.localStorage.setItem(LET_RING_PARENS_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const handleToggleLoop = React.useCallback(() => {
    setLooping(!isLooping)
  }, [isLooping, setLooping])

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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        handleCopySelection()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        handlePaste()
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
        setGridSelection(null)
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        setDigitBuffer('')
        if (gridSelection) {
          handleDeleteSelection()
        } else {
          setGrid((g) => clearCell(g, cursor.col, cursor.string))
        }
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

      if (key === 'k') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleNoteEffect(g, cursor.col, cursor.string, e.shiftKey ? 'ph' : 'nh'))
        return
      }

      // On Brazilian ABNT keyboards '~' is a dead key (used to compose ã/õ),
      // so tapping it alone never produces e.key === '~' — the browser fires
      // e.key === 'Dead' instead. Treat that the same as '~' so the vibrato
      // shortcut works on those layouts too.
      if (key === '~' || e.key === 'Dead') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleNoteEffect(g, cursor.col, cursor.string, 'v'))
        return
      }

      const noteEffectByKey: Record<string, NoteEffect> = {
        h: 'h',
        p: 'p',
        s: 'sl',
        m: 'pm',
        l: 'lr',
      }
      if (key in noteEffectByKey) {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleNoteEffect(g, cursor.col, cursor.string, noteEffectByKey[key]))
        return
      }

      // Slide-out (no landing fret): '/' slides out upward, '\' downward —
      // mirroring which way each glyph visually slants. Keyboards without a
      // dedicated '\' key can still reach the downward slide by tapping '/'
      // twice quickly, same threshold as the digit-buffer commit delay above.
      if (key === '/' || key === '\\') {
        e.preventDefault()
        commitDigitBuffer()
        let effect: NoteEffect = key === '\\' ? 'sod' : 'sou'
        if (key === '/') {
          const now = Date.now()
          if (now - lastSlashPressRef.current < SLASH_DOUBLE_TAP_MS) {
            effect = 'sod'
            lastSlashPressRef.current = 0
          } else {
            lastSlashPressRef.current = now
          }
        }
        setGrid((g) => toggleNoteEffect(g, cursor.col, cursor.string, effect))
        return
      }
      if (key === 'i') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => cycleSlideIn(g, cursor.col, cursor.string))
        return
      }
      if (key === 'x') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleDeadNote(g, cursor.col, cursor.string))
        return
      }
      if (key === 't') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleBeatEffect(g, cursor.col, 'tt'))
        return
      }
      if (key === 'u') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleBeatEffect(g, cursor.col, 'su'))
        return
      }
      if (key === 'd') {
        e.preventDefault()
        commitDigitBuffer()
        setGrid((g) => toggleBeatEffect(g, cursor.col, 'sd'))
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
    gridSelection,
    handleCopySelection,
    handlePaste,
    handleDeleteSelection,
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
    <div className="mx-auto flex min-h-svh w-full max-w-[100rem] flex-col gap-6 px-4 py-6 pb-28 sm:px-8">
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
        <p className="text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">Afinação: </span>
          {[...tab.instrumentConfig.tuning].reverse().join(' ')}
        </p>

        <PlaybackProgressBar position={position} selectionRange={selectionRange} onSeek={seek} />

        <div
          ref={containerRef}
          className="h-[34rem] overflow-auto overscroll-contain rounded-lg border border-border bg-white p-2"
        />

        {alphaTabError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Não foi possível renderizar a partitura, verifique as notas inseridas.
          </p>
        )}

        <div className="relative">
          <TabGridEditor
            grid={grid}
            instrument={tab.instrumentConfig}
            cursor={cursor}
            digitBuffer={digitBuffer}
            onSelectCell={handleSelectCell}
            beatsPerBar={beatsPerBar}
            showNoteNames={showNoteNames}
            activeColumn={activeColumn}
            selection={gridSelection}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            onCellMouseUp={handleCellMouseUp}
            scrollContainerRef={gridScrollRef}
          />
          {gridSelection && (
            <GridSelectionPill
              key={`${gridSelection.start}-${gridSelection.end}`}
              selection={gridSelection}
              beatsPerBar={beatsPerBar}
              scrollContainerRef={gridScrollRef}
              baseBpm={bpm}
              minBpm={MIN_BPM}
              maxBpm={MAX_BPM}
              tempoChanges={grid.tempoChanges ?? []}
              onSetTempo={handleSetTempoForSelection}
              onPlay={handlePlaySelection}
              onCopy={handleCopySelection}
              onDelete={handleDeleteSelection}
              onClose={handleCloseSelection}
            />
          )}
        </div>

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
        layoutMode={layoutMode}
        onToggleLayoutMode={handleToggleLayoutMode}
        sound={sound}
        onSoundChange={setSound}
        beatsPerBar={beatsPerBar}
        onBeatsPerBarChange={handleBeatsPerBarChange}
        showScore={showScore}
        onToggleShowScore={handleToggleShowScore}
        showNoteNames={showNoteNames}
        onToggleShowNoteNames={handleToggleShowNoteNames}
        letRingParens={letRingParens}
        onToggleLetRingParens={handleToggleLetRingParens}
        isLooping={isLooping}
        onToggleLoop={handleToggleLoop}
        hasSelection={hasSelection}
        onClearSelection={clearSelection}
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

/** Clears every cell (back to a rest) in `[start, end]` without changing the
 * column count — the range-selection equivalent of the single-cell delete. */
function clearColumnRange(grid: TabGrid, start: number, end: number): TabGrid {
  const columns = grid.columns.map((column, i) => (i >= start && i <= end ? emptyColumnLocal() : column))
  return { ...grid, columns }
}

/** Relocates `[start, end]` so it starts at `targetStart`, shifting whatever
 * was in between to close the gap left behind and make room at the
 * destination — a plain array-splice move, not a copy. */
function moveColumnRange(grid: TabGrid, start: number, end: number, targetStart: number): TabGrid {
  if (targetStart === start) return grid
  const block = grid.columns.slice(start, end + 1)
  const without = [...grid.columns.slice(0, start), ...grid.columns.slice(end + 1)]
  const adjustedTarget = targetStart > end ? targetStart - block.length : targetStart
  const clamped = Math.max(0, Math.min(adjustedTarget, without.length))
  const columns = [...without.slice(0, clamped), ...block, ...without.slice(clamped)]
  return { ...grid, columns }
}

/** Inserts `toInsert` at `index`, pushing everything from there onward to
 * the right (never overwriting existing content) — how pasting a copied
 * range lands in the tab. Extra columns past `maxColumns` are dropped rather
 * than silently growing the tab past the plan's bar limit. */
function insertColumnsAt(grid: TabGrid, index: number, toInsert: Column[], maxColumns: number): TabGrid {
  const clampedIndex = Math.min(Math.max(0, index), grid.columns.length)
  const merged = [...grid.columns.slice(0, clampedIndex), ...toInsert, ...grid.columns.slice(clampedIndex)]
  const columns = merged.length > maxColumns ? merged.slice(0, maxColumns) : merged
  return { ...grid, columns }
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

/** Hammer-on and pull-off describe the same slur in opposite directions,
 * natural/pinch harmonics are two different ways to pluck the same note, and
 * a note only slides out (or connects to the next note) one way — a note
 * can't be more than one of any of these at once, so enabling one clears the
 * others in its group. */
const MUTUALLY_EXCLUSIVE_EFFECTS: Partial<Record<NoteEffect, NoteEffect[]>> = {
  h: ['p'],
  p: ['h'],
  nh: ['ph'],
  ph: ['nh'],
  sl: ['sou', 'sod'],
  sou: ['sl', 'sod'],
  sod: ['sl', 'sou'],
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
  const opposites = MUTUALLY_EXCLUSIVE_EFFECTS[effect] ?? []
  const effects = has
    ? cell.effects.filter((e) => e !== effect)
    : [...cell.effects.filter((e) => !opposites.includes(e)), effect]
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

/** Cycles a cell's open-ended slide marker: none -> slide in from below (`/14`)
 * -> slide in from above (`\14`) -> none. Distinct from `sl`, which connects to
 * an adjacent note instead of standing alone with no defined starting fret. */
function cycleSlideIn(grid: TabGrid, col: number, stringNo: number): TabGrid {
  if (col >= grid.columns.length) return grid
  const column = grid.columns[col]
  const cell = column.cells[stringNo]
  if (!cell) return grid

  const next: NoteEffect | null = cell.effects.includes('sib')
    ? 'sia'
    : cell.effects.includes('sia')
      ? null
      : 'sib'

  const effects = cell.effects.filter((e): e is NoteEffect => e !== 'sib' && e !== 'sia')
  if (next) effects.push(next)

  const columns = grid.columns.slice()
  columns[col] = { ...column, cells: { ...column.cells, [stringNo]: { ...cell, effects } } }
  return { columns }
}

/** Toggles a cell between a fretted note and a dead/muted note (`x`). Creates
 * an empty cell first if the cursor sits on a blank position, same as other
 * note-effect toggles — except those require an existing note to attach to,
 * while a dead note has no pitch and so needs nothing else. */
function toggleDeadNote(grid: TabGrid, col: number, stringNo: number): TabGrid {
  if (col >= grid.columns.length) return grid
  const column = grid.columns[col]
  const cell = column.cells[stringNo]
  const columns = grid.columns.slice()
  const next = cell ? { ...cell, dead: !cell.dead } : { fret: 0, effects: [], dead: true }
  columns[col] = { ...column, cells: { ...column.cells, [stringNo]: next } }
  return { columns }
}

/** A beat's pick stroke can only point one way, so enabling one clears the other. */
const MUTUALLY_EXCLUSIVE_BEAT_EFFECTS: Partial<Record<BeatEffect, BeatEffect>> = {
  su: 'sd',
  sd: 'su',
}

/** Beat-level effects (pick stroke, tapping, ...) annotate a played beat, so
 * they don't make sense on a beat with no notes in it — silently ignore the
 * toggle instead of producing a stray marking over a rest. */
function toggleBeatEffect(grid: TabGrid, col: number, effect: BeatEffect): TabGrid {
  if (col >= grid.columns.length) return grid
  const column = grid.columns[col]
  const has = column.beatEffects.includes(effect)
  if (!has && Object.keys(column.cells).length === 0) return grid
  const opposite = MUTUALLY_EXCLUSIVE_BEAT_EFFECTS[effect]
  const beatEffects = has
    ? column.beatEffects.filter((e) => e !== effect)
    : [...column.beatEffects.filter((e) => e !== opposite), effect]
  const columns = grid.columns.slice()
  columns[col] = { ...column, beatEffects }
  return { columns }
}
