import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import type { DestinatarioDisparo, Oab, Perfil } from '../types'
import {
  createDestinatario,
  createOab,
  deleteDestinatario,
  deleteOab,
  getAppConfig,
  listDestinatarios,
  listOabs,
  setAppConfig,
  updateOab,
} from '../lib/api'

export function ConfiguracoesScreen() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-cias-texto">Configurações</h1>
      </div>
      <OabsBlock />
      <DisparoBlock />
      <ApisBlock />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bloco 1 — Advogados monitorados (OABs)
// ---------------------------------------------------------------------------
function OabsBlock() {
  const [oabs, setOabs] = useState<Oab[]>([])
  const [carregando, setCarregando] = useState(true)
  const [numero, setNumero] = useState('')
  const [uf, setUf] = useState('')
  const [advogado, setAdvogado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState({ numero: '', uf: '', advogado: '' })

  function recarregar() {
    setCarregando(true)
    listOabs()
      .then(setOabs)
      .finally(() => setCarregando(false))
  }
  useEffect(recarregar, [])

  async function adicionar() {
    setErro(null)
    if (!numero.trim() || uf.trim().length !== 2 || !advogado.trim()) {
      setErro('Preencha número, UF (2 letras) e nome do advogado.')
      return
    }
    setSalvando(true)
    try {
      await createOab({ numero, uf, advogado })
      setNumero('')
      setUf('')
      setAdvogado('')
      recarregar()
    } catch (e) {
      setErro(String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEdicao() {
    if (!editId) return
    try {
      await updateOab(editId, edit)
      setEditId(null)
      recarregar()
    } catch (e) {
      alert('Não foi possível salvar a OAB: ' + String((e as Error)?.message ?? e))
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover esta OAB do monitoramento?')) return
    try {
      await deleteOab(id)
      recarregar()
    } catch (e) {
      alert('Não foi possível remover a OAB: ' + String((e as Error)?.message ?? e))
    }
  }

  return (
    <section className="rounded-xl border border-cias-borda bg-cias-base p-5 shadow-sm">
      <h2 className="text-base font-semibold text-cias-texto">OABs monitoradas</h2>

      {/* Adicionar */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Campo rotulo="Número" valor={numero} onChange={setNumero} largura="w-32" placeholder="123456" />
        <Campo rotulo="UF" valor={uf} onChange={(v) => setUf(v.toUpperCase().slice(0, 2))} largura="w-20" placeholder="MG" />
        <Campo rotulo="Advogado" valor={advogado} onChange={setAdvogado} largura="flex-1 min-w-[14rem]" placeholder="Nome do advogado" />
        <button
          onClick={adicionar}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-4 py-2 text-sm font-semibold text-cias-base transition hover:bg-cias-vermelho/90 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-cias-vermelho">{erro}</p>}

      {/* Lista */}
      <div className="mt-4">
        {carregando ? (
          <p className="text-sm text-cias-texto2">Carregando…</p>
        ) : oabs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-cias-borda px-4 py-3 text-sm text-cias-texto2">
            Nenhuma OAB cadastrada.
          </p>
        ) : (
          <ul className="divide-y divide-cias-borda rounded-lg border border-cias-borda">
            {oabs.map((o) =>
              editId === o.id ? (
                <li key={o.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <input value={edit.numero} onChange={(e) => setEdit({ ...edit, numero: e.target.value })} className="w-28 rounded-md border border-cias-borda px-2 py-1.5 text-sm" />
                  <input value={edit.uf} onChange={(e) => setEdit({ ...edit, uf: e.target.value.toUpperCase().slice(0, 2) })} className="w-16 rounded-md border border-cias-borda px-2 py-1.5 text-sm" />
                  <input value={edit.advogado} onChange={(e) => setEdit({ ...edit, advogado: e.target.value })} className="flex-1 min-w-[12rem] rounded-md border border-cias-borda px-2 py-1.5 text-sm" />
                  <button onClick={salvarEdicao} className="rounded-md bg-cias-vermelho px-3 py-1.5 text-sm font-medium text-cias-base">Salvar</button>
                  <button onClick={() => setEditId(null)} className="rounded-md px-3 py-1.5 text-sm text-cias-texto2 hover:bg-cias-superficie2">Cancelar</button>
                </li>
              ) : (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-cias-texto">{o.advogado}</span>
                    <span className="ml-2 text-cias-texto2">OAB {o.numero}/{o.uf}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditId(o.id)
                        setEdit({ numero: o.numero, uf: o.uf, advogado: o.advogado })
                      }}
                      className="rounded-md p-1.5 text-cias-texto2 hover:bg-cias-superficie2 hover:text-cias-texto"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remover(o.id)}
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
    </section>
  )
}

// ---------------------------------------------------------------------------
// Bloco 2 — APIs (DJEn e Datajud)
// ---------------------------------------------------------------------------
const CHAVES_API: { chave: string; rotulo: string; ajuda: string }[] = [
  { chave: 'djen_base_url', rotulo: 'URL base do DJEn', ajuda: 'Default: https://comunicaapi.pje.jus.br/api/v1' },
  { chave: 'datajud_base_url', rotulo: 'URL base do Datajud', ajuda: 'Default: https://api-publica.datajud.cnj.jus.br' },
  { chave: 'datajud_api_key', rotulo: 'APIKey do Datajud', ajuda: 'Chave pública da wiki do CNJ (usada no header Authorization: APIKey …)' },
]

function ApisBlock() {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    getAppConfig()
      .then(setValores)
      .finally(() => setCarregando(false))
  }, [])

  async function salvar() {
    setSalvando(true)
    setOk(false)
    try {
      for (const { chave } of CHAVES_API) {
        await setAppConfig(chave, valores[chave] ?? '')
      }
      setOk(true)
    } catch (e) {
      alert('Não foi possível salvar as configurações: ' + String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-xl border border-cias-borda bg-cias-base p-5 shadow-sm">
      <h2 className="text-base font-semibold text-cias-texto">APIs</h2>

      {carregando ? (
        <p className="mt-4 text-sm text-cias-texto2">Carregando…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {CHAVES_API.map(({ chave, rotulo, ajuda }) => (
            <label key={chave} className="block">
              <span className="mb-1 block text-xs font-medium text-cias-texto2">{rotulo}</span>
              <input
                value={valores[chave] ?? ''}
                onChange={(e) => {
                  setValores((v) => ({ ...v, [chave]: e.target.value }))
                  setOk(false)
                }}
                className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
              />
              <span className="mt-1 block text-xs text-cias-texto2">{ajuda}</span>
            </label>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-4 py-2 text-sm font-semibold text-cias-base transition hover:bg-cias-vermelho/90 disabled:opacity-50"
            >
              {salvando && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
            {ok && <span className="text-sm text-cias-sucesso">Configurações salvas.</span>}
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Bloco 3 — Disparo de intimações (e-mail diário)
// ---------------------------------------------------------------------------
const TIMEZONE_DEFAULT = 'America/Sao_Paulo'

function DisparoBlock() {
  const [cfg, setCfg] = useState<Record<string, string>>({
    disparo_hora: '8',
    disparo_timezone: TIMEZONE_DEFAULT,
    disparo_remetente: '',
  })
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)
  const [dests, setDests] = useState<DestinatarioDisparo[]>([])

  useEffect(() => {
    getAppConfig()
      .then((all) =>
        setCfg({
          disparo_hora: all.disparo_hora ?? '8',
          disparo_timezone: all.disparo_timezone || TIMEZONE_DEFAULT,
          disparo_remetente: all.disparo_remetente ?? '',
        }),
      )
      .finally(() => setCarregando(false))
  }, [])

  const recarregarDest = useCallback(() => {
    // Tolera a tabela ainda não migrada (degrada para lista vazia em vez de quebrar).
    listDestinatarios()
      .then(setDests)
      .catch(() => setDests([]))
  }, [])
  useEffect(recarregarDest, [recarregarDest])

  function setCampo(chave: string, valor: string) {
    setCfg((c) => ({ ...c, [chave]: valor }))
    setOk(false)
  }

  async function salvar() {
    setSalvando(true)
    setOk(false)
    try {
      await setAppConfig('disparo_hora', String(cfg.disparo_hora ?? '8'))
      await setAppConfig('disparo_timezone', (cfg.disparo_timezone || TIMEZONE_DEFAULT).trim())
      await setAppConfig('disparo_remetente', (cfg.disparo_remetente ?? '').trim())
      setOk(true)
    } catch (e) {
      alert('Não foi possível salvar o disparo: ' + String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  async function adicionarEmail(area: Perfil, email: string) {
    await createDestinatario({ area, email })
    recarregarDest()
  }
  async function removerEmail(id: string) {
    await deleteDestinatario(id)
    recarregarDest()
  }

  return (
    <section className="rounded-xl border border-cias-borda bg-cias-base p-5 shadow-sm">
      <h2 className="text-base font-semibold text-cias-texto">Disparo de intimações</h2>
      <p className="mt-1 text-xs text-cias-texto2">
        Todo dia, no horário abaixo, o sistema busca as intimações e envia um e-mail por área aos responsáveis — com as
        novidades ou avisando que não há. Cível vai só para os e-mails cíveis; trabalhista, só para os trabalhistas.
      </p>

      {carregando ? (
        <p className="mt-4 text-sm text-cias-texto2">Carregando…</p>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-cias-texto2">Hora do disparo (0–23)</span>
              <input
                type="number"
                min={0}
                max={23}
                value={cfg.disparo_hora ?? ''}
                onChange={(e) => setCampo('disparo_hora', e.target.value)}
                className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-cias-texto2">Fuso horário</span>
              <input
                value={cfg.disparo_timezone ?? ''}
                onChange={(e) => setCampo('disparo_timezone', e.target.value)}
                placeholder={TIMEZONE_DEFAULT}
                className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-cias-texto2">E-mail remetente</span>
              <input
                type="email"
                value={cfg.disparo_remetente ?? ''}
                onChange={(e) => setCampo('disparo_remetente', e.target.value)}
                placeholder="verificado no provedor (Brevo)"
                className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-lg bg-cias-vermelho px-4 py-2 text-sm font-semibold text-cias-base transition hover:bg-cias-vermelho/90 disabled:opacity-50"
            >
              {salvando && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
            {ok && <span className="text-sm text-cias-sucesso">Configurações salvas.</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ListaEmails
              titulo="E-mails — Cível"
              emails={dests.filter((d) => d.area === 'civel')}
              onAdd={(email) => adicionarEmail('civel', email)}
              onRemove={removerEmail}
            />
            <ListaEmails
              titulo="E-mails — Trabalhista"
              emails={dests.filter((d) => d.area === 'trabalhista')}
              onAdd={(email) => adicionarEmail('trabalhista', email)}
              onRemove={removerEmail}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function ListaEmails({
  titulo,
  emails,
  onAdd,
  onRemove,
}: {
  titulo: string
  emails: DestinatarioDisparo[]
  onAdd: (email: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    const email = novo.trim()
    setErro(null)
    if (!/.+@.+\..+/.test(email)) {
      setErro('Informe um e-mail válido.')
      return
    }
    setSalvando(true)
    try {
      await onAdd(email)
      setNovo('')
    } catch (e) {
      setErro(String((e as Error)?.message ?? e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-lg border border-cias-borda p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-cias-texto2">{titulo}</h3>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !salvando && novo.trim() && adicionar()}
          placeholder="email@exemplo.com"
          className="min-w-0 flex-1 rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
        />
        <button
          onClick={adicionar}
          disabled={salvando || novo.trim() === ''}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-cias-borda px-3 py-2 text-sm font-medium text-cias-texto transition hover:bg-cias-superficie2 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Adicionar
        </button>
      </div>
      {erro && <p className="mt-1 text-xs text-cias-vermelho">{erro}</p>}

      <div className="mt-3">
        {emails.length === 0 ? (
          <p className="rounded-md border border-dashed border-cias-borda px-3 py-2 text-xs text-cias-texto2">
            Nenhum e-mail cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-cias-borda rounded-md border border-cias-borda">
            {emails.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-cias-texto">{d.email}</span>
                <button
                  onClick={() => onRemove(d.id)}
                  className="shrink-0 rounded-md p-1.5 text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-vermelho"
                  title="Remover"
                  aria-label="Remover e-mail"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Campo({
  rotulo,
  valor,
  onChange,
  largura,
  placeholder,
}: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
  largura: string
  placeholder?: string
}) {
  return (
    <label className={largura}>
      <span className="mb-1 block text-xs font-medium text-cias-texto2">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-cias-borda bg-cias-base px-3 py-2 text-sm text-cias-texto"
      />
    </label>
  )
}
