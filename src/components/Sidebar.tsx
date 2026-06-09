import { Inbox, Briefcase, Settings } from 'lucide-react'
import { formatDateBR } from '../lib/format'

type View = 'cases' | 'config'
type Aba = 'intimacoes' | 'processos'

interface SidebarProps {
  view: View
  aba: Aba
  onSelectAba: (aba: Aba) => void
  onOpenConfig: () => void
  lastSyncAt: string | null
}

const LOGO = `${import.meta.env.BASE_URL}logo-cias-header.png`

export function Sidebar({ view, aba, onSelectAba, onOpenConfig, lastSyncAt }: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-cias-borda bg-cias-base">
      {/* Logo do CIAS */}
      <div className="border-b border-cias-borda px-5 py-4">
        <img src={LOGO} alt="CIAS — Consórcio Aliança para a Saúde" className="h-12 w-auto" />
        <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cias-texto3">
          Contencioso · Gestão Processual
        </p>
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
          icon={<Briefcase size={18} />}
          label="Processos"
          active={view === 'cases' && aba === 'processos'}
          onClick={() => onSelectAba('processos')}
        />
      </nav>

      {/* Rodapé: Configurações + última sincronização */}
      <div className="space-y-2 border-t border-cias-borda px-3 py-3">
        <NavItem
          icon={<Settings size={18} />}
          label="Configurações"
          active={view === 'config'}
          onClick={onOpenConfig}
        />
        <p className="px-3 pt-1 text-[11px] leading-snug text-cias-texto3">
          {lastSyncAt ? (
            <>
              Última sincronização
              <br />
              <span className="text-cias-texto2">{formatDateBR(lastSyncAt)}</span>
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
