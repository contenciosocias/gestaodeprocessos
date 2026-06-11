import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Perfil } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import { getLastSyncAt, maybeSync } from './lib/api'
import { Sidebar } from './components/Sidebar'
import { IntimacoesTab } from './components/IntimacoesTab'
import { TarefasTab } from './components/TarefasTab'
import { ProcessosTab } from './components/ProcessosTab'
import { ConfiguracoesScreen } from './components/ConfiguracoesScreen'

type View = 'cases' | 'config'
type Aba = 'intimacoes' | 'tarefas' | 'processos'

export default function App() {
  // Estado inicial: perfil Cível, aba Intimações.
  const [view, setView] = useState<View>('cases')
  const [perfil, setPerfil] = useState<Perfil>('civel')
  const [aba, setAba] = useState<Aba>('intimacoes')

  const [sincronizando, setSincronizando] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

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

  // Ao abrir / recarregar: sincroniza com throttle de ~10 min.
  useEffect(() => {
    void sincronizar(false)
  }, [sincronizar])

  function selecionarPerfil(p: Perfil) {
    setPerfil(p)
    setView('cases') // selecionar perfil volta da tela de Configurações
  }
  function selecionarAba(a: Aba) {
    setAba(a)
    setView('cases')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cias-superficie text-cias-texto">
      <Sidebar
        view={view}
        aba={aba}
        perfil={perfil}
        onSelectPerfil={selecionarPerfil}
        onSelectAba={selecionarAba}
        onOpenConfig={() => setView('config')}
        onAtualizar={() => void sincronizar(true)}
        sincronizando={sincronizando}
        lastSyncAt={lastSyncAt}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl px-6 py-6">
            {!isSupabaseConfigured ? (
              <AvisoConfig />
            ) : view === 'config' ? (
              <ConfiguracoesScreen />
            ) : aba === 'intimacoes' ? (
              <IntimacoesTab perfil={perfil} refreshSignal={refreshSignal} />
            ) : aba === 'tarefas' ? (
              <TarefasTab perfil={perfil} refreshSignal={refreshSignal} />
            ) : (
              <ProcessosTab perfil={perfil} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function AvisoConfig() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-cias-laranja/40 bg-cias-laranja/10 px-4 py-3 text-sm text-cias-texto">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-cias-laranja" />
      <div>
        <strong>Supabase não configurado.</strong> Defina <code>VITE_SUPABASE_URL</code> e{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> (arquivo <code>.env</code> ou variáveis do deploy). Veja o README.
      </div>
    </div>
  )
}
