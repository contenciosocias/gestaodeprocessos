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
const AREA_ADJ: Record<Area, string> = { civel: 'cíveis', trabalhista: 'trabalhistas' }

const DEFAULT_HORA = 8
const DEFAULT_TZ = 'America/Sao_Paulo'
const JANELA_MIN = 5 // casa com o intervalo do cron (*/5): dispara no 1º tick em [alvo, alvo + JANELA_MIN)

interface ItemNotificar {
  id: string
  numero_processo: string | null
  sigla_tribunal: string | null
  nome_orgao: string | null
  teor: string | null
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
    const alvoMin = parseAlvoMinutos(cfg.disparo_hora)
    const remetente = (cfg.disparo_remetente || '').trim()
    const { hora, minuto, dataISO, dataCurtaBR } = agoraNoFuso(tz)
    const agoraMin = hora * 60 + minuto

    // 2) Guarda de horário / idempotência (ignorada com forcar=true, p/ teste).
    // Dispara no 1º tick do cron dentro da janela [alvo, alvo + JANELA_MIN).
    if (!forcar) {
      const diff = agoraMin - alvoMin
      if (diff < 0 || diff >= JANELA_MIN) {
        return jsonResponse({
          ok: true,
          disparou: false,
          motivo: 'fora_da_hora',
          agora: `${pad2(hora)}:${pad2(minuto)}`,
          disparo_hora: `${pad2(Math.floor(alvoMin / 60))}:${pad2(alvoMin % 60)}`,
          fuso: tz,
        })
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
        'id, numero_processo, sigla_tribunal, nome_orgao, teor, data_disponibilizacao, link_certidao, ' +
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
        teor: row.teor ?? null,
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
      const html = montarEmail(area, dataISO, itens)
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

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Alvo "HH:MM" (ou legado "8" = só a hora) -> minutos desde a meia-noite. */
function parseAlvoMinutos(v: string | undefined): number {
  const s = String(v ?? '').trim()
  const hm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) {
    const h = parseInt(hm[1], 10)
    const mi = parseInt(hm[2], 10)
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) return h * 60 + mi
  }
  const n = parseInt(s, 10)
  if (Number.isFinite(n) && n >= 0 && n <= 23) return n * 60
  return DEFAULT_HORA * 60
}

/** Hora, minuto e data no fuso configurado. Cai no default se o fuso for inválido. */
function agoraNoFuso(tz: string): { hora: number; minuto: number; dataISO: string; dataCurtaBR: string } {
  const fmt = (zona: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
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
  let minuto = parseInt(get('minute'), 10)
  if (!Number.isFinite(minuto)) minuto = 0
  const ano = get('year')
  const mes = get('month')
  const dia = get('day')
  return { hora, minuto, dataISO: `${ano}-${mes}-${dia}`, dataCurtaBR: `${dia}/${mes}` }
}

async function listarDestinatarios(supabase: Supabase, area: Area): Promise<string[]> {
  const { data } = await supabase.from('destinatarios_disparo').select('email').eq('area', area)
  const emails = ((data ?? []) as Array<{ email: string }>).map((r) => (r.email ?? '').trim()).filter(Boolean)
  return [...new Set(emails)] // dedup defensivo
}

// ---------------------------------------------------------------------------
// E-mail — HTML sóbrio, limpo e responsivo (sem logo), na paleta da plataforma.
// Um container único e coeso; tipografia serifada para as partes; inteiro teor.
// ---------------------------------------------------------------------------
const C = {
  vermelho: '#D81E05',
  texto: '#1A1A1A',
  texto2: '#52525B',
  texto3: '#9C9C96',
  borda: '#E6E4DE',
  bordaClara: '#EEEDE8',
  superficie: '#F4F3F0',
  teorBg: '#FAF9F7',
  base: '#FFFFFF',
}
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"
const SERIF = "Georgia,'Times New Roman',Times,serif"
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escapa e converte quebras de linha em <br> (para o inteiro teor). */
function escMultilinha(s: unknown): string {
  return esc(s).replace(/\r?\n/g, '<br>')
}

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA' (sem passar por Date, p/ não escorregar de fuso). */
function dataLongaBR(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : String(iso)
}

/** 'YYYY-MM-DD' -> '9 de junho de 2026'. */
function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split('-').map((x) => parseInt(x, 10))
  if (!a || !m || !d || m < 1 || m > 12) return iso
  return `${d} de ${MESES[m - 1]} de ${a}`
}

function orgaoTribunal(orgao: string | null, sigla: string | null): string {
  const o = (orgao ?? '').trim()
  const s = (sigla ?? '').trim()
  if (o && s) return `${o} · ${s}`
  return o || s || '—'
}

function linhaMeta(rotulo: string, valor: string): string {
  return (
    `<tr>` +
    `<td style="padding:5px 0;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:${C.texto3};vertical-align:top;width:150px;">${esc(rotulo)}</td>` +
    `<td style="padding:5px 0;font-size:14px;line-height:1.5;color:${C.texto};vertical-align:top;">${esc(valor)}</td>` +
    `</tr>`
  )
}

/** Um bloco por intimação, separado por filete fino (visual de lista, não de cartão). */
function blocoIntimacao(it: ItemNotificar, primeiro: boolean): string {
  const ativo = (it.polo_ativo ?? '').trim()
  const passivo = (it.polo_passivo ?? '').trim()
  const numero = it.numero_processo || it.numero_cnj || '—'
  const temPartes = Boolean(ativo && passivo)

  // Cabeçalho: "[ativo] v. [passivo]"; se faltar um polo, usa o número do processo.
  const cabecalho = temPartes
    ? `${esc(ativo)} <span style="color:${C.texto3};font-weight:400;font-style:italic;">v.</span> ${esc(passivo)}`
    : esc(numero)
  const subnumero = temPartes
    ? `<div style="font-size:12px;color:${C.texto3};margin-top:5px;letter-spacing:.2px;">Processo nº ${esc(numero)}</div>`
    : ''

  const teor = (it.teor ?? '').trim()
  const teorHtml = teor
    ? escMultilinha(teor)
    : `<span style="color:${C.texto3};font-style:italic;">Inteiro teor não disponível para esta comunicação.</span>`

  const certidao = it.link_certidao
    ? `<div style="margin-top:18px;">` +
      `<a href="${esc(it.link_certidao)}" target="_blank" ` +
      `style="display:inline-block;font-size:13px;font-weight:700;letter-spacing:.2px;color:${C.vermelho};` +
      `text-decoration:none;border:1px solid ${C.vermelho};border-radius:6px;padding:9px 18px;">Abrir certidão &#8594;</a></div>`
    : ''

  const topo = primeiro ? '' : `border-top:1px solid ${C.bordaClara};`

  return (
    `<tr><td class="px" style="padding:28px 40px;${topo}">` +
    `<div style="font-family:${SERIF};font-size:19px;line-height:1.35;font-weight:700;color:${C.texto};">${cabecalho}</div>` +
    subnumero +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">` +
    linhaMeta('Órgão / Tribunal', orgaoTribunal(it.nome_orgao, it.sigla_tribunal)) +
    linhaMeta('Disponibilização', dataLongaBR(it.data_disponibilizacao)) +
    `</table>` +
    `<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.texto3};font-weight:700;margin:22px 0 8px 0;">Inteiro teor</div>` +
    `<div style="font-size:13.5px;line-height:1.75;color:${C.texto2};background:${C.teorBg};` +
    `border:1px solid ${C.bordaClara};border-left:3px solid ${C.vermelho};border-radius:6px;padding:16px 18px;">${teorHtml}</div>` +
    certidao +
    `</td></tr>`
  )
}

function montarEmail(area: Area, dataISO: string, itens: ItemNotificar[]): string {
  const extenso = dataPorExtenso(dataISO)
  const subinfo =
    itens.length > 0
      ? `${extenso} &nbsp;·&nbsp; ${itens.length} nova${itens.length > 1 ? 's' : ''} intimaç${itens.length > 1 ? 'ões' : 'ão'}`
      : extenso

  const corpo =
    itens.length > 0
      ? itens.map((it, idx) => blocoIntimacao(it, idx === 0)).join('')
      : `<tr><td class="px" style="padding:32px 40px;">` +
        `<div style="font-size:14px;line-height:1.6;color:${C.texto2};">Não há novas intimações ${esc(
          AREA_ADJ[area],
        )} hoje.</div></td></tr>`

  return (
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light only">` +
    `<style>@media (max-width:620px){.container{width:100%!important;border-radius:0!important;}.px{padding-left:22px!important;padding-right:22px!important;}}</style>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${C.superficie};-webkit-font-smoothing:antialiased;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.superficie};">` +
    `<tr><td align="center" style="padding:36px 12px;">` +
    `<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" ` +
    `style="width:600px;max-width:600px;background:${C.base};border:1px solid ${C.borda};border-radius:12px;overflow:hidden;font-family:${SANS};">` +
    // filete de acento no topo
    `<tr><td style="height:3px;line-height:3px;font-size:0;background:${C.vermelho};">&nbsp;</td></tr>` +
    // cabeçalho
    `<tr><td class="px" style="padding:30px 40px 22px 40px;border-bottom:1px solid ${C.bordaClara};">` +
    `<div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:${C.texto3};font-weight:700;">CIAS &nbsp;·&nbsp; Controle de intimações</div>` +
    `<div style="font-family:${SERIF};font-size:23px;line-height:1.25;color:${C.texto};font-weight:700;margin-top:10px;">Intimações ${esc(AREA_ADJ[area])}</div>` +
    `<div style="font-size:13px;color:${C.texto2};margin-top:6px;">${subinfo}</div>` +
    `</td></tr>` +
    // corpo
    corpo +
    // rodapé
    `<tr><td class="px" style="padding:20px 40px 24px 40px;border-top:1px solid ${C.bordaClara};background:${C.teorBg};">` +
    `<div style="font-size:11px;line-height:1.6;color:${C.texto3};">Mensagem automática do sistema de controle de intimações do CIAS — perfil ${esc(
      AREA_LABEL[area],
    )}. Não é necessário responder.</div>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`
  )
}
