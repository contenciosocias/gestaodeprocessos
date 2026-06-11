import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { IntimacaoComProcesso, Responsavel, Tarefa } from '../types'
import { createTarefa, listResponsaveis } from '../lib/api'
import { formatDateBR } from '../lib/format'
import { Modal } from './Modal'

/**
 * Janela de cadastro da tarefa vinculada a uma intimação (1:1). Abre trazendo, em
 * somente leitura, o processo e a identificação da intimação; edita prazo fatal,
 * responsável e instruções. Ao confirmar, cria a tarefa e devolve em `onCriada`.
 */
export function CadastrarTarefaModal({
  intimacao,
  onClose,
  onCriada,
}: {
  intimacao: IntimacaoComProcesso
  onClose: () => void
  onCriada: (t: Tarefa) => void
}) {
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

  const numeroProcesso = intimacao.numero_processo || intimacao.processo?.numero_cnj || '—'
  const identificacao = [
    intimacao.tipo_comunicacao || 'Intimação',
    formatDateBR(intimacao.data_disponibilizacao),
    intimacao.nome_orgao,
  ]
    .filter(Boolean)
    .join(' · ')

  async function confirmar() {
    setErro(null)
    setSalvando(true)
    try {
      const tarefa = await createTarefa({
        intimacao: { id: intimacao.id, processo_id: intimacao.processo_id },
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
    <Modal open onClose={onClose} maxWidth="max-w-lg" title="Cadastrar tarefa">
      <div className="space-y-5">
        {/* Vínculo (somente leitura) */}
        <div className="space-y-2 rounded-lg border border-cias-borda bg-cias-superficie/50 px-4 py-3">
          <CampoLeitura rotulo="Processo" valor={numeroProcesso} />
          <CampoLeitura rotulo="Intimação vinculada" valor={identificacao} />
        </div>

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
