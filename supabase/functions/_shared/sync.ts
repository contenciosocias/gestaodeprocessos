// Sincronização de intimações (DJEn / Comunica PJe) — LÓGICA COMPARTILHADA.
// ----------------------------------------------------------------------------
// Usada por DUAS Edge Functions:
//   - sync-intimacoes : disparada pelo front (abrir/recarregar + "Atualizar agora")
//   - disparo-diario  : roda no cron antes de montar o e-mail diário
// Mantém o contrato confirmado AO VIVO contra a produção:
//   GET <base>/comunicacao?numeroProcesso=<20 dígitos>&pagina=N&itensPorPagina=100
//   base default: https://comunicaapi.pje.jus.br/api/v1  (público, sem auth)
//   envelope: { status, message, count, items: [ {...comunicacao...} ] }
//   dedup:    item.hash (string única; também usada na URL da certidão)
//   teor:     item.texto (pode vir em HTML p/ alguns tribunais)
//   advogados destinatários: item.destinatarioadvogados[].advogado.{numero_oab,uf_oab,nome}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Supabase = ReturnType<typeof createClient>

const DEFAULT_DJEN_BASE = 'https://comunicaapi.pje.jus.br/api/v1'
const ITENS_POR_PAGINA = 100
const MAX_PAGINAS = 50 // trava de segurança (50 * 100 = 5000 comunicações/processo)

// A API tem WAF; mandamos um User-Agent de navegador por precaução.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export interface SyncResultado {
  processos_consultados: number
  intimacoes_novas: number
  erros?: string[]
  aviso?: string
}

interface OabMonitorada {
  numero: string // normalizado (só dígitos, sem zeros à esquerda)
  uf: string // maiúsculo
}

/** Normaliza um número de OAB: só dígitos, sem zeros à esquerda. */
function normOab(numero: unknown): string {
  return String(numero ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

function normUf(uf: unknown): string {
  return String(uf ?? '').trim().toUpperCase()
}

/** Remove tags HTML e normaliza espaços (o teor às vezes vem em HTML). */
function stripHtml(texto: unknown): string | null {
  if (texto == null) return null
  let s = String(texto)
  if (s.includes('<')) {
    s = s
      .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ') // remove blocos de estilo/script (e seu conteúdo)
      .replace(/<\s*(br|\/p|\/div|\/tr|\/li)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  }
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s || null
}

async function loadDjenBase(supabase: Supabase): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('valor')
      .eq('chave', 'djen_base_url')
      .maybeSingle()
    const valor = (data as { valor?: string } | null)?.valor
    if (valor && valor.trim()) return valor.trim().replace(/\/+$/, '')
  } catch {
    // usa default
  }
  return DEFAULT_DJEN_BASE
}

async function touchSyncState(supabase: Supabase): Promise<void> {
  await supabase.from('sync_state').upsert({ id: 1, last_sync_at: new Date().toISOString() }, { onConflict: 'id' })
}

/** Consulta o DJEn paginando e devolve os registros (já filtrados por OAB) para upsert. */
async function coletarIntimacoesDoProcesso(
  base: string,
  digits: string,
  proc: { id: string; numero_cnj: string },
  oabSet: Set<string>,
): Promise<Record<string, unknown>[]> {
  const porHash = new Map<string, Record<string, unknown>>()

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url =
      `${base}/comunicacao?numeroProcesso=${encodeURIComponent(digits)}` +
      `&pagina=${pagina}&itensPorPagina=${ITENS_POR_PAGINA}`

    const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    if (!resp.ok) {
      if (pagina === 1) throw new Error(`DJEn HTTP ${resp.status}`)
      break // erro em página posterior: para por aqui
    }

    const data = await resp.json().catch(() => null)
    const items: unknown[] = Array.isArray(data?.items) ? data.items : []
    if (items.length === 0) break

    for (const raw of items) {
      const item = raw as Record<string, any>
      const advs: any[] = Array.isArray(item.destinatarioadvogados) ? item.destinatarioadvogados : []

      // Mantém só se algum advogado destinatário casar com uma OAB monitorada.
      // O flag de match é INDEPENDENTE do nome: o nome do advogado pode vir
      // ausente/vazio no DJEn, e isso não pode descartar uma intimação válida.
      let casou = false
      let nomeAdvogado: string | null = null
      for (const d of advs) {
        const adv = d?.advogado ?? d
        const numero = normOab(adv?.numero_oab)
        const uf = normUf(adv?.uf_oab)
        if (numero && uf && oabSet.has(`${numero}|${uf}`)) {
          casou = true
          nomeAdvogado = (adv?.nome ?? '').trim() || null
          break
        }
      }
      if (!casou) continue

      const idExterno = String(item.hash ?? item.id ?? '')
      if (!idExterno) continue

      porHash.set(idExterno, {
        id_externo: idExterno,
        processo_id: proc.id,
        numero_processo: item.numeroprocessocommascara ?? proc.numero_cnj ?? null,
        sigla_tribunal: item.siglaTribunal ?? null,
        nome_orgao: item.nomeOrgao ?? null,
        tipo_comunicacao: item.tipoComunicacao ?? null,
        teor: stripHtml(item.texto),
        data_disponibilizacao: item.data_disponibilizacao ?? null,
        destinatario_advogado: nomeAdvogado,
        link_certidao: item.hash ? `${base}/comunicacao/${item.hash}/certidao` : (item.link ?? null),
      })
    }

    if (items.length < ITENS_POR_PAGINA) break
  }

  return [...porHash.values()]
}

/**
 * Roda a sincronização completa: lê as OABs monitoradas, consulta o DJEn por
 * número de processo para cada processo cadastrado, faz upsert
 * ON CONFLICT (id_externo) DO NOTHING (preserva nossas edições) e atualiza o
 * sync_state. Devolve um resumo; nunca escreve a resposta HTTP (quem chama decide).
 */
export async function syncIntimacoes(supabase: Supabase): Promise<SyncResultado> {
  const base = await loadDjenBase(supabase)

  // 1) OABs monitoradas (globais).
  const { data: oabsRows, error: oabsErr } = await supabase.from('oabs').select('numero, uf')
  if (oabsErr) throw oabsErr
  const oabs: OabMonitorada[] = (oabsRows ?? [])
    .map((o) => ({ numero: normOab((o as { numero: string }).numero), uf: normUf((o as { uf: string }).uf) }))
    .filter((o) => o.numero && o.uf)
  const oabSet = new Set(oabs.map((o) => `${o.numero}|${o.uf}`))

  if (oabSet.size === 0) {
    await touchSyncState(supabase)
    return { processos_consultados: 0, intimacoes_novas: 0, aviso: 'Nenhuma OAB monitorada cadastrada.' }
  }

  // 2) Todos os processos (principais e apensos).
  const { data: procRows, error: procErr } = await supabase
    .from('processos')
    .select('id, numero_cnj, numero_cnj_digits')
  if (procErr) throw procErr
  const processos = (procRows ?? []) as Array<{ id: string; numero_cnj: string; numero_cnj_digits: string }>

  let intimacoesNovas = 0
  const erros: string[] = []

  // 3) Consulta sequencial, processo a processo.
  for (const proc of processos) {
    const digits = String(proc.numero_cnj_digits ?? '').replace(/\D/g, '')
    if (!digits) continue

    try {
      const registros = await coletarIntimacoesDoProcesso(base, digits, proc, oabSet)
      if (registros.length === 0) continue

      // ON CONFLICT (id_externo) DO NOTHING — preserva nossas edições.
      const { data: inseridos, error: upErr } = await supabase
        .from('intimacoes')
        .upsert(registros, { onConflict: 'id_externo', ignoreDuplicates: true })
        .select('id')
      if (upErr) throw upErr
      intimacoesNovas += inseridos?.length ?? 0
    } catch (e) {
      erros.push(`${proc.numero_cnj}: ${String(e)}`)
    }
  }

  // 4) Atualiza o estado de sincronização.
  await touchSyncState(supabase)

  return {
    processos_consultados: processos.length,
    intimacoes_novas: intimacoesNovas,
    erros: erros.length ? erros : undefined,
  }
}
