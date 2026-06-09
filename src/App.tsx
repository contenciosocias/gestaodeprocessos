import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Perfil } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import { getLastSyncAt, maybeSync } from './lib/api'
import { Header } from './components/Header'
import { IntimacoesTab } from './components/IntimacoesTab'
import { ProcessosTab } from './components/ProcessosTab'
import { ConfiguracoesScreen } from './components/ConfiguracoesScreen'

type View = 'cases' | 'config'
type Aba = 'intimacoes' | 'processos'

export default function App() {
  // Estado inicial: perfil Cível, aba Intimações.
  const [view, setView] = useState<View>('cases')
  const [perfil, setPerfil] = useState<Perfil>('civel')
  const [aba, setAba] = useState<Aba>('intimacoes')

  const [sincronizando, setSincronizando] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  // Dispara a sincronização (respeitando o throttle, salvo `force`) e atualiza a UI.
  const sincronizar = useCallback(async (force: boolean) => {
    if (!isSupabaseConfigured) return
    setSincronizando(true)
    try {
      await maybeSync(force)
    } catch (e) {
      console.error('Falha na sincronização:', e)
    } finally {
      setLastSyncAt(await getLastSyncAt().catch(() => null))
      setRefreshSignal((n) => n + 1)
      setSincronizando(false)
    }
  }, [])

  // Ao abrir o app / recarregar a página: sincroniza com throttle de ~10 min.
  useEffect(() => {
    void sincronizar(false)
  }, [sincronizar])

  function selecionarPerfil(p: Perfil) {
    setPerfil(p)
    setView('cases') // selecionar um perfil volta da tela de Configurações
  }

  return (
    <div className="min-h-screen bg-cias-superficie">
      <Header
        perfil={perfil}
        emCasos={view === 'cases'}
        onSelectPerfil={selecionarPerfil}
        onAbrirConfig={() => setView('config')}
        onAtualizarAgora={() => void sincronizar(true)}
        sincronizando={sincronizando}
        lastSyncAt={lastSyncAt}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {!isSupabaseConfigured ? (
          <AvisoConfig />
        ) : view === 'config' ? (
          <ConfiguracoesScreen />
        ) : (
          <>
            {/* Abas do perfil ativo */}
            <div className="mb-5 flex gap-1 border-b border-cias-borda">
              <TabButton ativo={aba === 'intimacoes'} onClick={() => setAba('intimacoes')}>
                Intimações
              </TabButton>
              <TabButton ativo={aba === 'processos'} onClick={() => setAba('processos')}>
                Processos
              </TabButton>
            </div>

            {aba === 'intimacoes' ? (
              <IntimacoesTab perfil={perfil} refreshSignal={refreshSignal} />
            ) : (
              <ProcessosTab perfil={perfil} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function TabButton({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition',
        ativo ? 'border-cias-vermelho text-cias-vermelho' : 'border-transparent text-cias-texto2 hover:text-cias-texto',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function AvisoConfig() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-cias-laranja/40 bg-cias-laranja/10 px-4 py-3 text-sm text-cias-texto">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-cias-laranja" />
      <div>
        <strong>Supabase não configurado.</strong> Defina <code>VITE_SUPABASE_URL</code> e{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> (arquivo <code>.env</code> ou secrets do deploy). Veja o README.
      </div>
    </div>
  )
}
