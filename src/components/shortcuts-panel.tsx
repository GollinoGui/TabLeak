const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navegação',
    items: [
      ['← →', 'Mover entre posições (tempo)'],
      ['↑ ↓', 'Mover entre cordas'],
      ['0-9', 'Digitar número da casa'],
      ['Backspace', 'Apagar nota da posição atual'],
      ['N', 'Alternar modo de inserção por nome de nota'],
      ['Espaço', 'Reproduzir / pausar'],
    ],
  },
  {
    title: 'Técnicas',
    items: [
      ['/ ou \\', 'Slide'],
      ['H', 'Hammer-on'],
      ['P', 'Pull-off'],
      ['B', 'Bend (repita para alternar o tamanho: 1/4, 1/2, 3/4, full, 1 1/2, 2x)'],
      ['Shift+B', 'Pre-bend (PB): começa dobrado e desce'],
      ['M', 'Palm mute (PM)'],
      ['~', 'Vibrato'],
      ['K', 'Harmônico natural'],
      ['T', 'Tapping'],
    ],
  },
]

export function ShortcutsPanel() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {group.title}
          </h3>
          {group.items.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
                {key}
              </kbd>
              <span className="text-right text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
