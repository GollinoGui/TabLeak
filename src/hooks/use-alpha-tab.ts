import * as React from 'react'
import { AlphaTabApi } from '@coderline/alphatab'

export function useAlphaTab(containerRef: React.RefObject<HTMLDivElement | null>) {
  const apiRef = React.useRef<AlphaTabApi | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const api = new AlphaTabApi(el, {
      core: {
        fontDirectory: '/font/',
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        soundFont: '/soundfont/sonivox.sf3',
      },
    })
    apiRef.current = api
    setReady(true)
    // @ts-expect-error debug hook, removed before shipping
    window.__debugApi = api

    const onPlayerStateChanged = (e: { state: number }) => setIsPlaying(e.state === 1)
    api.playerStateChanged.on(onPlayerStateChanged)

    const onError = (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      // eslint-disable-next-line no-console
      console.error('[alphaTab error]', e, (e as { semanticDiagnostics?: unknown })?.semanticDiagnostics)
      setError(message)
    }
    api.error.on(onError)

    return () => {
      api.playerStateChanged.off(onPlayerStateChanged)
      api.error.off(onError)
      api.destroy()
      apiRef.current = null
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

  return { ready, isPlaying, error, setTex, playPause, stop }
}
