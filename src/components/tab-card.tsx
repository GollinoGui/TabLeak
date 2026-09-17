import { Link } from 'react-router-dom'
import { FileMusic, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLibrary } from '@/store/library-store'
import type { Tab } from '@/types'

export function TabCard({ tab }: { tab: Tab }) {
  const { softDeleteTab } = useLibrary()

  return (
    <Card className="group relative overflow-hidden transition-colors hover:border-primary/50">
      <Link to={`/tabs/${tab.id}`} className="block">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
            <FileMusic className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{tab.name}</p>
            <p className="text-xs text-muted-foreground">
              {tab.instrumentConfig.strings} cordas · {tab.instrumentConfig.tuning.join(' ')}
            </p>
          </div>
        </CardContent>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        onClick={(e) => {
          e.preventDefault()
          softDeleteTab(tab.id)
        }}
      >
        <Trash2 />
        <span className="sr-only">Excluir</span>
      </Button>
    </Card>
  )
}
