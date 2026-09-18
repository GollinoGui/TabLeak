import * as React from 'react'

import { cn } from '@/lib/utils'
import type { PlaybackPosition, SelectionRange } from '@/hooks/use-alpha-tab'

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

interface PlaybackProgressBarProps {
  position: PlaybackPosition | null
  /** Loop selection, in ticks — shaded on the track as a preview of what a
   * loop would repeat. Positioned by tick, not time, since it comes straight
   * from alphaTab's `playbackRange` (also tick-based) with no time conversion. */
  selectionRange: SelectionRange | null
  onSeek: (ms: number) => void
}

export function PlaybackProgressBar({ position, selectionRange, onSeek }: PlaybackProgressBarProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const endTime = position?.endTime ?? 0
  const currentTime = position?.currentTime ?? 0
  const progress = endTime > 0 ? Math.min(1, currentTime / endTime) : 0

  const endTick = position?.endTick ?? 0
  const selectionStartPct =
    selectionRange && endTick > 0 ? Math.min(1, selectionRange.startTick / endTick) : null
  const selectionEndPct =
    selectionRange && endTick > 0 ? Math.min(1, selectionRange.endTick / endTick) : null

  const seekToClientX = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || endTime <= 0) return
      const rect = track.getBoundingClientRect()
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
      onSeek(Math.min(1, Math.max(0, ratio)) * endTime)
    },
    [endTime, onSeek],
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (endTime <= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    seekToClientX(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    seekToClientX(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
        {formatTime(currentTime)}
      </span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Posição da reprodução"
        aria-valuemin={0}
        aria-valuemax={endTime}
        aria-valuenow={currentTime}
        className={cn(
          'group relative h-4 flex-1 cursor-pointer touch-none',
          endTime <= 0 && 'pointer-events-none opacity-50',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-secondary" />
        {selectionStartPct !== null && selectionEndPct !== null && (
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/40"
            style={{
              left: `${selectionStartPct * 100}%`,
              width: `${Math.max(0, selectionEndPct - selectionStartPct) * 100}%`,
            }}
          />
        )}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className={cn(
            'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow transition-transform',
            'group-hover:scale-110',
            dragging && 'scale-110',
          )}
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <span className="w-9 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
        {formatTime(endTime)}
      </span>
    </div>
  )
}
