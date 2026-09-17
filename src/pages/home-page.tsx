import * as React from 'react'
import { ArrowLeft, FolderPlus, Guitar, Plus } from 'lucide-react'

import { CreateFolderDialog } from '@/components/create-folder-dialog'
import { CreateTabDialog } from '@/components/create-tab-dialog'
import { EmptyState } from '@/components/empty-state'
import { FolderCard } from '@/components/folder-card'
import { ProfileMenu } from '@/components/profile-menu'
import { TabCard } from '@/components/tab-card'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { useLibrary } from '@/store/library-store'

export function HomePage() {
  const { activeFolders, activeTabs, activeFolderCount, maxFolders } = useLibrary()
  const [openFolderId, setOpenFolderId] = React.useState<string | null>(null)

  const isEmpty = activeFolders.length === 0 && activeTabs.length === 0
  const openFolder = activeFolders.find((f) => f.id === openFolderId) ?? null
  const rootTabs = activeTabs.filter((t) => t.folderId === null)
  const folderTabs = openFolder ? activeTabs.filter((t) => t.folderId === openFolder.id) : []

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Guitar className="size-6 text-primary" />
          <span className="text-lg font-semibold">TabLeak</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : openFolder ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setOpenFolderId(null)}>
                <ArrowLeft />
              </Button>
              <h1 className="text-xl font-semibold">{openFolder.name}</h1>
            </div>
            <CreateTabDialog
              defaultFolderId={openFolder.id}
              trigger={
                <Button>
                  <Plus /> Criar tablatura
                </Button>
              }
            />
          </div>

          {folderTabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tablatura nesta pasta ainda.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folderTabs.map((tab) => (
                <TabCard key={tab.id} tab={tab} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Minhas tablaturas</h1>
            <div className="flex items-center gap-2">
              <CreateFolderDialog
                trigger={
                  <Button variant="outline" disabled={activeFolderCount >= maxFolders}>
                    <FolderPlus /> Nova pasta
                  </Button>
                }
              />
              <CreateTabDialog
                trigger={
                  <Button>
                    <Plus /> Criar tablatura
                  </Button>
                }
              />
            </div>
          </div>

          {activeFolders.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Pastas</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={() => setOpenFolderId(folder.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Tablaturas</h2>
            {rootTabs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma tablatura fora de pastas.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rootTabs.map((tab) => (
                  <TabCard key={tab.id} tab={tab} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
