import type { Perfil } from '../types'

interface ProfileSelectorProps {
  perfil: Perfil
  /** Indica se estamos na área de casos (true) ou em Configurações (false). */
  emCasos: boolean
  onSelect: (p: Perfil) => void
}

const OPCOES: { valor: Perfil; rotulo: string }[] = [
  { valor: 'civel', rotulo: 'Cível' },
  { valor: 'trabalhista', rotulo: 'Trabalhista' },
]

/**
 * Controle segmentado grande de perfil. Trocar de perfil é livre (sem autenticação).
 * Selecionar um perfil também volta da tela de Configurações para o trabalho de casos.
 */
export function ProfileSelector({ perfil, emCasos, onSelect }: ProfileSelectorProps) {
  return (
    <div className="flex w-full rounded-lg border border-cias-borda bg-cias-superficie2 p-1">
      {OPCOES.map((op) => {
        const ativo = emCasos && perfil === op.valor
        return (
          <button
            key={op.valor}
            onClick={() => onSelect(op.valor)}
            aria-pressed={ativo}
            className={[
              'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition',
              ativo
                ? 'bg-cias-base text-cias-vermelho shadow-sm'
                : 'text-cias-texto2 hover:text-cias-texto',
            ].join(' ')}
          >
            {op.rotulo}
          </button>
        )
      })}
    </div>
  )
}
