import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import type { IntimacaoComProcesso, Perfil, StatusIntimacao } from '../types'
import { listIntimacoesByPerfil, updateIntimacao } from '../lib/api'
import { classificarPrazo, formatDateBR, trecho } from '../lib/format'
import { TeorModal } from './TeorModal'

const STATUS_OPCOES: StatusIntimacao[] = ['nova', 'lida', 'providenciada']
const STATUS_LABEL: Record<StatusIntimacao, string> = { nova: 'Nova', lida: 'Lida', providenciada: 'Providenciada' }

// Cor do seletor de status conforme o valor (acento discreto).
const STATUS_SELECT_CLASS: Record<StatusIntimacao, string> = {
  nova: 'text-cias-laranja border-cias-laranja/40',
  lida: 'text-cias-texto2 border-cias-borda',
  providenciada: 'text-cias-sucesso border-cias-sucesso/40',
}

export function IntimacoesTab({ perfil, refreshSignal }: { perfil: Perfil; refreshSignal: number }) {
  const [intimacoes, setIntimacoes] = useState<IntimacaoComProcesso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [teorAberto, setTeorAberto] = useState<IntimacaoComProcesso | null>(null)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro(null)
    listIntimacoesByPerfil(perfil)
      .then((rows) => vivo && setIntimacoes(rows))
      .catch((e) => vivo && setErro(String(e?.message ?? e)))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [perfil, refreshSignal])

  // Atualização otimista de um dos 3 campos editáveis.
  function patchLocal(id: string, patch: Partial<IntimacaoComProcesso>) {
    setIntimacoes((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  async function salvar(id: string, patch: Partial<Pick<IntimacaoComProcesso, 'status' | 'prazo_fatal' | 'observacao'>>) {
    const anterior = intimacoes.find((i) => i.id === id)
    patchLocal(id, patch)
    try {
      await updateIntimacao(id, patch)
    } catch (e) {
      if (anterior) patchLocal(id, anterior) // reverte
      alert('Não foi possível salvar a alteração: ' + String((e as Error)?.message ?? e))
    }
  }

  if (carregando) return <EstadoCentral icone={<Loader2 className="animate-spin" />} texto="Carregando intimações…" />
  if (erro) return <EstadoCentral texto={`Erro ao carregar: ${erro}`} />
  if (intimacoes.length === 0)
    return (
      <EstadoCentral
        texto="Nenhuma intimação ainda. Cadastre OABs e processos; as intimações aparecem após a sincronização."
      />
    )

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-cias-borda bg-cias-base shadow-sm">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cias-borda bg-cias-superficie/70 text-left text-[11px] font-semibold uppercase tracking-wider text-cias-texto3">
              <th className="px-4 py-3">Processo</th>
              <th className="px-4 py-3">Órgão / Tribunal</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Disponib.</th>
              <th className="px-4 py-3">Teor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Prazo fatal</th>
              <th className="px-4 py-3">Observação</th>
            </tr>
          </thead>
          <tbody>
            {intimacoes.map((i) => {
              const prazo = i.status !== 'providenciada' ? classificarPrazo(i.prazo_fatal) : null
              const prazoVermelho = prazo === 'vencido' || prazo === 'proximo'
              return (
                <tr key={i.id} className="border-b border-cias-borda/70 align-top last:border-0 hover:bg-cias-superficie/60">
                  <td className="px-4 py-3 font-medium text-cias-texto">{i.numero_processo || i.processo?.numero_cnj || '—'}</td>
                  <td className="px-4 py-3 text-cias-texto2">
                    <div className="font-medium text-cias-texto">{i.sigla_tribunal || '—'}</div>
                    <div className="text-xs">{i.nome_orgao || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-cias-texto2">{i.tipo_comunicacao || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-cias-texto2">{formatDateBR(i.data_disponibilizacao)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setTeorAberto(i)}
                      className="group flex max-w-xs items-start gap-1.5 text-left text-cias-texto2 hover:text-cias-texto"
                      title="Abrir teor completo"
                    >
                      <FileText size={14} className="mt-0.5 shrink-0 text-cias-texto2 group-hover:text-cias-vermelho" />
                      <span className="line-clamp-2">{trecho(i.teor, 120)}</span>
                    </button>
                    {i.link_certidao && (
                      <a
                        href={i.link_certidao}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-cias-vermelho hover:underline"
                      >
                        <ExternalLink size={12} /> certidão
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={i.status}
                      onChange={(e) => salvar(i.id, { status: e.target.value as StatusIntimacao })}
                      className={`rounded-md border bg-cias-base px-2 py-1 text-xs font-medium ${STATUS_SELECT_CLASS[i.status]}`}
                    >
                      {STATUS_OPCOES.map((s) => (
                        <option key={s} value={s} className="text-cias-texto">
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={i.prazo_fatal ?? ''}
                      onChange={(e) => salvar(i.id, { prazo_fatal: e.target.value || null })}
                      className={[
                        'rounded-md border bg-cias-base px-2 py-1 text-xs',
                        prazoVermelho
                          ? 'border-cias-vermelho text-cias-vermelho font-semibold'
                          : 'border-cias-borda text-cias-texto',
                      ].join(' ')}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      // key no valor já salvo: se o save falhar e o estado reverter,
                      // o input remonta e volta a exibir o valor persistido.
                      key={`obs-${i.id}-${i.observacao ?? ''}`}
                      defaultValue={i.observacao ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null
                        if (v !== (i.observacao ?? null)) salvar(i.id, { observacao: v })
                      }}
                      placeholder="—"
                      className="w-44 rounded-md border border-cias-borda bg-cias-base px-2 py-1 text-xs text-cias-texto"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <TeorModal intimacao={teorAberto} onClose={() => setTeorAberto(null)} />
    </>
  )
}

function EstadoCentral({ texto, icone }: { texto: string; icone?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-cias-borda bg-cias-base px-6 py-16 text-center text-sm text-cias-texto2">
      {icone && <div className="text-cias-texto2">{icone}</div>}
      <p className="max-w-md">{texto}</p>
    </div>
  )
}
