import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Perfil } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import { getLastSyncAt, maybeSync } from './lib/api'
import { Sidebar } from './components/Sidebar'
import { IntimacoesTab } from './components/IntimacoesTab'
import { ProcessosTab } from './components/ProcessosTab'
import { ConfiguracoesScreen } from './components/ConfiguracoesScreen'

type View = 'cases' | 'config'
type Aba = 'intimacoes' | 'processos'

const PERFIL_LABEL: Record<Perfil, string> = { civel: 'Cível', trabalhista: 'Trabalhista' }

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
    <div className="flex min-h-screen bg-cias-superficie text-cias-texto">
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
        <main className="flex-1">
          <div className="mx-auto max-w-screen-2xl px-6 py-6">
            {!isSupabaseConfigured ? (
              <AvisoConfig />
            ) : view === 'config' ? (
              <ConfiguracoesScreen />
            ) : (
              <>
                <PageHeader aba={aba} perfil={perfil} />
                <div className="mt-5">
                  {aba === 'intimacoes' ? (
                    <IntimacoesTab perfil={perfil} refreshSignal={refreshSignal} />
                  ) : (
                    <ProcessosTab perfil={perfil} />
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PageHeader({ aba, perfil }: { aba: Aba; perfil: Perfil }) {
  const info =
    aba === 'intimacoes'
      ? {
          titulo: 'Intimações',
          desc: `Comunicações dos processos do perfil ${PERFIL_LABEL[perfil]}, da mais recente para a mais antiga.`,
        }
      : {
          titulo: 'Processos',
          desc: `Processos principais do perfil ${PERFIL_LABEL[perfil]}. Expanda uma linha para ver os apensos.`,
        }
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-cias-texto">{info.titulo}</h1>
      <p className="mt-1 text-sm text-cias-texto2">{info.desc}</p>
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
