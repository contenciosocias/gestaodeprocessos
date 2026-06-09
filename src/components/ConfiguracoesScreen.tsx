import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Oab } from '../types'
import { createOab, deleteOab, getAppConfig, listOabs, setAppConfig, updateOab } from '../lib/api'

export function ConfiguracoesScreen() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-cias-texto">Configurações</h1>
        <p className="mt-1 text-sm text-cias-texto2">
          Área global, fora da divisão Cível/Trabalhista. Selecione um perfil no topo para voltar aos casos.
        </p>
      </div>
      <OabsBlock />
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
    await updateOab(editId, edit)
    setEditId(null)
    recarregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover esta OAB do monitoramento?')) return
    await deleteOab(id)
    recarregar()
  }

  return (
    <section className="rounded-xl border border-cias-borda bg-cias-base p-5">
      <h2 className="text-base font-semibold text-cias-texto">Advogados monitorados (OABs)</h2>
      <p className="mt-1 text-sm text-cias-texto2">
        Lista global — cíveis e trabalhistas juntas. A área de cada intimação vem sempre do processo, nunca da OAB.
      </p>

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
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-xl border border-cias-borda bg-cias-base p-5">
      <h2 className="text-base font-semibold text-cias-texto">APIs (DJEn e Datajud)</h2>
      <p className="mt-1 text-sm text-cias-texto2">
        Atualize a configuração caso as APIs mudem, sem mexer no código. As Edge Functions leem destes valores (com defaults de fallback).
      </p>

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
