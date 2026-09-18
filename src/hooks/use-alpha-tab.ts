import * as React from 'react'
import type { model } from '@coderline/alphatab'
import { AlphaTabApi, LayoutMode, NotationElement, ScrollMode } from '@coderline/alphatab'

type Beat = model.Beat

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
function scrollRectIntoView(container: HTMLElement, rect: Rect) {
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
  // Instant, not smooth: this runs after every edit (sometimes several times
  // in quick succession while alphaTab settles a re-layout), and overlapping
  // smooth-scroll animations fighting each other is what made the view
  // visibly snap back to the start of the tab instead of following the cursor.
  container.scrollTo({
    left: left ?? container.scrollLeft,
    top: top ?? container.scrollTop,
    behavior: 'instant',
  })
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

  // Which beat to keep in view. Re-applied after every render (not just when
  // the target changes) because editing a note can reflow the notation (e.g.
  // wrap a new line), moving that beat even though the cursor didn't.
  const cursorTargetRef = React.useRef<{ barIndex: number; beatIndex: number } | null>(null)
  const applyScrollRef = React.useRef<() => void>(() => {})

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const api = new AlphaTabApi(el, {
      core: {
        fontDirectory: '/font/',
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
      },
    })
    apiRef.current = api
    setReady(true)

    const applyScroll = () => {
      const target = cursorTargetRef.current
      const container = containerRef.current
      if (!target || !container) return
      const bar = api.score?.tracks[0]?.staves[0]?.bars[target.barIndex]
      const beat = bar?.voices[0]?.beats[target.beatIndex]
      const bounds = beat ? api.boundsLookup?.findBeat(beat) : null
      if (!bounds) return
      scrollRectIntoView(container, bounds.realBounds)
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
      el.classList.toggle('at-playing', playing)
      // Hand scrolling over to alphaTab's own playback-cursor tracking only
      // while actually playing; back to our edit-cursor tracking otherwise.
      api.settings.player.scrollMode = playing ? ScrollMode.Continuous : ScrollMode.Off
      api.updateSettings()
    }
    api.playerStateChanged.on(onPlayerStateChanged)

    // AlphaTab itself force-scrolls to the playback position on every render,
    // which without an active playback position means "back to the start" —
    // this listener runs after that (it fires from the same event) and wins,
    // scrolling to wherever the user is actually editing instead.
    api.postRenderFinished.on(applyScroll)

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
    const onActiveBeatsChanged = (e: { activeBeats: Beat[] }) => {
      const beat = e.activeBeats[0]
      setActiveBeat(beat ? { barIndex: beat.voice.bar.index, beatIndex: beat.index } : null)
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
    // any existing selection (a plain click with no drag).
    let dragStartBeat: Beat | null = null
    let dragMoved = false
    const onBeatMouseDown = (beat: Beat) => {
      dragStartBeat = beat
      dragMoved = false
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
      }
      dragStartBeat = null
      dragMoved = false
    }
    api.beatMouseDown.on(onBeatMouseDown)
    api.beatMouseMove.on(onBeatMouseMove)
    api.beatMouseUp.on(onBeatMouseUp)

    return () => {
      api.playerStateChanged.off(onPlayerStateChanged)
      api.postRenderFinished.off(applyScroll)
      api.error.off(onError)
      api.playerPositionChanged.off(onPositionChanged)
      api.activeBeatsChanged.off(onActiveBeatsChanged)
      api.playbackRangeChanged.off(onPlaybackRangeChanged)
      api.beatMouseDown.off(onBeatMouseDown)
      api.beatMouseMove.off(onBeatMouseMove)
      api.beatMouseUp.off(onBeatMouseUp)
      api.destroy()
      apiRef.current = null
      applyScrollRef.current = () => {}
      setReady(false)
      setPosition(null)
      setActiveBeat(null)
      setSelectionRange(null)
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

  const scrollToCursor = React.useCallback((barIndex: number, beatIndex: number) => {
    cursorTargetRef.current = { barIndex, beatIndex }
    applyScrollRef.current()
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
    setLayoutMode,
    position,
    activeBeat,
    seek,
    isLooping,
    setLooping,
    hasSelection: selectionRange !== null,
    selectionRange,
    clearSelection,
    playRange,
  }
}
