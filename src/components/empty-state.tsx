import { Guitar } from 'lucide-react'

import { CreateTabDialog } from '@/components/create-tab-dialog'
import { Button } from '@/components/ui/button'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Guitar className="size-8" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Nenhuma tablatura ainda</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Crie sua primeira tablatura e comece a escrever um riff sem tirar as mãos do
          teclado.
        </p>
      </div>
      <CreateTabDialog trigger={<Button size="lg">Criar tablatura</Button>} />
    </div>
  )
}
