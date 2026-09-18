import * as React from 'react'
import { AlphaTabApi, LayoutMode, NotationElement, ScrollMode } from '@coderline/alphatab'

interface Rect {
  x: number
  y: number
  w: number
  h: number
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

    return () => {
      api.playerStateChanged.off(onPlayerStateChanged)
      api.postRenderFinished.off(applyScroll)
      api.error.off(onError)
      api.destroy()
      apiRef.current = null
      applyScrollRef.current = () => {}
      setReady(false)
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

  return { ready, isPlaying, error, setTex, playPause, stop, scrollToCursor, setLayoutMode }
}
