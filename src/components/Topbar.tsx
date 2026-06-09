import { RefreshCw } from 'lucide-react'
import type { Perfil } from '../types'
import { ProfileSelector } from './ProfileSelector'

interface TopbarProps {
  perfil: Perfil
  emCasos: boolean
  onSelectPerfil: (p: Perfil) => void
  onAtualizar: () => void
  sincronizando: boolean
}

export function Topbar({ perfil, emCasos, onSelectPerfil, onAtualizar, sincronizando }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-cias-borda bg-cias-base/90 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-cias-texto3 sm:block">
          Área
        </span>
        <ProfileSelector perfil={perfil} emCasos={emCasos} onSelect={onSelectPerfil} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onAtualizar}
          disabled={sincronizando}
          className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cias-vermelhoEscuro disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Atualizando…' : 'Atualizar agora'}
        </button>
      </div>
    </header>
  )
}
