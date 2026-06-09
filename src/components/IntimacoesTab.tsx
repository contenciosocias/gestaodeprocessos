import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import type { IntimacaoComProcesso, Perfil, StatusIntimacao } from '../types'
import { listIntimacoesByPerfil, updateIntimacao } from '../lib/api'
import { classificarPrazo, formatDateBR, limparTeor } from '../lib/format'
import { PageHeader } from './PageHeader'

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

  return (
    <>
      <PageHeader titulo="Intimações" perfil={perfil} />
      {carregando ? (
        <EstadoCentral icone={<Loader2 className="animate-spin" />} texto="Carregando intimações…" />
      ) : erro ? (
        <EstadoCentral texto={`Erro ao carregar: ${erro}`} />
      ) : intimacoes.length === 0 ? (
        <EstadoCentral texto="Nenhuma intimação ainda. Cadastre OABs e processos; as intimações aparecem após a sincronização." />
      ) : (
        <div className="space-y-3">
          {intimacoes.map((i) => (
            <IntimacaoCard key={i.id} intimacao={i} onSalvar={salvar} />
          ))}
        </div>
      )}
    </>
  )
}

function IntimacaoCard({
  intimacao: i,
  onSalvar,
}: {
  intimacao: IntimacaoComProcesso
  onSalvar: (id: string, patch: Patch) => void
}) {
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
            <div className="text-base font-semibold text-cias-texto">
              {i.numero_processo || i.processo?.numero_cnj || '—'}
            </div>
            <div className="text-sm text-cias-texto2">
              <span className="font-medium text-cias-texto">{i.sigla_tribunal || '—'}</span>
              {i.nome_orgao ? <span> · {i.nome_orgao}</span> : null}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-0.5 pt-0.5 text-xs text-cias-texto2">
              <span>
                <span className="font-semibold uppercase tracking-wide text-cias-texto3">Tipo</span> ·{' '}
                {i.tipo_comunicacao || '—'}
              </span>
              <span>
                <span className="font-semibold uppercase tracking-wide text-cias-texto3">Disponib.</span> ·{' '}
                {formatDateBR(i.data_disponibilizacao)}
              </span>
              {i.destinatario_advogado && (
                <span>
                  <span className="font-semibold uppercase tracking-wide text-cias-texto3">Adv.</span> ·{' '}
                  {i.destinatario_advogado}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cias-texto3">Inteiro teor</span>
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
            <div className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg border border-cias-borda bg-cias-superficie/50 p-3 text-sm leading-relaxed text-cias-texto">
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
