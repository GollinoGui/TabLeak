import * as React from 'react'

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
import { LimitExceededError, useLibrary } from '@/store/library-store'

export function CreateFolderDialog({ trigger }: { trigger: React.ReactNode }) {
  const { activeFolderCount, maxFolders, createFolder } = useLibrary()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const atLimit = activeFolderCount >= maxFolders

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      createFolder(name.trim() || `Pasta sem título ${activeFolderCount + 1}`)
      setOpen(false)
      setName('')
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
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>Organize suas tablaturas em pastas.</DialogDescription>
          </DialogHeader>

          {atLimit && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Você atingiu o limite de {maxFolders} pastas do seu plano.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="folder-name">Nome</Label>
            <Input
              id="folder-name"
              placeholder="Ex: Riffs, Estudos, Banda X"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={atLimit}>
              Criar pasta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
