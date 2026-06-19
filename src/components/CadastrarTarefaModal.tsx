import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { IntimacaoComProcesso, Perfil, Responsavel, Tarefa } from '../types'
import { createTarefa, listProcessosParaSelecao, listResponsaveis } from '../lib/api'
import type { ProcessoOpcao } from '../lib/api'
import { formatDateBR } from '../lib/format'
import { Modal } from './Modal'

/**
 * Janela de cadastro de tarefa. Funciona em dois modos:
 *  - a partir de uma intimação (`intimacao`): traz o vínculo em somente leitura;
 *  - avulsa (`perfil`): permite vincular a um processo existente OU digitar uma
 *    referência livre, sem depender de intimação.
 * Em ambos edita prazo fatal, responsável e instruções. Ao confirmar, cria a
 * tarefa e devolve em `onCriada`.
 */
export function CadastrarTarefaModal({
  intimacao,
  perfil,
  onClose,
  onCriada,
}: {
  // Modo "a partir da intimação". Quando ausente, é o modo avulso (usa `perfil`).
  intimacao?: IntimacaoComProcesso
  // Perfil da tarefa avulsa (obrigatório quando não há intimação).
  perfil?: Perfil
  onClose: () => void
  onCriada: (t: Tarefa) => void
}) {
  const avulsa = !intimacao
  // Perfil efetivo: da intimação (via processo) ou o informado no modo avulso.
  const perfilEfetivo: Perfil = intimacao?.processo?.perfil ?? perfil ?? 'civel'

  const [vincularProcesso, setVincularProcesso] = useState(false)
  const [processoId, setProcessoId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [processosOpcoes, setProcessosOpcoes] = useState<ProcessoOpcao[]>([])

  const [prazoFatal, setPrazoFatal] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [instrucoes, setInstrucoes] = useState('')
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<Responsavel[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Opções do seletor de responsável (cadastradas em Configurações).
  useEffect(() => {
    listResponsaveis()
      .then(setResponsaveisOpcoes)
      .catch(() => setResponsaveisOpcoes([]))
  }, [])

  // No modo avulso, carrega os processos do perfil só quando o usuário opta por vincular.
  useEffect(() => {
    if (avulsa && vincularProcesso && processosOpcoes.length === 0) {
      listProcessosParaSelecao(perfilEfetivo)
        .then(setProcessosOpcoes)
        .catch(() => setProcessosOpcoes([]))
    }
  }, [avulsa, vincularProcesso, perfilEfetivo, processosOpcoes.length])

  const numeroProcesso = intimacao
    ? intimacao.numero_processo || intimacao.processo?.numero_cnj || '—'
    : ''
  const identificacao = intimacao
    ? [intimacao.tipo_comunicacao || 'Intimação', formatDateBR(intimacao.data_disponibilizacao), intimacao.nome_orgao]
        .filter(Boolean)
        .join(' · ')
    : ''

  async function confirmar() {
    setErro(null)
    // Validações do modo avulso.
    if (avulsa) {
      if (vincularProcesso && !processoId) {
        setErro('Selecione um processo ou desmarque "Vincular a um processo".')
        return
      }
      if (!vincularProcesso && !referencia.trim()) {
        setErro('Informe uma referência para a tarefa.')
        return
      }
    }
    setSalvando(true)
    try {
      const tarefa = await createTarefa({
        perfil: perfilEfetivo,
        intimacao: intimacao ? { id: intimacao.id, processo_id: intimacao.processo_id } : null,
        processo_id: avulsa && vincularProcesso ? processoId : null,
        referencia: avulsa && !vincularProcesso ? referencia.trim() : null,
        prazo_fatal: prazoFatal || null,
        responsavel: responsavel.trim() || null,
        instrucoes: instrucoes.trim() || null,
      })
      onCriada(tarefa)
    } catch (e) {
      setErro(String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} maxWidth="max-w-lg" title={avulsa ? 'Nova tarefa' : 'Cadastrar tarefa'}>
      <div className="space-y-5">
        {intimacao ? (
          /* Vínculo com a intimação (somente leitura) */
          <div className="space-y-2 rounded-lg border border-cias-borda bg-cias-superficie/50 px-4 py-3">
            <CampoLeitura rotulo="Processo" valor={numeroProcesso} />
            <CampoLeitura rotulo="Intimação vinculada" valor={identificacao} />
          </div>
        ) : (
          /* Modo avulso: vincular a um processo OU referência livre */
          <div className="space-y-3 rounded-lg border border-cias-borda bg-cias-superficie/50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-cias-texto">
              <input
                type="checkbox"
                checked={vincularProcesso}
                onChange={(e) => setVincularProcesso(e.target.checked)}
                className="h-4 w-4 rounded border-cias-borda accent-cias-vermelho"
              />
              Vincular a um processo
            </label>

            {vincularProcesso ? (
              <div>
                <select
                  value={processoId}
                  onChange={(e) => setProcessoId(e.target.value)}
                  className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
                >
                  <option value="">Selecione um processo…</option>
                  {processosOpcoes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero_cnj}
                      {p.rotulo ? ` — ${p.rotulo}` : ''}
                    </option>
                  ))}
                </select>
                {processosOpcoes.length === 0 && (
                  <span className="mt-1 block text-xs text-cias-texto3">
                    Nenhum processo cadastrado neste perfil.
                  </span>
                )}
              </div>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cias-texto3">
                  Referência
                </span>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ex.: nº do processo, assunto, demanda interna…"
                  className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
                />
              </label>
            )}
          </div>
        )}

        {/* Campos editáveis */}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cias-texto3">Prazo fatal</span>
          <input
            type="date"
            value={prazoFatal}
            onChange={(e) => setPrazoFatal(e.target.value)}
            className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cias-texto3">Responsável</span>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
          >
            <option value="">—</option>
            {responsaveisOpcoes.map((r) => (
              <option key={r.id} value={r.nome}>
                {r.nome}
              </option>
            ))}
          </select>
          {responsaveisOpcoes.length === 0 && (
            <span className="mt-1 block text-xs text-cias-texto3">
              Nenhum responsável cadastrado — adicione em Configurações.
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-cias-texto3">
            <span>Instruções</span>
            <span className="font-normal normal-case text-cias-texto3">{instrucoes.length} caracteres</span>
          </span>
          <textarea
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            rows={4}
            placeholder="Descreva o que precisa ser feito…"
            className="w-full resize-y rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
          />
        </label>

        {erro && <p className="text-xs text-cias-vermelho">{erro}</p>}

        <div className="flex justify-end gap-2 border-t border-cias-borda pt-4">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-cias-texto2 transition hover:bg-cias-superficie2"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-4 py-2 text-sm font-semibold text-white transition hover:bg-cias-vermelhoEscuro disabled:opacity-50"
          >
            {salvando && <Loader2 size={16} className="animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CampoLeitura({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-cias-texto3">{rotulo}: </span>
      <span className="text-cias-texto">{valor}</span>
    </div>
  )
}
