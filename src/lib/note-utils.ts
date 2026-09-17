const SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

export function normalizeNoteName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'E'
  const letter = trimmed[0].toUpperCase()
  const rest = trimmed.slice(1).replace('♯', '#').replace('♭', 'b')
  const candidate = letter + rest
  if (candidate in SEMITONES) return candidate
  if (letter in SEMITONES) return letter
  return 'E'
}

export function noteSemitone(name: string): number {
  return SEMITONES[normalizeNoteName(name)] ?? 4
}

const NOTE_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

/** Note name sounding at `fret` on a string tuned to `openNote` (sharps preferred). */
export function noteNameAtFret(openNote: string, fret: number): string {
  const semitone = (noteSemitone(openNote) + fret) % 12
  return NOTE_NAMES_SHARP[semitone]
}

/** Assigns descending octaves to a list of note names ordered from the highest
 * (string 1) to the lowest string, so each subsequent string is pitched lower
 * than the previous one — matching how real instruments are strung. */
export function assignDescendingOctaves(
  namesHighToLow: string[],
  startOctave = 4,
): { name: string; octave: number }[] {
  const result: { name: string; octave: number }[] = []
  let prevAbs: number | null = null
  let octave = startOctave
  for (const raw of namesHighToLow) {
    const name = normalizeNoteName(raw)
    const semitone = noteSemitone(name)
    if (prevAbs !== null) {
      while (octave * 12 + semitone >= prevAbs) octave -= 1
    }
    const abs = octave * 12 + semitone
    result.push({ name, octave })
    prevAbs = abs
  }
  return result
}

/** Smallest non-negative fret on a string tuned to `openNote` that plays `targetNote`. */
export function fretForNote(openNote: string, targetNote: string): number {
  const open = noteSemitone(openNote)
  const target = noteSemitone(targetNote)
  const diff = (target - open) % 12
  return diff < 0 ? diff + 12 : diff
}
