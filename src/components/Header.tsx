import { useState } from 'react'
import { RefreshCw, Settings, Scale } from 'lucide-react'
import type { Perfil } from '../types'
import { ProfileSelector } from './ProfileSelector'
import { formatDateBR } from '../lib/format'

interface HeaderProps {
  perfil: Perfil
  emCasos: boolean
  onSelectPerfil: (p: Perfil) => void
  onAbrirConfig: () => void
  onAtualizarAgora: () => void
  sincronizando: boolean
  lastSyncAt: string | null
}

const LOGO_URL = `${import.meta.env.BASE_URL}logo-cias.png`

export function Header({
  perfil,
  emCasos,
  onSelectPerfil,
  onAbrirConfig,
  onAtualizarAgora,
  sincronizando,
  lastSyncAt,
}: HeaderProps) {
  const [logoErro, setLogoErro] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-cias-borda bg-cias-base/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        {/* Logo do CIAS, à esquerda. Coloque o arquivo em public/logo-cias.png. */}
        <div className="flex shrink-0 items-center gap-3">
          {logoErro ? (
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cias-vermelho text-cias-base">
                <Scale size={18} />
              </span>
              <span className="text-lg font-bold tracking-tight text-cias-texto">
                CIAS
              </span>
            </div>
          ) : (
            <img src={LOGO_URL} alt="CIAS" className="h-9 w-auto" onError={() => setLogoErro(true)} />
          )}
          <span className="hidden text-sm text-cias-texto2 sm:inline">· Contencioso</span>
        </div>

        {/* Seletor de perfil grande, imediatamente ao lado do logo. */}
        <ProfileSelector perfil={perfil} emCasos={emCasos} onSelect={onSelectPerfil} />

        <div className="ml-auto flex items-center gap-2">
          {lastSyncAt && (
            <span className="hidden text-xs text-cias-texto2 md:inline">
              Última sincronização: {formatDateBR(lastSyncAt)}
            </span>
          )}
          <button
            onClick={onAtualizarAgora}
            disabled={sincronizando}
            className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-3.5 py-2 text-sm font-semibold text-cias-base transition hover:bg-cias-vermelho/90 disabled:opacity-60"
          >
            <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
            {sincronizando ? 'Atualizando…' : 'Atualizar agora'}
          </button>
          <button
            onClick={onAbrirConfig}
            aria-label="Configurações"
            title="Configurações"
            className="inline-flex items-center justify-center rounded-lg border border-cias-borda p-2 text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-texto"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
