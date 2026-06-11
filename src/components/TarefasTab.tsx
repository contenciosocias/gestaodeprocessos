import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import type { Perfil, TarefaComContexto } from '../types'
import { concluirTarefa, deleteTarefa, listResponsaveis, listTarefas, reabrirTarefa, updateTarefa } from '../lib/api'
import { classificarPrazo, formatDateBR, partesProcesso } from '../lib/format'
import { PageHeader } from './PageHeader'

export function TarefasTab({ perfil, refreshSignal }: { perfil: Perfil; refreshSignal: number }) {
  const [concluidas, setConcluidas] = useState(false)
  const [tarefas, setTarefas] = useState<TarefaComContexto[]>([])
  const [opcoesResponsavel, setOpcoesResponsavel] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Opções do seletor de responsável (cadastradas em Configurações).
  useEffect(() => {
    listResponsaveis()
      .then((rs) => setOpcoesResponsavel(rs.map((r) => r.nome)))
      .catch(() => setOpcoesResponsavel([]))
  }, [refreshSignal])

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listTarefas(perfil, { concluidas })
      .then(setTarefas)
      .catch((e) => setErro(String(e?.message ?? e)))
      .finally(() => setCarregando(false))
  }, [perfil, concluidas])

  useEffect(() => carregar(), [carregar, refreshSignal])

  function patchLocal(id: string, patch: Partial<TarefaComContexto>) {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  async function concluir(t: TarefaComContexto) {
    if (!confirm('Concluir esta tarefa? A intimação vinculada passará para "Resolvida".')) return
    try {
      await concluirTarefa(t)
      carregar() // sai da lista de abertas
    } catch (e) {
      alert('Não foi possível concluir a tarefa: ' + String((e as Error)?.message ?? e))
    }
  }

  async function reabrir(t: TarefaComContexto) {
    try {
      await reabrirTarefa(t)
      carregar() // volta para abertas; a intimação volta a "Nova"
    } catch (e) {
      alert('Não foi possível reabrir a tarefa: ' + String((e as Error)?.message ?? e))
    }
  }

  async function excluir(t: TarefaComContexto) {
    if (!confirm('Excluir esta tarefa? A intimação vinculada volta para "Pendente". Esta ação é permanente.')) return
    try {
      await deleteTarefa(t)
      carregar()
    } catch (e) {
      alert('Não foi possível excluir a tarefa: ' + String((e as Error)?.message ?? e))
    }
  }

  return (
    <>
      <PageHeader
        titulo="Tarefas"
        perfil={perfil}
        right={
          <div className="inline-flex rounded-lg border border-cias-borda bg-cias-base p-0.5 text-sm">
            <BotaoFiltro ativo={!concluidas} onClick={() => setConcluidas(false)}>
              Em aberto
            </BotaoFiltro>
            <BotaoFiltro ativo={concluidas} onClick={() => setConcluidas(true)}>
              Concluídas
            </BotaoFiltro>
          </div>
        }
      />

      {carregando ? (
        <EstadoCentral icone={<Loader2 className="animate-spin" />} texto="Carregando tarefas…" />
      ) : erro ? (
        <EstadoCentral texto={`Erro ao carregar: ${erro}`} />
      ) : tarefas.length === 0 ? (
        <EstadoCentral texto={concluidas ? 'Nenhuma tarefa concluída.' : 'Nenhuma tarefa em aberto neste perfil.'} />
      ) : (
        <div className="space-y-3">
          {tarefas.map((t) => (
            <TarefaCard
              key={t.id}
              tarefa={t}
              responsaveis={opcoesResponsavel}
              onPatchLocal={patchLocal}
              onConcluir={concluir}
              onReabrir={reabrir}
              onExcluir={excluir}
            />
          ))}
        </div>
      )}
    </>
  )
}

function TarefaCard({
  tarefa: t,
  responsaveis,
  onPatchLocal,
  onConcluir,
  onReabrir,
  onExcluir,
}: {
  tarefa: TarefaComContexto
  responsaveis: string[]
  onPatchLocal: (id: string, patch: Partial<TarefaComContexto>) => void
  onConcluir: (t: TarefaComContexto) => void
  onReabrir: (t: TarefaComContexto) => void
  onExcluir: (t: TarefaComContexto) => void
}) {
  const emAberto = t.concluida_em === null
  const cls = classificarPrazo(t.prazo_fatal)
  const urgente = emAberto && (cls === 'vencido' || cls === 'proximo')

  const numeroProcesso = t.processo?.numero_cnj || '—'
  const cabecalho = partesProcesso(t.processo?.posicao_cias, t.processo?.rotulo)

  async function salvarCampo(patch: Partial<Pick<TarefaComContexto, 'prazo_fatal' | 'responsavel' | 'instrucoes'>>) {
    const anterior = { prazo_fatal: t.prazo_fatal, responsavel: t.responsavel, instrucoes: t.instrucoes }
    onPatchLocal(t.id, patch)
    try {
      await updateTarefa(t.id, patch)
    } catch (e) {
      onPatchLocal(t.id, anterior)
      alert('Não foi possível salvar: ' + String((e as Error)?.message ?? e))
    }
  }

  return (
    <article
      className={`rounded-xl border border-l-4 bg-cias-base p-5 shadow-sm ${
        urgente ? 'border-cias-vermelho/40 border-l-cias-vermelho' : 'border-cias-borda border-l-cias-borda'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        {/* Esquerda: identificação + instruções */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <div className="text-base font-semibold text-cias-texto">{numeroProcesso}</div>
            <div className="text-sm font-medium text-cias-texto">{cabecalho}</div>
            <div className="pt-0.5 text-xs text-cias-texto3">
              Referente à intimação disponibilizada em {formatDateBR(t.intimacao?.data_disponibilizacao)}
            </div>
          </div>

          <div>
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-cias-texto3">
              <span>Instruções</span>
              {emAberto && <span className="font-normal normal-case">{(t.instrucoes ?? '').length} caracteres</span>}
            </span>
            {emAberto ? (
              <textarea
                key={`instr-${t.id}`}
                defaultValue={t.instrucoes ?? ''}
                rows={3}
                placeholder="Descreva o que precisa ser feito…"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null
                  if (v !== (t.instrucoes ?? null)) void salvarCampo({ instrucoes: v })
                }}
                className="w-full resize-y rounded-lg border border-cias-borda bg-cias-superficie/50 p-3 text-sm leading-relaxed text-cias-texto"
              />
            ) : (
              <div className="whitespace-pre-wrap rounded-lg border border-cias-borda bg-cias-superficie/50 p-3 text-sm leading-relaxed text-cias-texto">
                {t.instrucoes || 'Sem instruções.'}
              </div>
            )}
          </div>
        </div>

        {/* Divisória vertical */}
        <div className="hidden w-px self-stretch bg-cias-borda md:block" />

        {/* Direita: prazo, responsável e ações */}
        <div className="space-y-3 md:w-64 md:shrink-0">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-cias-texto3">Prazo fatal</span>
            {emAberto ? (
              <input
                type="date"
                defaultValue={t.prazo_fatal ?? ''}
                key={`prazo-${t.id}`}
                onBlur={(e) => {
                  const v = e.target.value || null
                  if (v !== (t.prazo_fatal ?? null)) void salvarCampo({ prazo_fatal: v })
                }}
                className={[
                  'w-full rounded-md border bg-cias-base px-2 py-1.5 text-sm',
                  urgente ? 'border-cias-vermelho font-semibold text-cias-vermelho' : 'border-cias-borda text-cias-texto',
                ].join(' ')}
              />
            ) : (
              <span className="text-sm text-cias-texto">{formatDateBR(t.prazo_fatal)}</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-cias-texto3">Responsável</span>
            {emAberto ? (
              <select
                value={t.responsavel ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  if (v !== (t.responsavel ?? null)) void salvarCampo({ responsavel: v })
                }}
                className="w-full rounded-md border border-cias-borda bg-cias-base px-2 py-1.5 text-sm text-cias-texto"
              >
                <option value="">—</option>
                {t.responsavel && !responsaveis.includes(t.responsavel) && (
                  <option value={t.responsavel}>{t.responsavel} (removido)</option>
                )}
                {responsaveis.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-cias-texto">{t.responsavel || '—'}</span>
            )}
          </label>

          <div className="space-y-2">
            {emAberto ? (
              <button
                onClick={() => onConcluir(t)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cias-sucesso px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <CheckCircle2 size={16} /> Concluir tarefa
              </button>
            ) : (
              <>
                <p className="text-xs text-cias-texto3">Concluída em {formatDateBR(t.concluida_em)}</p>
                <button
                  onClick={() => onReabrir(t)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cias-borda px-3 py-2 text-sm font-medium text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-texto"
                >
                  <RotateCcw size={15} /> Reabrir
                </button>
              </>
            )}
            <button
              onClick={() => onExcluir(t)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cias-vermelho/40 px-3 py-2 text-sm font-medium text-cias-vermelho transition hover:bg-cias-vermelho/10"
            >
              <Trash2 size={15} /> Excluir tarefa
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function BotaoFiltro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={[
        'rounded-md px-3 py-1.5 font-medium transition',
        ativo ? 'bg-cias-vermelho/10 text-cias-vermelho' : 'text-cias-texto2 hover:text-cias-texto',
      ].join(' ')}
    >
      {children}
    </button>
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
