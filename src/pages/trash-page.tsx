import { Link } from 'react-router-dom'
import { ArrowLeft, FileMusic, Folder as FolderIcon, RotateCcw } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLibrary } from '@/store/library-store'

function daysLeft(deletedAt: string | null) {
  if (!deletedAt) return 30
  const elapsedMs = Date.now() - new Date(deletedAt).getTime()
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
  return Math.max(0, 30 - elapsedDays)
}

export function TrashPage() {
  const { trashedFolders, trashedTabs, restoreFolder, restoreTab } = useLibrary()
  const isEmpty = trashedFolders.length === 0 && trashedTabs.length === 0

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Lixeira</h1>
        </div>
        <ThemeToggle />
      </header>

      <p className="text-sm text-muted-foreground">
        Itens excluídos ficam aqui por 30 dias antes de serem removidos definitivamente.
      </p>

      {isEmpty ? (
        <p className="py-12 text-center text-sm text-muted-foreground">A lixeira está vazia.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {trashedFolders.map((folder) => (
            <Card key={folder.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <FolderIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Pasta · restam {daysLeft(folder.deletedAt)} dias
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restoreFolder(folder.id)}>
                  <RotateCcw /> Restaurar
                </Button>
              </CardContent>
            </Card>
          ))}
          {trashedTabs.map((tab) => (
            <Card key={tab.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <FileMusic className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tab.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Tablatura · restam {daysLeft(tab.deletedAt)} dias
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restoreTab(tab.id)}>
                  <RotateCcw /> Restaurar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
