import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import type { IntimacaoComProcesso, Perfil, StatusIntimacao } from '../types'
import { listIntimacoesByPerfil, updateIntimacao } from '../lib/api'
import { classificarPrazo, formatDateBR, limparTeor } from '../lib/format'
import { PageHeader } from './PageHeader'
import { Tag } from './Badge'

const STATUS_OPCOES: StatusIntimacao[] = ['nova', 'lida', 'providenciada']
const STATUS_LABEL: Record<StatusIntimacao, string> = { nova: 'Nova', lida: 'Lida', providenciada: 'Providenciada' }

// Cor do seletor de status conforme o valor (acento discreto).
const STATUS_SELECT_CLASS: Record<StatusIntimacao, string> = {
  nova: 'text-cias-laranja border-cias-laranja/40',
  lida: 'text-cias-texto2 border-cias-borda',
  providenciada: 'text-cias-sucesso border-cias-sucesso/40',
}

// Faixa de acento à esquerda do card conforme o status.
const STATUS_ACCENT: Record<StatusIntimacao, string> = {
  nova: 'border-l-cias-laranja',
  lida: 'border-l-cias-borda',
  providenciada: 'border-l-cias-sucesso',
}

type Patch = Partial<Pick<IntimacaoComProcesso, 'status' | 'prazo_fatal' | 'observacao'>>

// Monta "polo ativo v. polo passivo" a partir do polo do CIAS e da parte contrária.
// Ex.: CIAS ativo + "José" => "CIAS v. José"; CIAS passivo => "José v. CIAS".
function partesProcesso(posicao: string | null | undefined, rotulo: string | null | undefined): string {
  const adverso = rotulo?.trim()
  if (posicao === 'ativo') return adverso ? `CIAS v. ${adverso}` : 'CIAS'
  if (posicao === 'passivo') return adverso ? `${adverso} v. CIAS` : 'CIAS'
  return adverso ? `CIAS · ${adverso}` : 'CIAS'
}

export function IntimacoesTab({ perfil, refreshSignal }: { perfil: Perfil; refreshSignal: number }) {
  const [intimacoes, setIntimacoes] = useState<IntimacaoComProcesso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

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
  function patchLocal(id: string, patch: Patch) {
    setIntimacoes((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  async function salvar(id: string, patch: Patch) {
    const anterior = intimacoes.find((i) => i.id === id)
    patchLocal(id, patch)
    try {
      await updateIntimacao(id, patch)
    } catch (e) {
      if (anterior) patchLocal(id, anterior) // reverte
      alert('Não foi possível salvar a alteração: ' + String((e as Error)?.message ?? e))
    }
  }

  // Dois grupos derivados da mesma lista. "Recentes" = status 'nova';
  // "Tratadas" = 'lida'/'providenciada'. filter() preserva a ordem da API
  // (mais novo -> mais antigo), então a ordem se mantém dentro de cada grupo.
  // Como derivam do array único, mudar o status no card reflui o item de grupo.
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
          <GrupoSecao titulo="Recentes" itens={recentes} onSalvar={salvar} vazio="Nenhuma intimação nova." />
          <GrupoSecao
            titulo="Tratadas"
            itens={tratadas}
            onSalvar={salvar}
            vazio="Nenhuma intimação tratada (lida ou providenciada)."
          />
        </div>
      )}
    </>
  )
}

// Cabeçalho de grupo (título + contador + linha) seguido dos cards do grupo.
function GrupoSecao({
  titulo,
  itens,
  onSalvar,
  vazio,
}: {
  titulo: string
  itens: IntimacaoComProcesso[]
  onSalvar: (id: string, patch: Patch) => void
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
            <IntimacaoCard key={i.id} intimacao={i} onSalvar={onSalvar} />
          ))}
        </div>
      )}
    </section>
  )
}

function IntimacaoCard({
  intimacao: i,
  onSalvar,
}: {
  intimacao: IntimacaoComProcesso
  onSalvar: (id: string, patch: Patch) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const prazo = i.status !== 'providenciada' ? classificarPrazo(i.prazo_fatal) : null
  const prazoVermelho = prazo === 'vencido' || prazo === 'proximo'
  const teor = limparTeor(i.teor)

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

        {/* Direita: selecionáveis */}
        <div className="space-y-3 md:w-64 md:shrink-0">
          <ControleCampo label="Status">
            <select
              value={i.status}
              onChange={(e) => onSalvar(i.id, { status: e.target.value as StatusIntimacao })}
              className={`w-full rounded-md border bg-cias-base px-2 py-1.5 text-sm font-medium ${STATUS_SELECT_CLASS[i.status]}`}
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s} value={s} className="text-cias-texto">
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </ControleCampo>

          <ControleCampo label="Prazo fatal">
            <input
              type="date"
              value={i.prazo_fatal ?? ''}
              onChange={(e) => onSalvar(i.id, { prazo_fatal: e.target.value || null })}
              className={[
                'w-full rounded-md border bg-cias-base px-2 py-1.5 text-sm',
                prazoVermelho
                  ? 'border-cias-vermelho font-semibold text-cias-vermelho'
                  : 'border-cias-borda text-cias-texto',
              ].join(' ')}
            />
          </ControleCampo>

          <ControleCampo label="Observação">
            <input
              type="text"
              key={`obs-${i.id}-${i.observacao ?? ''}`}
              defaultValue={i.observacao ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim() || null
                if (v !== (i.observacao ?? null)) onSalvar(i.id, { observacao: v })
              }}
              placeholder="—"
              className="w-full rounded-md border border-cias-borda bg-cias-base px-2 py-1.5 text-sm text-cias-texto"
            />
          </ControleCampo>
        </div>
      </div>
    </article>
  )
}

function ControleCampo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-cias-texto3">{label}</span>
      {children}
    </label>
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
