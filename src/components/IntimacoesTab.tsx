import { useEffect, useState } from 'react'
import { Check, ClipboardList, ExternalLink, Loader2, Maximize2, Minimize2, Undo2 } from 'lucide-react'
import type { IntimacaoComProcesso, Perfil, StatusIntimacao, Tarefa } from '../types'
import { listIntimacoesByPerfil, updateIntimacao } from '../lib/api'
import { formatDateBR, limparTeor, partesProcesso } from '../lib/format'
import { CadastrarTarefaModal } from './CadastrarTarefaModal'
import { PageHeader } from './PageHeader'
import { Tag } from './Badge'

const STATUS_LABEL: Record<StatusIntimacao, string> = { nova: 'Pendente', lida: 'Sem ação', providenciada: 'Resolvida' }

// Pílula de status (somente leitura): o status é automático, salvo o "Sem ação" manual.
const STATUS_PILL: Record<StatusIntimacao, string> = {
  nova: 'text-cias-laranja border-cias-laranja/40 bg-cias-laranja/10',
  lida: 'text-cias-texto2 border-cias-borda bg-cias-superficie',
  providenciada: 'text-cias-sucesso border-cias-sucesso/40 bg-cias-sucesso/10',
}

// Faixa de acento à esquerda do card conforme o status.
const STATUS_ACCENT: Record<StatusIntimacao, string> = {
  nova: 'border-l-cias-laranja',
  lida: 'border-l-cias-borda',
  providenciada: 'border-l-cias-sucesso',
}

export function IntimacoesTab({ perfil, refreshSignal }: { perfil: Perfil; refreshSignal: number }) {
  const [intimacoes, setIntimacoes] = useState<IntimacaoComProcesso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // Intimação cujo modal de cadastro de tarefa está aberto.
  const [tarefaPara, setTarefaPara] = useState<IntimacaoComProcesso | null>(null)

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

  function patchLocal(id: string, patch: Partial<IntimacaoComProcesso>) {
    setIntimacoes((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  // Marcação manual de status ("Lida" / desfazer p/ "Nova"), com atualização otimista.
  async function salvarStatus(id: string, status: StatusIntimacao) {
    const anterior = intimacoes.find((i) => i.id === id)
    patchLocal(id, { status })
    try {
      await updateIntimacao(id, { status })
    } catch (e) {
      if (anterior) patchLocal(id, anterior)
      alert('Não foi possível salvar a alteração: ' + String((e as Error)?.message ?? e))
    }
  }

  // Tarefa recém-criada: a intimação passa a ter tarefa em aberto e volta a "Nova".
  function aoCriarTarefa(intimacaoId: string, tarefa: Tarefa) {
    patchLocal(intimacaoId, { tarefa: { id: tarefa.id, concluida_em: null }, status: 'nova' })
    setTarefaPara(null)
  }

  // Dois grupos derivados da mesma lista. "Recentes" = status 'nova';
  // "Tratadas" = 'lida'/'providenciada'. filter() preserva a ordem da API.
  const recentes = intimacoes.filter((i) => i.status === 'nova')
  const tratadas = intimacoes.filter((i) => i.status !== 'nova')

  return (
    <>
      <PageHeader titulo="Intimações" perfil={perfil} subtitulo="Apenas dos últimos 90 dias" />
      {carregando ? (
        <EstadoCentral icone={<Loader2 className="animate-spin" />} texto="Carregando intimações…" />
      ) : erro ? (
        <EstadoCentral texto={`Erro ao carregar: ${erro}`} />
      ) : intimacoes.length === 0 ? (
        <EstadoCentral texto="Nenhuma intimação ainda. Cadastre OABs e processos; as intimações aparecem após a sincronização." />
      ) : (
        <div className="space-y-8">
          <GrupoSecao
            titulo="Recentes"
            itens={recentes}
            onSalvarStatus={salvarStatus}
            onCadastrarTarefa={setTarefaPara}
            vazio="Nenhuma intimação pendente."
          />
          <GrupoSecao
            titulo="Tratadas"
            itens={tratadas}
            onSalvarStatus={salvarStatus}
            onCadastrarTarefa={setTarefaPara}
            vazio="Nenhuma intimação tratada (sem ação ou resolvida)."
          />
        </div>
      )}

      {tarefaPara && (
        <CadastrarTarefaModal
          intimacao={tarefaPara}
          onClose={() => setTarefaPara(null)}
          onCriada={(t) => aoCriarTarefa(tarefaPara.id, t)}
        />
      )}
    </>
  )
}

// Cabeçalho de grupo (título + contador + linha) seguido dos cards do grupo.
function GrupoSecao({
  titulo,
  itens,
  onSalvarStatus,
  onCadastrarTarefa,
  vazio,
}: {
  titulo: string
  itens: IntimacaoComProcesso[]
  onSalvarStatus: (id: string, status: StatusIntimacao) => void
  onCadastrarTarefa: (i: IntimacaoComProcesso) => void
  vazio: string
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-cias-texto">{titulo}</h2>
        <span className="rounded-full border border-cias-borda bg-cias-superficie px-2 py-0.5 text-xs font-semibold text-cias-texto2">
          {itens.length}
        </span>
        <span className="h-px flex-1 bg-cias-borda" />
      </div>
      {itens.length === 0 ? (
        <p className="px-1 text-sm text-cias-texto3">{vazio}</p>
      ) : (
        <div className="space-y-3">
          {itens.map((i) => (
            <IntimacaoCard
              key={i.id}
              intimacao={i}
              onSalvarStatus={onSalvarStatus}
              onCadastrarTarefa={onCadastrarTarefa}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function IntimacaoCard({
  intimacao: i,
  onSalvarStatus,
  onCadastrarTarefa,
}: {
  intimacao: IntimacaoComProcesso
  onSalvarStatus: (id: string, status: StatusIntimacao) => void
  onCadastrarTarefa: (i: IntimacaoComProcesso) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const teor = limparTeor(i.teor)
  const temTarefa = !!i.tarefa
  // "Lida" só faz sentido quando não há tarefa e nada foi providenciado.
  const podeMarcarLida = !temTarefa && i.status !== 'providenciada'

  return (
    <article
      className={`rounded-xl border border-l-4 border-cias-borda bg-cias-base p-5 shadow-sm ${STATUS_ACCENT[i.status]}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        {/* Esquerda: dados + inteiro teor (compacto) */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-cias-texto">
                {i.numero_processo || i.processo?.numero_cnj || '—'}
              </span>
              {i.processo?.classe && <Tag>{i.processo.classe}</Tag>}
            </div>
            <div className="text-sm font-medium text-cias-texto">
              {partesProcesso(i.processo?.posicao_cias, i.processo?.rotulo)}
            </div>
            <div className="pt-0.5 text-xs text-cias-texto2">
              <span className="font-semibold uppercase tracking-wide text-cias-texto3">Disponibilização</span> ·{' '}
              {formatDateBR(i.data_disponibilizacao)}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-cias-texto3">Inteiro teor</span>
                <button
                  onClick={() => setExpandido((v) => !v)}
                  title={expandido ? 'Recolher teor' : 'Expandir teor'}
                  aria-label={expandido ? 'Recolher teor' : 'Expandir teor'}
                  className="rounded p-0.5 text-cias-texto3 transition hover:bg-cias-superficie2 hover:text-cias-vermelho"
                >
                  {expandido ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
              {i.link_certidao && (
                <a
                  href={i.link_certidao}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-cias-vermelho hover:underline"
                >
                  <ExternalLink size={12} /> certidão
                </a>
              )}
            </div>
            <div
              className={`overflow-y-auto whitespace-pre-wrap rounded-lg border border-cias-borda bg-cias-superficie/50 p-3 text-sm leading-relaxed text-cias-texto transition-[max-height] duration-200 ${
                expandido ? 'max-h-[75vh]' : 'max-h-28'
              }`}
            >
              {teor || 'Sem teor disponível.'}
            </div>
          </div>
        </div>

        {/* Divisória vertical */}
        <div className="hidden w-px self-stretch bg-cias-borda md:block" />

        {/* Direita: status (somente leitura), tarefa e ações manuais */}
        <div className="space-y-3 md:w-64 md:shrink-0">
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-cias-texto3">Status</span>
            <span
              className={`inline-flex rounded-md border px-2.5 py-1 text-sm font-medium ${STATUS_PILL[i.status]}`}
            >
              {STATUS_LABEL[i.status]}
            </span>
          </div>

          {/* Tarefa vinculada (uma por intimação). Editar é feito na aba Tarefas. */}
          {temTarefa ? (
            <div className="rounded-md border border-cias-borda bg-cias-superficie/50 px-3 py-2 text-xs text-cias-texto2">
              <span className="font-semibold text-cias-texto">Tarefa já cadastrada</span>
              {i.tarefa?.concluida_em ? ' · concluída' : ''}
              <span className="mt-0.5 block text-cias-texto3">Edite na aba Tarefas.</span>
            </div>
          ) : (
            <button
              onClick={() => onCadastrarTarefa(i)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cias-vermelho px-3 py-2 text-sm font-semibold text-white transition hover:bg-cias-vermelhoEscuro"
            >
              <ClipboardList size={16} /> Cadastrar tarefa
            </button>
          )}

          {/* Marcação manual "Sem ação" (única edição manual de status). */}
          {podeMarcarLida &&
            (i.status === 'lida' ? (
              <button
                onClick={() => onSalvarStatus(i.id, 'nova')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cias-borda px-3 py-2 text-sm font-medium text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-texto"
              >
                <Undo2 size={15} /> Desfazer “sem ação”
              </button>
            ) : (
              <button
                onClick={() => onSalvarStatus(i.id, 'lida')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cias-borda px-3 py-2 text-sm font-medium text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-texto"
              >
                <Check size={15} /> Marcar como sem ação
              </button>
            ))}
        </div>
      </div>
    </article>
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
