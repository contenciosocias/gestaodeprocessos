import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import type { Perfil, Processo } from '../types'
import { CnjDuplicadoError, createPrincipal, deleteProcesso, listApensos, listPrincipais } from '../lib/api'
import { PoloText } from './Badge'
import { PageHeader } from './PageHeader'
import { ProcessoDetailModal } from './ProcessoDetailModal'

export function ProcessosTab({ perfil }: { perfil: Perfil }) {
  const [principais, setPrincipais] = useState<Processo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [apensos, setApensos] = useState<Record<string, Processo[]>>({})
  const [processoAberto, setProcessoAberto] = useState<Processo | null>(null)

  // Cadastro de principal
  const [novoCnj, setNovoCnj] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroCadastro, setErroCadastro] = useState<string | null>(null)

  const carregarPrincipais = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listPrincipais(perfil)
      .then(setPrincipais)
      .catch((e) => setErro(String(e?.message ?? e)))
      .finally(() => setCarregando(false))
  }, [perfil])

  useEffect(() => {
    // Troca de perfil: recarrega e fecha expansões/modal.
    setExpandidos(new Set())
    setApensos({})
    setProcessoAberto(null)
    carregarPrincipais()
  }, [carregarPrincipais])

  const carregarApensos = useCallback(async (principalId: string) => {
    const lista = await listApensos(principalId)
    setApensos((prev) => ({ ...prev, [principalId]: lista }))
  }, [])

  function toggleExpand(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        if (!apensos[id]) void carregarApensos(id)
      }
      return next
    })
  }

  // Após mudanças no modal (campos, novo apenso): recarrega principais e apensos expandidos.
  const aoMudar = useCallback(() => {
    carregarPrincipais()
    for (const id of expandidos) void carregarApensos(id)
  }, [carregarPrincipais, carregarApensos, expandidos])

  async function excluir(p: Processo) {
    const ehPrincipal = p.processo_principal_id === null
    const msg = ehPrincipal
      ? `Excluir o processo principal ${p.numero_cnj}?\n\nIsso remove também TODOS os apensos vinculados e todas as intimações e movimentações desses processos. Esta ação é permanente.`
      : `Excluir o apenso ${p.numero_cnj}?\n\nIsso remove as intimações e movimentações vinculadas a ele. Esta ação é permanente.`
    if (!confirm(msg)) return
    try {
      await deleteProcesso(p.id)
      if (processoAberto?.id === p.id) setProcessoAberto(null)
      carregarPrincipais()
      for (const id of expandidos) void carregarApensos(id)
    } catch (e) {
      alert('Não foi possível excluir o processo: ' + String((e as Error)?.message ?? e))
    }
  }

  async function cadastrar() {
    setErroCadastro(null)
    setSalvando(true)
    try {
      const novo = await createPrincipal(novoCnj, perfil)
      setNovoCnj('')
      carregarPrincipais()
      setProcessoAberto(novo) // abre a janela para preencher os demais campos
    } catch (e) {
      setErroCadastro(e instanceof CnjDuplicadoError ? e.message : String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Processos"
        perfil={perfil}
        right={
          <div className="flex items-center gap-2">
            <input
              value={novoCnj}
              onChange={(e) => setNovoCnj(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !salvando && novoCnj.trim() && cadastrar()}
              placeholder="Cadastrar processo (nº CNJ)"
              className="w-72 rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
            />
            <button
              onClick={cadastrar}
              disabled={salvando || novoCnj.trim() === ''}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-cias-vermelho px-4 py-2 text-sm font-semibold text-white transition hover:bg-cias-vermelhoEscuro disabled:opacity-50"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {salvando ? 'Consultando…' : 'Cadastrar'}
            </button>
          </div>
        }
      />
      {erroCadastro && <p className="-mt-2 text-xs text-cias-vermelho">{erroCadastro}</p>}

      {/* Tabela de principais */}
      {carregando ? (
        <Estado icone={<Loader2 className="animate-spin" />} texto="Carregando processos…" />
      ) : erro ? (
        <Estado texto={`Erro ao carregar: ${erro}`} />
      ) : principais.length === 0 ? (
        <Estado texto="Nenhum processo cadastrado neste perfil. Cadastre o primeiro acima." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cias-borda bg-cias-base shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-cias-borda bg-cias-superficie/70 text-left text-[11px] font-semibold uppercase tracking-wider text-cias-texto3">
                <th className="w-10 px-2 py-3"></th>
                <th className="px-4 py-3">Processo</th>
                <th className="px-4 py-3">Classe</th>
                <th className="px-4 py-3">Parte contrária</th>
                <th className="px-4 py-3">Polo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {principais.map((p) => {
                const aberto = expandidos.has(p.id)
                const filhos = apensos[p.id]
                return (
                  <FragmentRow
                    key={p.id}
                    principal={p}
                    aberto={aberto}
                    filhos={filhos}
                    onToggle={() => toggleExpand(p.id)}
                    onAbrir={setProcessoAberto}
                    onExcluir={excluir}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {processoAberto && (
        <ProcessoDetailModal
          // key força remontagem ao trocar de processo (ex.: abrir um apenso),
          // evitando que inputs uncontrolled e rascunhos fiquem com dados do anterior.
          key={processoAberto.id}
          processo={processoAberto}
          onClose={() => setProcessoAberto(null)}
          onChanged={aoMudar}
          onOpenProcesso={setProcessoAberto}
          onExcluir={excluir}
        />
      )}
    </div>
  )
}

function FragmentRow({
  principal,
  aberto,
  filhos,
  onToggle,
  onAbrir,
  onExcluir,
}: {
  principal: Processo
  aberto: boolean
  filhos: Processo[] | undefined
  onToggle: () => void
  onAbrir: (p: Processo) => void
  onExcluir: (p: Processo) => void
}) {
  return (
    <>
      <tr className="border-b border-cias-borda/70 hover:bg-cias-superficie/60">
        <td className="px-2 py-3 text-center">
          <button
            onClick={onToggle}
            aria-label={aberto ? 'Recolher apensos' : 'Expandir apensos'}
            className="rounded-md p-1 text-cias-texto2 hover:bg-cias-superficie2 hover:text-cias-texto"
          >
            {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-4 py-3 font-medium text-cias-texto">{principal.numero_cnj}</td>
        <td className="px-4 py-3 text-cias-texto2">{principal.classe || '—'}</td>
        <td className="px-4 py-3 text-cias-texto2">{principal.rotulo || '—'}</td>
        <td className="px-4 py-3"><PoloText valor={principal.posicao_cias} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onAbrir(principal)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-cias-vermelho hover:bg-cias-superficie2"
            >
              Detalhes
            </button>
            <button
              onClick={() => onExcluir(principal)}
              title="Excluir processo"
              aria-label="Excluir processo"
              className="rounded-md p-1.5 text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-vermelho"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      {aberto && filhos === undefined && (
        <tr className="bg-cias-superficie2">
          <td></td>
          <td colSpan={5} className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-cias-texto2">
              <Loader2 size={13} className="animate-spin" /> Carregando apensos…
            </div>
          </td>
        </tr>
      )}

      {aberto && filhos && filhos.length === 0 && (
        <tr className="bg-cias-superficie2">
          <td></td>
          <td colSpan={5} className="px-4 py-3 text-xs text-cias-texto2">
            Nenhum apenso. Adicione apensos pela janela de detalhes.
          </td>
        </tr>
      )}

      {aberto &&
        filhos &&
        filhos.map((a) => (
          // Mesma estrutura de colunas do principal; diferenciado só pelo fundo mais escuro.
          <tr key={a.id} className="border-b border-cias-borda/70 bg-cias-superficie2 hover:bg-cias-superficie2">
            <td className="px-2 py-3"></td>
            <td className="px-4 py-3 font-medium text-cias-texto">{a.numero_cnj}</td>
            <td className="px-4 py-3 text-cias-texto2">{a.classe || '—'}</td>
            <td className="px-4 py-3 text-cias-texto2">{a.rotulo || '—'}</td>
            <td className="px-4 py-3">
              <PoloText valor={a.posicao_cias} />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onAbrir(a)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-cias-vermelho hover:bg-cias-base"
                >
                  Detalhes
                </button>
                <button
                  onClick={() => onExcluir(a)}
                  title="Excluir apenso"
                  aria-label="Excluir apenso"
                  className="rounded-md p-1.5 text-cias-texto2 transition hover:bg-cias-base hover:text-cias-vermelho"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </td>
          </tr>
        ))}
    </>
  )
}

function Estado({ texto, icone }: { texto: string; icone?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-cias-borda bg-cias-base px-6 py-16 text-center text-sm text-cias-texto2">
      {icone}
      <p className="max-w-md">{texto}</p>
    </div>
  )
}
