const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navegação',
    items: [
      ['← →', 'Mover no tempo'],
      ['↑ ↓', 'Mover entre cordas'],
      ['0-9', 'Casa/traste'],
      ['Backspace', 'Apagar nota (remove a coluna se já estiver vazia)'],
      ['Insert', 'Inserir coluna vazia (espaço) no cursor'],
      ['N', 'Nome de nota (A-G)'],
      ['Espaço', 'Play / pausa'],
      ['Arrastar', 'Marcar trecho p/ loop (na partitura)'],
      ['Arrastar (grade)', 'Selecionar trecho: BPM, tocar, copiar, apagar, mover'],
      ['Ctrl+C / V', 'Copiar / colar o trecho selecionado no cursor'],
    ],
  },
  {
    title: 'Duração',
    items: [
      ['Alt+1', 'Semínima (1/4)'],
      ['Alt+2', 'Colcheia (1/8)'],
      ['Alt+3', 'Semicolcheia (1/16)'],
      ['Alt+4', 'Alterna tercina'],
      ['Alt+5', 'Alterna sextina'],
      ['Alt+6', 'Alterna pontuado'],
    ],
  },
  {
    title: 'Técnicas',
    items: [
      ['S', 'Slide (liga com a próxima nota)'],
      ['/', 'Slide de saída p/ cima (2x rápido = p/ baixo)'],
      ['\\', 'Slide de saída p/ baixo'],
      ['I', 'Slide sem casa def. (repita p/ direção)'],
      ['H', 'Hammer-on'],
      ['P', 'Pull-off'],
      ['B', 'Bend (repita p/ tamanho)'],
      ['Shift+B', 'Pre-bend'],
      ['Ctrl+B', 'Bend com retorno (sobe e desce, som completo)'],
      ['M', 'Palm mute'],
      ['~', 'Vibrato'],
      ['L', 'Let ring'],
      ['K', 'Harmônico natural'],
      ['Shift+K', 'Harmônico pinçado'],
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
