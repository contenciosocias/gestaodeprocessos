import { Inbox, ClipboardList, Briefcase, Settings, RefreshCw } from 'lucide-react'
import type { Perfil } from '../types'
import { ProfileSelector } from './ProfileSelector'
import { formatDateBR } from '../lib/format'

type View = 'cases' | 'config'
type Aba = 'intimacoes' | 'tarefas' | 'processos'

interface SidebarProps {
  view: View
  aba: Aba
  perfil: Perfil
  onSelectPerfil: (p: Perfil) => void
  onSelectAba: (aba: Aba) => void
  onOpenConfig: () => void
  onAtualizar: () => void
  sincronizando: boolean
  lastSyncAt: string | null
}

const LOGO = `${import.meta.env.BASE_URL}logo-cias-header.png`

export function Sidebar({
  view,
  aba,
  perfil,
  onSelectPerfil,
  onSelectAba,
  onOpenConfig,
  onAtualizar,
  sincronizando,
  lastSyncAt,
}: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-cias-borda bg-cias-base">
      {/* Logo + seletor de perfil (Cível / Trabalhista) */}
      <div className="border-b border-cias-borda px-5 pb-4 pt-4">
        <img src={LOGO} alt="CIAS — Consórcio Aliança para a Saúde" className="h-11 w-auto" />
        <div className="mt-4">
          <ProfileSelector perfil={perfil} emCasos={view === 'cases'} onSelect={onSelectPerfil} />
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavItem
          icon={<Inbox size={18} />}
          label="Intimações"
          active={view === 'cases' && aba === 'intimacoes'}
          onClick={() => onSelectAba('intimacoes')}
        />
        <NavItem
          icon={<ClipboardList size={18} />}
          label="Tarefas"
          active={view === 'cases' && aba === 'tarefas'}
          onClick={() => onSelectAba('tarefas')}
        />
        <NavItem
          icon={<Briefcase size={18} />}
          label="Processos"
          active={view === 'cases' && aba === 'processos'}
          onClick={() => onSelectAba('processos')}
        />
      </nav>

      {/* Rodapé: Configurações, Atualizar agora e última sincronização */}
      <div className="space-y-3 border-t border-cias-borda px-3 py-3">
        <NavItem
          icon={<Settings size={18} />}
          label="Configurações"
          active={view === 'config'}
          onClick={onOpenConfig}
        />
        <button
          onClick={onAtualizar}
          disabled={sincronizando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-cias-vermelho px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cias-vermelhoEscuro disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Atualizando…' : 'Atualizar agora'}
        </button>
        <p className="px-1 text-center text-[11px] leading-snug text-cias-texto3">
          {lastSyncAt ? (
            <>
              Última sincronização: <span className="text-cias-texto2">{formatDateBR(lastSyncAt)}</span>
            </>
          ) : (
            'Sem sincronização ainda'
          )}
        </p>
      </div>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
        active
          ? 'bg-cias-vermelho/10 text-cias-vermelho'
          : 'text-cias-texto2 hover:bg-cias-superficie2 hover:text-cias-texto',
      ].join(' ')}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-cias-vermelho" />}
      <span className={active ? 'text-cias-vermelho' : 'text-cias-texto3'}>{icon}</span>
      {label}
    </button>
  )
}
