const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navegação',
    items: [
      ['← →', 'Mover no tempo'],
      ['↑ ↓', 'Mover entre cordas'],
      ['0-9', 'Casa/traste'],
      ['Backspace', 'Apagar nota'],
      ['N', 'Nome de nota (A-G)'],
      ['Espaço', 'Play / pausa'],
    ],
  },
  {
    title: 'Técnicas',
    items: [
      ['/ \\', 'Slide'],
      ['I', 'Slide sem casa def. (repita p/ direção)'],
      ['H', 'Hammer-on'],
      ['P', 'Pull-off'],
      ['B', 'Bend (repita p/ tamanho)'],
      ['Shift+B', 'Pre-bend'],
      ['M', 'Palm mute'],
      ['~', 'Vibrato'],
      ['L', 'Let ring'],
      ['K', 'Harmônico natural'],
      ['T', 'Tapping'],
      ['X', 'Nota morta'],
      ['U', 'Palhetada p/ cima'],
      ['D', 'Palhetada p/ baixo'],
    ],
  },
]

export function ShortcutsPanel() {
  return (
    <div className="flex flex-col gap-3 text-xs">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {group.title}
          </h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {group.items.map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <kbd className="shrink-0 rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[10px] whitespace-nowrap">
                  {key}
                </kbd>
                <span className="truncate text-muted-foreground" title={label}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
