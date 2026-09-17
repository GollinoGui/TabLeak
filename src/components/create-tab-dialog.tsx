import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_TUNING_BY_STRINGS } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { LimitExceededError, useLibrary } from '@/store/library-store'

const STRING_COUNTS = [4, 5, 6, 7, 8, 9]

/** Keeps tuning fields to a valid note letter plus an optional accidental
 * (e.g. "E", "F#", "Bb") — free text otherwise lets digits or garbage in,
 * which silently falls back to a default note at render time. */
function sanitizeTuningInput(value: string): string {
  const letter = value.trim()[0]?.toUpperCase()
  if (!letter || !'ABCDEFG'.includes(letter)) return ''
  const accidental = value.trim()[1]
  if (accidental === '#') return `${letter}#`
  if (accidental?.toLowerCase() === 'b') return `${letter}b`
  return letter
}

interface CreateTabDialogProps {
  trigger: React.ReactNode
  defaultFolderId?: string | null
}

export function CreateTabDialog({ trigger, defaultFolderId = null }: CreateTabDialogProps) {
  const { activeFolders, activeTabCount, maxTabs, createTab } = useLibrary()
  const navigate = useNavigate()

  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [folderId, setFolderId] = React.useState<string>(defaultFolderId ?? 'none')
  const [strings, setStrings] = React.useState(6)
  const [tuning, setTuning] = React.useState<string[]>(DEFAULT_TUNING_BY_STRINGS[6])
  const [gauge, setGauge] = React.useState('0.09')
  const [error, setError] = React.useState<string | null>(null)

  const atLimit = activeTabCount >= maxTabs

  function handleStringsChange(value: string) {
    const n = Number(value)
    setStrings(n)
    setTuning(DEFAULT_TUNING_BY_STRINGS[n] ?? Array.from({ length: n }, () => 'E'))
  }

  function handleTuningChange(index: number, value: string) {
    setTuning((prev) => prev.map((t, i) => (i === index ? sanitizeTuningInput(value) : t)))
  }

  function resetForm() {
    setName('')
    setFolderId(defaultFolderId ?? 'none')
    setStrings(6)
    setTuning(DEFAULT_TUNING_BY_STRINGS[6])
    setGauge('0.09')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const finalName = name.trim() || `Tablatura sem título ${activeTabCount + 1}`
      const tab = createTab({
        name: finalName,
        folderId: folderId === 'none' ? null : folderId,
        instrumentConfig: { strings, tuning, gauge: gauge.trim() || '0.09' },
      })
      setOpen(false)
      resetForm()
      navigate(`/tabs/${tab.id}`)
    } catch (err) {
      if (err instanceof LimitExceededError) {
        setError(err.message)
      } else {
        throw err
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Criar tablatura</DialogTitle>
            <DialogDescription>
              Configure o instrumento antes de começar a editar.
            </DialogDescription>
          </DialogHeader>

          {atLimit && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Você atingiu o limite de {maxTabs} tablaturas do seu plano. Exclua uma tab ou
              libere espaço na lixeira.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tab-name">Nome</Label>
            <Input
              id="tab-name"
              placeholder={`Tablatura sem título ${activeTabCount + 1}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Pasta</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem pasta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem pasta</SelectItem>
                {activeFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Número de cordas</Label>
            <Select value={String(strings)} onValueChange={handleStringsChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRING_COUNTS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} cordas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Afinação (da mais aguda para a mais grave)</Label>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2">
              {tuning
                .map((note, i) => ({ note, i }))
                .reverse()
                .map(({ note, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">
                      {tuning.length - i}
                    </span>
                    <Input
                      value={note}
                      maxLength={2}
                      onChange={(e) => handleTuningChange(i, e.target.value)}
                      className="h-8 w-16 shrink-0 text-center"
                    />
                    <span className="h-px flex-1 bg-border" />
                  </div>
                ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Pré-visualização</Label>
            <div className="overflow-x-auto rounded-lg border border-border bg-muted/30">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {tuning
                    .map((note, i) => ({ note, i }))
                    .reverse()
                    .map(({ note, i }) => (
                      <tr key={i}>
                        <td className="w-10 shrink-0 border-r border-border px-2 py-1 text-center font-mono text-xs font-semibold text-foreground">
                          {note || '-'}
                        </td>
                        {Array.from({ length: 6 }).map((_, col) => (
                          <td
                            key={col}
                            className={cn(
                              'h-8 w-8 border-b border-border/70 px-0 py-0 text-center align-middle font-mono text-muted-foreground',
                              col % 4 === 0 && col > 0 && 'border-l-2 border-l-border',
                            )}
                          >
                            ·
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gauge">Cordas</Label>
            <Input id="gauge" value={gauge} onChange={(e) => setGauge(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={atLimit}>
              Criar e abrir editor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
