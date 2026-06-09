import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { POLO_TEXT_CLASS, Tag } from './Badge'
import type { Intimacao, Movimentacao, Processo } from '../types'
import {
  CnjDuplicadoError,
  createApenso,
  createMovimentacao,
  deleteMovimentacao,
  listApensos,
  listMovimentacoes,
  listPrazosEmAberto,
  updateMovimentacao,
  updateProcesso,
} from '../lib/api'
import { classificarPrazo, formatDateBR, trecho } from '../lib/format'

interface Props {
  processo: Processo
  onClose: () => void
  onChanged: () => void
  /** Abre a janela de detalhes de outro processo (ex.: um apenso). */
  onOpenProcesso: (p: Processo) => void
  /** Exclui o processo (a confirmação/cascata fica a cargo de quem passa o handler). */
  onExcluir?: (p: Processo) => void
}

const PERFIL_LABEL = { civel: 'Cível', trabalhista: 'Trabalhista' } as const

export function ProcessoDetailModal({ processo, onClose, onChanged, onOpenProcesso, onExcluir }: Props) {
  const ehPrincipal = processo.processo_principal_id === null
  const [proc, setProc] = useState<Processo>(processo)
  const [apensos, setApensos] = useState<Processo[]>([])
  const [prazos, setPrazos] = useState<Intimacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => setProc(processo), [processo])

  const recarregar = useCallback(async () => {
    setCarregando(true)
    try {
      const apensosList = ehPrincipal ? await listApensos(processo.id) : []
      setApensos(apensosList)
      const ids = ehPrincipal ? [processo.id, ...apensosList.map((a) => a.id)] : [processo.id]
      setPrazos(await listPrazosEmAberto(ids))
    } finally {
      setCarregando(false)
    }
  }, [processo.id, ehPrincipal])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  async function salvarCampo(patch: Partial<Processo>) {
    const anterior = proc
    setProc((p) => ({ ...p, ...patch }))
    try {
      await updateProcesso(processo.id, patch)
      onChanged()
    } catch (e) {
      setProc(anterior) // reverte a alteração otimista
      alert('Não foi possível salvar: ' + String((e as Error)?.message ?? e))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-4xl"
      title={
        <span className="flex items-center gap-2">
          {proc.numero_cnj}
          <Tag>{PERFIL_LABEL[proc.perfil]}</Tag>
          {!ehPrincipal && <Tag>apenso</Tag>}
        </span>
      }
    >
      <div className="space-y-7">
        {/* 1) Dados básicos */}
        <Secao titulo="Dados básicos">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoTexto rotulo="Classe" valor={proc.classe} onSave={(v) => salvarCampo({ classe: v })} placeholder="(preenchido pelo Datajud ou à mão)" />
            <CampoTexto rotulo="Órgão julgador" valor={proc.orgao_julgador} onSave={(v) => salvarCampo({ orgao_julgador: v })} placeholder="(preenchido pelo Datajud ou à mão)" />
            <CampoData rotulo="Data de ajuizamento" valor={proc.data_ajuizamento} onSave={(v) => salvarCampo({ data_ajuizamento: v })} />
            <CampoPolo valor={proc.posicao_cias} onSave={(v) => salvarCampo({ posicao_cias: v })} />
            <CampoTexto rotulo="Parte contrária" valor={proc.rotulo} onSave={(v) => salvarCampo({ rotulo: v })} placeholder="nome da parte contrária" />
          </div>
        </Secao>

        {/* 2) Objeto */}
        <Secao titulo="Objeto">
          <CampoTextarea valor={proc.objeto} onSave={(v) => salvarCampo({ objeto: v })} placeholder="Descreva o objeto do processo…" />
        </Secao>

        <Secao titulo="Observação">
          <CampoTextarea valor={proc.observacao} onSave={(v) => salvarCampo({ observacao: v })} placeholder="Anotações livres sobre o processo…" />
        </Secao>

        {/* 3) Apensos (somente principal) */}
        {ehPrincipal && (
          <Secao titulo="Processos apensos">
            <ApensosSection
              principal={proc}
              apensos={apensos}
              onOpen={onOpenProcesso}
              onAdded={() => {
                void recarregar()
                onChanged()
              }}
            />
          </Secao>
        )}

        {/* 4) Prazos em aberto */}
        <Secao titulo={ehPrincipal ? 'Prazos em aberto (inclui apensos)' : 'Prazos em aberto'}>
          {carregando ? (
            <Carregando />
          ) : prazos.length === 0 ? (
            <Vazio texto="Nenhum prazo em aberto." />
          ) : (
            <ul className="divide-y divide-cias-borda rounded-lg border border-cias-borda">
              {prazos.map((p) => {
                const cls = classificarPrazo(p.prazo_fatal)
                const vermelho = cls === 'vencido' || cls === 'proximo'
                return (
                  <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                    <div>
                      <div className="text-cias-texto">{p.tipo_comunicacao || 'Intimação'}</div>
                      <div className="text-xs text-cias-texto2">{trecho(p.teor, 100)}</div>
                    </div>
                    <div className={`whitespace-nowrap text-sm font-semibold ${vermelho ? 'text-cias-vermelho' : 'text-cias-texto'}`}>
                      {formatDateBR(p.prazo_fatal)}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>

        {/* 5) Movimentações (histórico manual) */}
        <Secao titulo="Movimentações realizadas">
          <MovimentacoesSection processoId={processo.id} />
        </Secao>

        {/* Exclusão */}
        {onExcluir && (
          <div className="border-t border-cias-borda pt-5">
            <button
              onClick={() => onExcluir(proc)}
              className="inline-flex items-center gap-2 rounded-lg border border-cias-vermelho/40 px-3 py-2 text-sm font-medium text-cias-vermelho transition hover:bg-cias-vermelho/10"
            >
              <Trash2 size={15} /> Excluir {ehPrincipal ? 'processo (e apensos)' : 'apenso'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Apensos
// ---------------------------------------------------------------------------
function ApensosSection({
  principal,
  apensos,
  onOpen,
  onAdded,
}: {
  principal: Processo
  apensos: Processo[]
  onOpen: (p: Processo) => void
  onAdded: () => void
}) {
  const [cnj, setCnj] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    setSalvando(true)
    try {
      await createApenso(principal, cnj)
      setCnj('')
      onAdded()
    } catch (e) {
      setErro(e instanceof CnjDuplicadoError ? e.message : String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-3">
      {apensos.length === 0 ? (
        <Vazio texto="Nenhum apenso cadastrado." />
      ) : (
        <ul className="divide-y divide-cias-borda rounded-lg border border-cias-borda">
          {apensos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-cias-texto">{a.numero_cnj}</span>
                {a.classe && <Tag>{a.classe}</Tag>}
              </div>
              <button
                onClick={() => onOpen(a)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cias-vermelho hover:bg-cias-superficie2"
              >
                Detalhes <ChevronRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={cnj}
          onChange={(e) => setCnj(e.target.value)}
          placeholder="Número CNJ do apenso"
          className="flex-1 min-w-[16rem] rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
        />
        <button
          onClick={adicionar}
          disabled={salvando || cnj.trim() === ''}
          className="inline-flex items-center gap-2 rounded-md border border-cias-borda px-3 py-2 text-sm font-medium text-cias-texto transition hover:bg-cias-superficie2 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Adicionar apenso
        </button>
      </div>
      {erro && <p className="text-xs text-cias-vermelho">{erro}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Movimentações
// ---------------------------------------------------------------------------
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function MovimentacoesSection({ processoId }: { processoId: string }) {
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [data, setData] = useState(hojeISO())
  const [descricao, setDescricao] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState('')
  const [editDescricao, setEditDescricao] = useState('')

  const recarregar = useCallback(() => {
    setCarregando(true)
    listMovimentacoes(processoId)
      .then(setMovs)
      .finally(() => setCarregando(false))
  }, [processoId])

  useEffect(() => recarregar(), [recarregar])

  async function adicionar() {
    if (descricao.trim() === '') return
    try {
      await createMovimentacao({ processo_id: processoId, data, descricao })
      setDescricao('')
      setData(hojeISO())
      recarregar()
    } catch (e) {
      alert('Não foi possível salvar a movimentação: ' + String((e as Error)?.message ?? e))
    }
  }

  async function salvarEdicao() {
    if (!editId) return
    try {
      await updateMovimentacao(editId, { data: editData, descricao: editDescricao })
      setEditId(null)
      recarregar()
    } catch (e) {
      alert('Não foi possível salvar a movimentação: ' + String((e as Error)?.message ?? e))
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover esta movimentação?')) return
    try {
      await deleteMovimentacao(id)
      recarregar()
    } catch (e) {
      alert('Não foi possível remover a movimentação: ' + String((e as Error)?.message ?? e))
    }
  }

  return (
    <div className="space-y-3">
      {/* Adicionar */}
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-md border border-cias-borda bg-cias-base px-2 py-2 text-sm text-cias-texto"
        />
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição da movimentação…"
          className="flex-1 min-w-[18rem] rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
        />
        <button
          onClick={adicionar}
          disabled={descricao.trim() === ''}
          className="inline-flex items-center gap-2 rounded-md border border-cias-borda px-3 py-2 text-sm font-medium text-cias-texto transition hover:bg-cias-superficie2 disabled:opacity-50"
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>

      {carregando ? (
        <Carregando />
      ) : movs.length === 0 ? (
        <Vazio texto="Nenhuma movimentação registrada." />
      ) : (
        <ul className="divide-y divide-cias-borda rounded-lg border border-cias-borda">
          {movs.map((m) =>
            editId === m.id ? (
              <li key={m.id} className="flex flex-wrap items-start gap-2 px-4 py-3">
                <input
                  type="date"
                  value={editData}
                  onChange={(e) => setEditData(e.target.value)}
                  className="rounded-md border border-cias-borda bg-cias-base px-2 py-1.5 text-sm"
                />
                <input
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  className="flex-1 min-w-[16rem] rounded-md border border-cias-borda bg-cias-base px-3 py-1.5 text-sm"
                />
                <button onClick={salvarEdicao} className="rounded-md bg-cias-vermelho px-3 py-1.5 text-sm font-medium text-cias-base">
                  Salvar
                </button>
                <button onClick={() => setEditId(null)} className="rounded-md px-3 py-1.5 text-sm text-cias-texto2 hover:bg-cias-superficie2">
                  Cancelar
                </button>
              </li>
            ) : (
              <li key={m.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-cias-texto">{formatDateBR(m.data)}</div>
                  <div className="text-cias-texto2">{m.descricao}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => {
                      setEditId(m.id)
                      setEditData(m.data)
                      setEditDescricao(m.descricao)
                    }}
                    className="rounded-md p-1.5 text-cias-texto2 hover:bg-cias-superficie2 hover:text-cias-texto"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remover(m.id)}
                    className="rounded-md p-1.5 text-cias-texto2 hover:bg-cias-superficie2 hover:text-cias-vermelho"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primitivos da janela
// ---------------------------------------------------------------------------
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-cias-texto2">{titulo}</h3>
      {children}
    </section>
  )
}

function CampoTexto({
  rotulo,
  valor,
  onSave,
  placeholder,
}: {
  rotulo: string
  valor: string | null
  onSave: (v: string | null) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-cias-texto2">{rotulo}</span>
      <input
        defaultValue={valor ?? ''}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim() || null
          if (v !== (valor ?? null)) onSave(v)
        }}
        className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
      />
    </label>
  )
}

function CampoPolo({ valor, onSave }: { valor: string | null; onSave: (v: string | null) => void }) {
  const cls = valor ? (POLO_TEXT_CLASS[valor] ?? 'text-cias-texto') : 'text-cias-texto2'
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-cias-texto2">Polo</span>
      <select
        value={valor ?? ''}
        onChange={(e) => onSave(e.target.value || null)}
        className={`w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm font-bold ${cls}`}
      >
        <option value="" className="font-normal text-cias-texto2">
          —
        </option>
        <option value="ativo" className="font-bold text-cias-sucesso">Ativo</option>
        <option value="passivo" className="font-bold text-cias-laranja">Passivo</option>
        <option value="interessado" className="font-bold text-cias-roxo">Interessado</option>
      </select>
    </label>
  )
}

function CampoData({
  rotulo,
  valor,
  onSave,
}: {
  rotulo: string
  valor: string | null
  onSave: (v: string | null) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-cias-texto2">{rotulo}</span>
      <input
        type="date"
        defaultValue={valor ?? ''}
        onBlur={(e) => {
          const v = e.target.value || null
          if (v !== (valor ?? null)) onSave(v)
        }}
        className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
      />
    </label>
  )
}

function CampoTextarea({
  valor,
  onSave,
  placeholder,
}: {
  valor: string | null
  onSave: (v: string | null) => void
  placeholder?: string
}) {
  return (
    <textarea
      defaultValue={valor ?? ''}
      placeholder={placeholder}
      rows={3}
      onBlur={(e) => {
        const v = e.target.value.trim() || null
        if (v !== (valor ?? null)) onSave(v)
      }}
      className="w-full resize-y rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
    />
  )
}

function Carregando() {
  return (
    <div className="flex items-center gap-2 px-1 py-3 text-sm text-cias-texto2">
      <Loader2 size={15} className="animate-spin" /> Carregando…
    </div>
  )
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed border-cias-borda px-4 py-3 text-sm text-cias-texto2">{texto}</p>
}
