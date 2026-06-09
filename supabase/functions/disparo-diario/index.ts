// Edge Function: disparo-diario
// ----------------------------------------------------------------------------
// Chamada DE HORA EM HORA pelo pg_cron (minuto 0). A própria função decide se é
// a hora do disparo — assim, mudar a hora em Configurações não exige mexer no cron.
//
// Quando é a hora certa (e ainda não disparou hoje):
//   1) lê config (hora, fuso, última data, remetente) + destinatários
//   2) guarda de horário/idempotência (hora no fuso == disparo_hora E ainda não hoje)
//   3) roda a sincronização (mesma rotina do sync-intimacoes) p/ capturar novidades
//   4) seleciona intimações com notificada_em IS NULL, agrupadas por ÁREA (perfil)
//   5) envia UM e-mail por área COM destinatários (resumo com cartões ou "sem
//      novidades"); roteamento ESTRITO por área
//   6) marca as enviadas (notificada_em) e grava disparo_ultima_data = hoje
//
// Teste manual fora da hora: invoque com body { "forcar": true }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'
import { syncIntimacoes } from '../_shared/sync.ts'
import { enviarEmail } from '../_shared/email.ts'

type Supabase = ReturnType<typeof createClient>
type Area = 'civel' | 'trabalhista'
const AREAS: Area[] = ['civel', 'trabalhista']
const AREA_LABEL: Record<Area, string> = { civel: 'Cível', trabalhista: 'Trabalhista' }

const DEFAULT_HORA = 8
const DEFAULT_TZ = 'America/Sao_Paulo'

// Paleta do e-mail (independente do Tailwind do front; ver seção 6 do adendo).
const COR = {
  vermelho: '#D81E05',
  laranja: '#F47A1F',
  texto: '#1A1A1A',
  texto2: '#6B6B6B',
  borda: '#E6E4DE',
  superficie: '#F6F5F2',
  base: '#FFFFFF',
}

interface ItemNotificar {
  id: string
  numero_processo: string | null
  sigla_tribunal: string | null
  nome_orgao: string | null
  tipo_comunicacao: string | null
  data_disponibilizacao: string | null
  link_certidao: string | null
  numero_cnj: string
  polo_ativo: string | null
  polo_passivo: string | null
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req)
  if (pre) return pre

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, erro: 'Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  const body = (await req.json().catch(() => ({}))) as { forcar?: boolean }
  const forcar = body?.forcar === true

  try {
    // 1) Config.
    const cfg = await lerConfig(supabase)
    const tz = (cfg.disparo_timezone || DEFAULT_TZ).trim() || DEFAULT_TZ
    const horaConfig = parseHora(cfg.disparo_hora)
    const remetente = (cfg.disparo_remetente || '').trim()
    const { hora, dataISO, dataCurtaBR } = agoraNoFuso(tz)

    // 2) Guarda de horário / idempotência (ignorada com forcar=true, p/ teste).
    if (!forcar) {
      if (hora !== horaConfig) {
        return jsonResponse({ ok: true, disparou: false, motivo: 'fora_da_hora', hora_atual: hora, disparo_hora: horaConfig, fuso: tz })
      }
      if ((cfg.disparo_ultima_data || '') === dataISO) {
        return jsonResponse({ ok: true, disparou: false, motivo: 'ja_disparou_hoje', data: dataISO })
      }
    }

    // 3) Sincroniza (captura novidades mesmo sem ninguém abrir o site).
    let sync: { processos_consultados: number; intimacoes_novas: number; erros?: string[]; aviso?: string }
    try {
      sync = await syncIntimacoes(supabase)
    } catch (e) {
      sync = { processos_consultados: 0, intimacoes_novas: 0, erros: [`sync: ${String(e)}`] }
    }

    // 4) Intimações ainda não notificadas, agrupadas por área (perfil do processo).
    const { data: pendentesRaw, error: selErr } = await supabase
      .from('intimacoes')
      .select(
        'id, numero_processo, sigla_tribunal, nome_orgao, tipo_comunicacao, data_disponibilizacao, link_certidao, ' +
          'processo:processos!inner(perfil, numero_cnj, polo_ativo, polo_passivo)',
      )
      .is('notificada_em', null)
      .order('data_disponibilizacao', { ascending: false })
    if (selErr) throw selErr

    const porArea: Record<Area, ItemNotificar[]> = { civel: [], trabalhista: [] }
    for (const row of (pendentesRaw ?? []) as any[]) {
      const proc = Array.isArray(row.processo) ? row.processo[0] : row.processo
      const area = proc?.perfil as Area | undefined
      if (area !== 'civel' && area !== 'trabalhista') continue
      porArea[area].push({
        id: row.id,
        numero_processo: row.numero_processo ?? null,
        sigla_tribunal: row.sigla_tribunal ?? null,
        nome_orgao: row.nome_orgao ?? null,
        tipo_comunicacao: row.tipo_comunicacao ?? null,
        data_disponibilizacao: row.data_disponibilizacao ?? null,
        link_certidao: row.link_certidao ?? null,
        numero_cnj: proc?.numero_cnj ?? '',
        polo_ativo: proc?.polo_ativo ?? null,
        polo_passivo: proc?.polo_passivo ?? null,
      })
    }

    // 5) Envio por área (estrito: cível só p/ cíveis; trabalhista só p/ trabalhistas).
    const resultados: Record<Area, unknown> = { civel: null, trabalhista: null }
    const idsEnviados: string[] = []
    const errosEnvio: string[] = []

    for (const area of AREAS) {
      const emails = await listarDestinatarios(supabase, area)
      if (emails.length === 0) {
        resultados[area] = { enviado: false, motivo: 'sem_destinatarios' }
        continue // só não envia para área sem destinatários
      }
      const itens = porArea[area]
      const assunto =
        itens.length > 0
          ? `CIAS — ${itens.length} nova(s) intimação(ões) ${AREA_LABEL[area]} — ${dataCurtaBR}`
          : `CIAS — Sem novas intimações ${AREA_LABEL[area]} — ${dataCurtaBR}`
      const html = montarEmail(area, dataCurtaBR, itens)
      try {
        await enviarEmail({ remetente, para: emails, assunto, html })
        if (itens.length > 0) idsEnviados.push(...itens.map((i) => i.id))
        resultados[area] = { enviado: true, destinatarios: emails.length, intimacoes: itens.length }
      } catch (e) {
        errosEnvio.push(`${area}: ${String(e)}`)
        resultados[area] = { enviado: false, motivo: 'erro_envio', erro: String(e) }
      }
    }

    // 6) Marca as intimações enviadas e grava a data do disparo (idempotência).
    if (idsEnviados.length > 0) {
      const { error: updErr } = await supabase
        .from('intimacoes')
        .update({ notificada_em: new Date().toISOString() })
        .in('id', idsEnviados)
      if (updErr) errosEnvio.push(`marcar: ${String(updErr)}`)
    }
    await supabase
      .from('app_config')
      .upsert({ chave: 'disparo_ultima_data', valor: dataISO, updated_at: new Date().toISOString() }, { onConflict: 'chave' })

    return jsonResponse({
      ok: true,
      disparou: true,
      data: dataISO,
      forcado: forcar,
      sync,
      areas: resultados,
      intimacoes_marcadas: idsEnviados.length,
      erros: errosEnvio.length ? errosEnvio : undefined,
    })
  } catch (e) {
    return jsonResponse({ ok: false, erro: String(e) }, 500)
  }
})

// ---------------------------------------------------------------------------
// Config / fuso / dados
// ---------------------------------------------------------------------------
async function lerConfig(supabase: Supabase): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_config').select('chave, valor')
  const out: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ chave: string; valor: string | null }>) out[row.chave] = row.valor ?? ''
  return out
}

function parseHora(v: string | undefined): number {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : DEFAULT_HORA
}

/** Hora (0–23) e data no fuso configurado. Cai no default se o fuso for inválido. */
function agoraNoFuso(tz: string): { hora: number; dataISO: string; dataCurtaBR: string } {
  const fmt = (zona: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date())

  let partes: Intl.DateTimeFormatPart[]
  try {
    partes = fmt(tz)
  } catch {
    partes = fmt(DEFAULT_TZ)
  }
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  let hora = parseInt(get('hour'), 10)
  if (!Number.isFinite(hora) || hora === 24) hora = 0 // alguns ambientes emitem "24" à meia-noite
  const ano = get('year')
  const mes = get('month')
  const dia = get('day')
  return { hora, dataISO: `${ano}-${mes}-${dia}`, dataCurtaBR: `${dia}/${mes}` }
}

async function listarDestinatarios(supabase: Supabase, area: Area): Promise<string[]> {
  const { data } = await supabase.from('destinatarios_disparo').select('email').eq('area', area)
  const emails = ((data ?? []) as Array<{ email: string }>).map((r) => (r.email ?? '').trim()).filter(Boolean)
  return [...new Set(emails)] // dedup defensivo
}

// ---------------------------------------------------------------------------
// E-mail (HTML responsivo, sem logo, na paleta da plataforma)
// ---------------------------------------------------------------------------
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA' (sem passar por Date, p/ não escorregar de fuso). */
function dataLongaBR(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : String(iso)
}

function orgaoTribunal(orgao: string | null, sigla: string | null): string {
  const o = (orgao ?? '').trim()
  const s = (sigla ?? '').trim()
  if (o && s) return `${o} · ${s}`
  return o || s || '—'
}

/** Cabeçalho do cartão: "[polo ativo] v. [polo passivo]"; se faltar um, usa o nº do processo. */
function cabecalhoCartao(it: ItemNotificar): string {
  const a = (it.polo_ativo ?? '').trim()
  const p = (it.polo_passivo ?? '').trim()
  if (a && p) return `${a} v. ${p}`
  return it.numero_processo || it.numero_cnj || '—'
}

function linhaCampo(rotulo: string, valor: string): string {
  return (
    `<tr>` +
    `<td style="padding:2px 0;font-size:11px;color:${COR.texto2};text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;vertical-align:top;width:130px;">${esc(rotulo)}</td>` +
    `<td style="padding:2px 0 2px 10px;font-size:14px;color:${COR.texto};vertical-align:top;">${esc(valor)}</td>` +
    `</tr>`
  )
}

function cartao(it: ItemNotificar): string {
  const botao = it.link_certidao
    ? `<div style="margin-top:12px;">` +
      `<a href="${esc(it.link_certidao)}" target="_blank" ` +
      `style="display:inline-block;background:${COR.vermelho};color:#ffffff;text-decoration:none;` +
      `font-size:13px;font-weight:600;padding:9px 16px;border-radius:6px;">Abrir certidão</a></div>`
    : ''

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="border-collapse:separate;margin:0 0 14px 0;background:${COR.base};` +
    `border:1px solid ${COR.borda};border-left:4px solid ${COR.vermelho};border-radius:8px;">` +
    `<tr><td style="padding:16px 18px;">` +
    `<div style="font-size:15px;font-weight:700;color:${COR.vermelho};margin:0 0 10px 0;">${esc(cabecalhoCartao(it))}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    linhaCampo('Processo', it.numero_processo || it.numero_cnj || '—') +
    linhaCampo('Órgão/Tribunal', orgaoTribunal(it.nome_orgao, it.sigla_tribunal)) +
    linhaCampo('Tipo', it.tipo_comunicacao || '—') +
    linhaCampo('Disponibilização', dataLongaBR(it.data_disponibilizacao)) +
    `</table>` +
    botao +
    `</td></tr></table>`
  )
}

function montarEmail(area: Area, dataCurtaBR: string, itens: ItemNotificar[]): string {
  const titulo = `Intimações ${AREA_LABEL[area]} — ${dataCurtaBR}`
  const corpo =
    itens.length > 0
      ? itens.map(cartao).join('')
      : `<p style="margin:0;font-size:14px;color:${COR.texto2};">Não há novas intimações ${esc(
          AREA_LABEL[area].toLowerCase(),
        )} hoje.</p>`

  return (
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${COR.superficie};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.superficie};">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="640" cellpadding="0" cellspacing="0" ` +
    `style="width:100%;max-width:640px;font-family:'Inter',Arial,Helvetica,sans-serif;">` +
    // Título (barra de acento na paleta)
    `<tr><td style="border-top:3px solid ${COR.vermelho};background:${COR.base};` +
    `border-radius:8px 8px 0 0;padding:18px 18px 14px 18px;">` +
    `<div style="font-size:17px;font-weight:700;color:${COR.texto};">${esc(titulo)}</div>` +
    `</td></tr>` +
    // Corpo
    `<tr><td style="background:${COR.superficie};padding:18px 18px 6px 18px;">${corpo}</td></tr>` +
    // Rodapé
    `<tr><td style="padding:8px 18px 0 18px;">` +
    `<p style="margin:0;font-size:11px;color:${COR.texto2};line-height:1.5;">` +
    `Mensagem automática do sistema de controle de intimações do CIAS.</p>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`
  )
}
