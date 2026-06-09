import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react'
import type { Perfil, Processo } from '../types'
import { CnjDuplicadoError, createPrincipal, listApensos, listPrincipais } from '../lib/api'
import { Tag } from './Badge'
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
      {/* Cadastro de processo principal */}
      <div className="rounded-xl border border-cias-borda bg-cias-base p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[18rem]">
            <span className="mb-1 block text-xs font-medium text-cias-texto2">Cadastrar processo (número CNJ)</span>
            <input
              value={novoCnj}
              onChange={(e) => setNovoCnj(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !salvando && novoCnj.trim() && cadastrar()}
              placeholder="0000000-00.0000.0.00.0000"
              className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
            />
          </label>
          <button
            onClick={cadastrar}
            disabled={salvando || novoCnj.trim() === ''}
            className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-4 py-2 text-sm font-semibold text-cias-base transition hover:bg-cias-vermelho/90 disabled:opacity-50"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {salvando ? 'Consultando Datajud…' : 'Cadastrar'}
          </button>
        </div>
        {erroCadastro && <p className="mt-2 text-xs text-cias-vermelho">{erroCadastro}</p>}
        <p className="mt-2 text-xs text-cias-texto2">
          Classe e órgão julgador são preenchidos automaticamente pelo Datajud (quando disponível) e podem ser editados na janela.
        </p>
      </div>

      {/* Tabela de principais */}
      {carregando ? (
        <Estado icone={<Loader2 className="animate-spin" />} texto="Carregando processos…" />
      ) : erro ? (
        <Estado texto={`Erro ao carregar: ${erro}`} />
      ) : principais.length === 0 ? (
        <Estado texto="Nenhum processo cadastrado neste perfil. Cadastre o primeiro acima." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cias-borda bg-cias-base">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-cias-borda text-left text-xs font-semibold uppercase tracking-wide text-cias-texto2">
                <th className="w-10 px-2 py-3"></th>
                <th className="px-4 py-3">Processo</th>
                <th className="px-4 py-3">Classe</th>
                <th className="px-4 py-3">Órgão julgador</th>
                <th className="px-4 py-3">Posição CIAS</th>
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
}: {
  principal: Processo
  aberto: boolean
  filhos: Processo[] | undefined
  onToggle: () => void
  onAbrir: (p: Processo) => void
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
        <td className="px-4 py-3 text-cias-texto2">{principal.orgao_julgador || '—'}</td>
        <td className="px-4 py-3 text-cias-texto2">{principal.posicao_cias || '—'}</td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => onAbrir(principal)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-cias-vermelho hover:bg-cias-superficie2"
          >
            Detalhes
          </button>
        </td>
      </tr>

      {aberto && (
        <tr className="bg-cias-superficie/40">
          <td></td>
          <td colSpan={5} className="px-4 py-3">
            {filhos === undefined ? (
              <div className="flex items-center gap-2 text-xs text-cias-texto2">
                <Loader2 size={13} className="animate-spin" /> Carregando apensos…
              </div>
            ) : filhos.length === 0 ? (
              <p className="text-xs text-cias-texto2">Nenhum apenso. Adicione apensos pela janela de detalhes.</p>
            ) : (
              <ul className="space-y-1.5">
                {filhos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-cias-borda bg-cias-base px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-cias-texto">{a.numero_cnj}</span>
                      {a.classe && <Tag>{a.classe}</Tag>}
                    </div>
                    <button
                      onClick={() => onAbrir(a)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cias-vermelho hover:bg-cias-superficie2"
                    >
                      Detalhes <ChevronRight size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
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
