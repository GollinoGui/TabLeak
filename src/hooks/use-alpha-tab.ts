import * as React from 'react'
import type { model } from '@coderline/alphatab'
import { AlphaTabApi, LayoutMode, NotationElement, ScrollMode } from '@coderline/alphatab'

type Beat = model.Beat
type Note = model.Note

/** A plain (non-drag) click on the rendered notation, translated to the same
 * bar/beat scheme the grid editor already uses elsewhere in this hook.
 * `stringNo` is only known when the click landed precisely on a note head/
 * number (see `noteMouseDown`'s `includeNoteBounds` requirement below) —
 * `null` when it just hit the beat in general, so the consumer can fall back
 * to whatever string it already had selected. */
export interface NotationClick {
  barIndex: number
  beatIndex: number
  stringNo: number | null
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface PlaybackPosition {
  currentTime: number
  endTime: number
  currentTick: number
  endTick: number
}

export interface ActiveBeat {
  barIndex: number
  beatIndex: number
}

export interface SelectionRange {
  startTick: number
  endTick: number
}

/** Scrolls `container` the minimum amount needed to bring `rect` (in the
 * container's content coordinate space) fully into view, on both axes. */
function scrollRectIntoView(container: HTMLElement, rect: Rect, behavior: ScrollBehavior) {
  const margin = 16
  let left: number | undefined
  let top: number | undefined

  if (rect.x < container.scrollLeft + margin) {
    left = Math.max(0, rect.x - margin)
  } else if (rect.x + rect.w > container.scrollLeft + container.clientWidth - margin) {
    left = rect.x + rect.w - container.clientWidth + margin
  }

  if (rect.y < container.scrollTop + margin) {
    top = Math.max(0, rect.y - margin)
  } else if (rect.y + rect.h > container.scrollTop + container.clientHeight - margin) {
    top = rect.y + rect.h - container.clientHeight + margin
  }

  if (left === undefined && top === undefined) return
  container.scrollTo({
    left: left ?? container.scrollLeft,
    top: top ?? container.scrollTop,
    behavior,
  })
}

/** alphaTab's live `Note.string` numbers strings low-to-high (1 = lowest,
 * thickest string), the opposite of both alphaTeX's own `fret.string` text
 * and this app's grid convention (1 = highest-pitched string — see
 * `Column.cells` in `tab-grid.ts`). alphaTeX parsing itself applies this
 * same inversion in reverse when turning written notes into `Note`
 * instances, so this mirrors it to get back to the grid's numbering. */
function gridStringNumber(note: Note): number {
  return note.beat.voice.bar.staff.tuning.length - note.string + 1
}

/** Bounding box covering every rect in `rects`, or `null` if there are none. */
function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function useAlphaTab(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialLayoutMode: LayoutMode = LayoutMode.Horizontal,
) {
  const apiRef = React.useRef<AlphaTabApi | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [position, setPosition] = React.useState<PlaybackPosition | null>(null)
  const [activeBeat, setActiveBeat] = React.useState<ActiveBeat | null>(null)
  const [isLooping, setIsLoopingState] = React.useState(false)
  const [selectionRange, setSelectionRange] = React.useState<SelectionRange | null>(null)
  const [notationClick, setNotationClick] = React.useState<NotationClick | null>(null)

  // Which beat to keep in view. Re-applied after every render (not just when
  // the target changes) because editing a note can reflow the notation (e.g.
  // wrap a new line), moving that beat even though the cursor didn't.
  const cursorTargetRef = React.useRef<{ barIndex: number; beatIndex: number } | null>(null)
  const applyScrollRef = React.useRef<(behavior: ScrollBehavior) => void>(() => {})
  // Last bar the playback cursor actually scrolled to — lets the
  // activeBeatsChanged handler below scroll at most once per bar instead of
  // once per beat (see that handler for why).
  const lastScrolledBarRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const api = new AlphaTabApi(el, {
      core: {
        fontDirectory: '/font/',
        // Needed for `noteMouseDown` (off by default for render performance)
        // — clicking a note in the rendered notation to jump the grid editor
        // there needs to know exactly which string was clicked, not just
        // which beat.
        includeNoteBounds: true,
      },
      display: {
        // Horizontal (single endless line, scroll sideways) avoids bars ever
        // wrapping mid-phrase — a slide/tie/bend into the next bar's first
        // note always stays on the same line instead of getting cut across a
        // line break. Page (default) wraps bars downward instead, which some
        // users prefer for a shorter, scroll-down view; exposed as a toggle.
        layoutMode: initialLayoutMode,
        // A bit more room between beats than the default so effects on
        // adjacent notes (e.g. a bend's value label and a following
        // slide/hammer-on/pull-off curve) don't run into each other.
        stretchForce: 1.3,
        resources: {
          // The tuning label (e.g. "Standard Tuning") alphaTab draws above
          // the staff defaults to a small, thin font that's easy to miss —
          // bump it up so it reads as a real piece of information, not a footnote.
          // A CSS font shorthand string is accepted here (see `FontJson` in
          // alphaTab's types) — no need to import alphaTab's `Font` class,
          // which isn't actually exported from the package's runtime bundle.
          elementFonts: new Map([[NotationElement.GuitarTuning, 'bold 16px Arial, sans-serif']]),
        },
      },
      notation: {
        // The tempo/dynamics markings alphaTab shows by default duplicate the
        // app's own BPM control and aren't editable from this app, so they're
        // just clutter — worse, "tempo" sitting right above beat 1 can visibly
        // crowd a vibrato marking placed on that same first beat.
        elements: new Map([
          [NotationElement.EffectTempo, false],
          [NotationElement.EffectDynamics, false],
        ]),
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        soundFont: '/soundfont/sonivox.sf3',
        // Default is `html,body`, which scrolls the whole page to the cursor
        // on every render (e.g. each note typed), not just during playback.
        // Contain it to this container instead.
        scrollElement: el,
        // Off by default: alphaTab's own cursor auto-scroll re-fires on every
        // re-render (i.e. every edit) and targets the *playback* cursor, which
        // sits at the very start of the piece until Play is pressed — so with
        // this left on, editing anywhere past bar 1 snapped the view back to
        // the beginning after each keystroke. Our own applyScroll below
        // follows the *edit* cursor instead; re-enabled only while playing,
        // so the view still tracks the playback cursor during playback.
        scrollMode: ScrollMode.Off,
        // Default is a smoothly-gliding cursor that recomputes its on-screen
        // position every animation frame instead of just jumping per beat —
        // extra per-frame work with no benefit now that `scrollMode` above
        // is handled by this hook's own applyScroll instead of alphaTab's
        // built-in follow.
        enableAnimatedBeatCursor: false,
        // Default repaints every notation element of the currently-playing
        // beat in the accent color (`.at-highlight` below) as playback moves
        // through it. For a bend, that beat is a curve, an arrowhead, and a
        // value label on top of the note itself — repainting all of it as
        // one flat highlight is what read as "the bend animating" and
        // looked visibly broken (e.g. arrowhead shapes that are normally
        // unfilled outlines turning into solid blobs once `fill` is forced).
        // Plain notes highlighted fine, but there's no per-element-type
        // toggle to keep the feature for those and drop it just for bends,
        // so it's off entirely — the `.at-cursor-bar`/`.at-cursor-beat` band
        // and line already show what's currently playing.
        enableElementHighlighting: false,
      },
    })
    apiRef.current = api
    setReady(true)

    const applyScroll = (behavior: ScrollBehavior) => {
      const target = cursorTargetRef.current
      const container = containerRef.current
      if (!target || !container) return
      const bar = api.score?.tracks[0]?.staves[0]?.bars[target.barIndex]
      const beat = bar?.voices[0]?.beats[target.beatIndex]
      // A beat is rendered once per visible staff (standard notation and
      // tablature both), each with its own bounds. `findBeat` only returns
      // the first of those, so scrolling by it alone could bring the
      // notation into view while leaving the tab staff (stacked right below
      // it) still off-screen — union both staves' bounds before scrolling.
      const boundsList = beat ? api.boundsLookup?.findBeats(beat) : null
      const rect = boundsList && boundsList.length > 0 ? unionRects(boundsList.map((b) => b.realBounds)) : null
      if (!rect) return
      scrollRectIntoView(container, rect, behavior)
    }
    applyScrollRef.current = applyScroll

    const onPlayerStateChanged = (e: { state: number }) => {
      const playing = e.state === 1
      setIsPlaying(playing)
      // The "currently sounding" highlight (grid + notation cursor + progress
      // bar selection shading) only makes sense while actually playing —
      // otherwise it's just stuck showing wherever playback last was, which
      // reads as a bug (e.g. still highlighted after pausing or restarting).
      // alphaTab's own bar/beat cursor has no such toggle, so it's driven via
      // this class instead (see the `.at-playing` rules in index.css).
      if (!playing) setActiveBeat(null)
      // Force the very next activeBeatsChanged tick to scroll, even if it
      // happens to land on the same bar a previous playback run last
      // scrolled to — otherwise resuming after the user scrolled away while
      // paused/editing wouldn't bring the view back.
      if (playing) lastScrolledBarRef.current = null
      el.classList.toggle('at-playing', playing)
    }
    api.playerStateChanged.on(onPlayerStateChanged)

    // AlphaTab itself force-scrolls to the playback position on every render,
    // which without an active playback position means "back to the start" —
    // this listener runs after that (it fires from the same event) and wins,
    // scrolling to wherever the user is actually editing instead.
    //
    // Debounced (rather than calling applyScroll directly): alphaTab can
    // fire this several times in a row while it settles a re-layout after an
    // edit, and the bounds it reports on an in-between pass can be
    // transiently wrong (e.g. momentarily back at the top of the tab). With
    // an animated scroll, acting on one of those passes means the animation
    // can still be mid-flight toward that wrong spot when the next, correct
    // pass runs and decides no further scrolling is needed — so it never
    // gets corrected and the view is left having visibly snapped away.
    // Waiting for the burst to go quiet means only the final, settled pass
    // ever drives a scroll.
    let renderScrollTimeout: ReturnType<typeof setTimeout> | null = null
    const onRenderFinished = () => {
      if (renderScrollTimeout !== null) clearTimeout(renderScrollTimeout)
      renderScrollTimeout = setTimeout(() => {
        renderScrollTimeout = null
        applyScroll('smooth')
      }, 100)
    }
    api.postRenderFinished.on(onRenderFinished)

    const onError = (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    }
    api.error.on(onError)

    // alphaTab fires this many times a second (fine-grained enough to drive a
    // smooth native cursor animation). Pushing a React state update on every
    // single tick re-renders the whole page — including the grid editor's
    // full table — dozens of times a second, which was competing with the
    // audio thread for the main thread and causing audible crackling.
    // Throttled here to a rate that's still smooth for a progress bar
    // (~10/sec) but leaves the main thread free the rest of the time; seeks
    // always go through immediately so scrubbing still feels responsive.
    const POSITION_THROTTLE_MS = 100
    let lastPositionUpdate = 0
    const onPositionChanged = (e: {
      currentTime: number
      endTime: number
      currentTick: number
      endTick: number
      isSeek: boolean
    }) => {
      const now = performance.now()
      if (!e.isSeek && now - lastPositionUpdate < POSITION_THROTTLE_MS) return
      lastPositionUpdate = now
      setPosition({
        currentTime: e.currentTime,
        endTime: e.endTime,
        currentTick: e.currentTick,
        endTick: e.endTick,
      })
    }
    api.playerPositionChanged.on(onPositionChanged)

    // Which beat is actually sounding right now, for highlighting the
    // current note/bar outside of alphaTab's own cursor (e.g. in the grid
    // editor). Bar/beat index here is the same scheme `scrollToCursor` above
    // already relies on — one grid column is always exactly one beat.
    // Also re-targets the scroll-follow at this beat (instead of alphaTab's
    // own built-in "Continuous" scroll mode, which unconditionally recenters
    // the viewport on every tick — including the very first one, which was
    // visibly yanking the notation view down as soon as Play/Space was
    // pressed even when the playing bar was already fully on screen).
    //
    // The scroll itself only fires when `barIndex` actually changes, not on
    // every beat: a fast passage (16th notes, a triplet run, ...) can fire
    // this several times a second, and re-issuing a *smooth* scroll on every
    // one of those restarts the in-flight animation before it settles — the
    // view visibly stutters/stalls instead of gliding, which reads as
    // "stuck" rather than as following playback. Once per bar is both
    // enough (within a bar, `scrollRectIntoView`'s own margin check already
    // no-ops unless the beat actually left the visible area) and slow
    // enough that each animation has time to finish before the next fires.
    //
    // The scroll call itself is deferred a frame (rather than run inline
    // here) because `activeBeatsChanged` fires from alphaTab's real-time
    // playback scheduling — running the bounds lookup and a scrollTo
    // synchronously in that same tick was blocking the main thread for just
    // long enough, right as a new bar started, to make the audio scheduler
    // miss its window and produce an audible stall exactly on bar changes
    // (the same class of main-thread-contention glitch as the position/tex
    // throttling above, just triggered by this scroll instead).
    const onActiveBeatsChanged = (e: { activeBeats: Beat[] }) => {
      const beat = e.activeBeats[0]
      if (!beat) {
        setActiveBeat(null)
        return
      }
      const target = { barIndex: beat.voice.bar.index, beatIndex: beat.index }
      setActiveBeat(target)
      cursorTargetRef.current = target
      if (lastScrolledBarRef.current !== target.barIndex) {
        lastScrolledBarRef.current = target.barIndex
        requestAnimationFrame(() => applyScrollRef.current('smooth'))
      }
    }
    api.activeBeatsChanged.on(onActiveBeatsChanged)

    const onPlaybackRangeChanged = (e: { playbackRange: { startTick: number; endTick: number } | null }) => {
      setSelectionRange(
        e.playbackRange
          ? { startTick: e.playbackRange.startTick, endTick: e.playbackRange.endTick }
          : null,
      )
    }
    api.playbackRangeChanged.on(onPlaybackRangeChanged)

    // Click-and-drag on the rendered notation to mark a range: mousedown
    // remembers the start beat, mousemove live-previews the range via
    // alphaTab's own highlight (doesn't affect playback yet), mouseup either
    // commits it (if the drag actually moved to a different beat) or clears
    // any existing selection (a plain click with no drag). A plain click also
    // publishes `notationClick`, so the grid editor's own cursor can jump to
    // wherever was clicked in the rendered notation — the reverse of the
    // existing edit-cursor -> notation scroll-follow above.
    let dragStartBeat: Beat | null = null
    let dragStartNote: Note | null = null
    let dragMoved = false
    const onBeatMouseDown = (beat: Beat) => {
      dragStartBeat = beat
      dragStartNote = null
      dragMoved = false
    }
    // Fires alongside `beatMouseDown` (not instead of it) when the press
    // landed precisely on a note head/number, giving the exact string —
    // `beatMouseDown` alone only identifies the beat (every string on it).
    const onNoteMouseDown = (note: Note) => {
      dragStartNote = note
    }
    const onBeatMouseMove = (beat: Beat) => {
      if (!dragStartBeat) return
      if (beat !== dragStartBeat) dragMoved = true
      api.highlightPlaybackRange(dragStartBeat, beat)
    }
    const onBeatMouseUp = (beat: Beat | null) => {
      if (dragStartBeat && dragMoved && beat) {
        api.applyPlaybackRangeFromHighlight()
      } else {
        api.clearPlaybackRangeHighlight()
        api.playbackRange = null
        if (dragStartBeat) {
          setNotationClick({
            barIndex: dragStartBeat.voice.bar.index,
            beatIndex: dragStartBeat.index,
            stringNo: dragStartNote ? gridStringNumber(dragStartNote) : null,
          })
        }
      }
      dragStartBeat = null
      dragStartNote = null
      dragMoved = false
    }
    api.beatMouseDown.on(onBeatMouseDown)
    api.noteMouseDown.on(onNoteMouseDown)
    api.beatMouseMove.on(onBeatMouseMove)
    api.beatMouseUp.on(onBeatMouseUp)

    return () => {
      api.playerStateChanged.off(onPlayerStateChanged)
      api.postRenderFinished.off(onRenderFinished)
      if (renderScrollTimeout !== null) clearTimeout(renderScrollTimeout)
      api.error.off(onError)
      api.playerPositionChanged.off(onPositionChanged)
      api.activeBeatsChanged.off(onActiveBeatsChanged)
      api.playbackRangeChanged.off(onPlaybackRangeChanged)
      api.beatMouseDown.off(onBeatMouseDown)
      api.noteMouseDown.off(onNoteMouseDown)
      api.beatMouseMove.off(onBeatMouseMove)
      api.beatMouseUp.off(onBeatMouseUp)
      api.destroy()
      apiRef.current = null
      applyScrollRef.current = () => {}
      setReady(false)
      setPosition(null)
      setActiveBeat(null)
      setSelectionRange(null)
      setNotationClick(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTex = React.useCallback((tex: string) => {
    setError(null)
    apiRef.current?.tex(tex)
  }, [])

  const playPause = React.useCallback(() => {
    apiRef.current?.playPause()
  }, [])

  const stop = React.useCallback(() => {
    apiRef.current?.stop()
    // `stop()` while already paused doesn't fire `playerStateChanged` (the
    // state isn't actually changing), so the "currently sounding" highlight
    // needs clearing here too, not just in that handler — otherwise
    // restarting from a paused state left it stuck on wherever it was.
    setActiveBeat(null)
  }, [])

  // Fires on every cursor move while editing (each arrow key / typed note),
  // which can be much more often than one settled edit — instant, not
  // smooth, so a quick run of moves doesn't queue up a pile of overlapping
  // scroll animations that fight each other (each restarting mid-flight,
  // the exact failure mode that made the view look like it had stopped
  // following the cursor). `onRenderFinished`'s own debounced smooth scroll
  // still catches up afterward if editing reflowed the notation.
  const scrollToCursor = React.useCallback((barIndex: number, beatIndex: number) => {
    cursorTargetRef.current = { barIndex, beatIndex }
    applyScrollRef.current('instant')
  }, [])

  // Keeps the playback head parked at the edit cursor while paused/stopped,
  // so pressing play always starts from wherever the user is currently
  // editing instead of resuming from a previous, possibly much later,
  // pause point — which otherwise made Play visibly snap the notation
  // preview away to that old position (reported as the view "jumping
  // down" whenever Space/Play was pressed).
  const seekToCursor = React.useCallback((barIndex: number, beatIndex: number) => {
    const api = apiRef.current
    if (!api) return
    const bar = api.score?.tracks[0]?.staves[0]?.bars[barIndex]
    const beat = bar?.voices[0]?.beats[beatIndex]
    if (!beat) return
    api.tickPosition = beat.absolutePlaybackStart
  }, [])

  const setLayoutMode = React.useCallback((mode: LayoutMode) => {
    const api = apiRef.current
    if (!api) return
    api.settings.display.layoutMode = mode
    api.updateSettings()
    api.render()
  }, [])

  const seek = React.useCallback((ms: number) => {
    const api = apiRef.current
    if (!api) return
    api.timePosition = ms
  }, [])

  const setLooping = React.useCallback((value: boolean) => {
    const api = apiRef.current
    if (!api) return
    api.isLooping = value
    setIsLoopingState(value)
  }, [])

  const clearSelection = React.useCallback(() => {
    const api = apiRef.current
    if (!api) return
    api.clearPlaybackRangeHighlight()
    api.playbackRange = null
  }, [])

  // Loops just the given bar/beat range — the grid's own selection ("tocar
  // esse trecho" in the selection pill) reuses the exact same playback-range
  // mechanism as dragging on the rendered notation above, via alphaTab's own
  // beat-to-tick lookup, instead of recomputing tick math by hand.
  const playRange = React.useCallback(
    (startBarIndex: number, startBeatIndex: number, endBarIndex: number, endBeatIndex: number) => {
      const api = apiRef.current
      if (!api) return
      const staff = api.score?.tracks[0]?.staves[0]
      const startBeat = staff?.bars[startBarIndex]?.voices[0]?.beats[startBeatIndex]
      const endBeat = staff?.bars[endBarIndex]?.voices[0]?.beats[endBeatIndex]
      if (!startBeat || !endBeat) return
      api.highlightPlaybackRange(startBeat, endBeat)
      api.applyPlaybackRangeFromHighlight()
      api.isLooping = true
      setIsLoopingState(true)
      api.play()
    },
    [],
  )

  return {
    ready,
    isPlaying,
    error,
    setTex,
    playPause,
    stop,
    scrollToCursor,
    seekToCursor,
    setLayoutMode,
    position,
    activeBeat,
    notationClick,
    seek,
    isLooping,
    setLooping,
    hasSelection: selectionRange !== null,
    selectionRange,
    clearSelection,
    playRange,
  }
}
