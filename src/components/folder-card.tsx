import { Folder as FolderIcon, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLibrary } from '@/store/library-store'
import type { Folder } from '@/types'

export function FolderCard({ folder, onOpen }: { folder: Folder; onOpen: () => void }) {
  const { softDeleteFolder, activeTabs } = useLibrary()
  const count = activeTabs.filter((t) => t.folderId === folder.id).length

  return (
    <Card className="group relative overflow-hidden transition-colors hover:border-primary/50">
      <button onClick={onOpen} className="block w-full text-left">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FolderIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{folder.name}</p>
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? 'tablatura' : 'tablaturas'}
            </p>
          </div>
        </CardContent>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault()
          softDeleteFolder(folder.id)
        }}
      >
        <Trash2 />
        <span className="sr-only">Excluir</span>
      </Button>
    </Card>
  )
}
