// Edge Function: consulta-datajud
// ----------------------------------------------------------------------------
// Acionada no CADASTRO de um processo (principal ou apenso) para preencher
// CLASSE e ÓRGÃO JULGADOR a partir do número CNJ. NÃO importa movimentações.
//
// Contrato confirmado (API Pública do Datajud / CNJ):
//   POST <base>/api_publica_<alias>/_search
//   header: Authorization: APIKey <chave>
//   body Elasticsearch: { "query": { "match": { "numeroProcesso": "<dígitos>" } } }
//   resposta: hits.hits[0]._source.classe.nome / .orgaoJulgador.nome
//
// Falha ou retorno vazio (segredo de justiça, ainda não indexado, API fora do ar):
// retorna SEM erro com classe/orgao nulos — o processo é salvo mesmo assim e os
// campos ficam para preenchimento manual (são editáveis).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'

const DEFAULTS = {
  datajud_base_url: 'https://api-publica.datajud.cnj.jus.br',
  // APIKey pública da wiki oficial do Datajud (https://datajud-wiki.cnj.jus.br/api-publica/acesso/).
  datajud_api_key: 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==',
}

// Roteamento por tribunal (escopo atual: MG). Escolhe APENAS o endpoint da
// consulta — NÃO tem relação com a classificação cível/trabalhista, que é 100%
// manual (pelo perfil de cadastro). Tribunal fora do mapa => pula a consulta.
//
// CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)
//   J  = segmento do judiciário (índice 13)
//   TR = tribunal               (índices 14-15)
function aliasFromCnj(digits: string): string | null {
  if (digits.length !== 20) return null
  const j = digits[13]
  const tr = digits.slice(14, 16)
  if (j === '8' && tr === '13') return 'tjmg' // Justiça Estadual de Minas Gerais
  if (j === '5' && tr === '03') return 'trt3' // TRT da 3ª Região
  return null
}

async function loadConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  let baseUrl = DEFAULTS.datajud_base_url
  let apiKey = DEFAULTS.datajud_api_key
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data } = await supabase
        .from('app_config')
        .select('chave, valor')
        .in('chave', ['datajud_base_url', 'datajud_api_key'])
      for (const row of data ?? []) {
        if (row.chave === 'datajud_base_url' && row.valor) baseUrl = row.valor
        if (row.chave === 'datajud_api_key' && row.valor) apiKey = row.valor
      }
    } catch {
      // mantém defaults
    }
  }
  return { baseUrl, apiKey }
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req)
  if (pre) return pre

  try {
    const body = await req.json().catch(() => ({}))
    const digits = String(body?.numero_cnj_digits ?? '').replace(/\D/g, '')

    if (digits.length !== 20) {
      return jsonResponse({ classe: null, orgao_julgador: null, skipped: true, motivo: 'CNJ inválido' })
    }

    const alias = aliasFromCnj(digits)
    if (!alias) {
      return jsonResponse({ classe: null, orgao_julgador: null, skipped: true, motivo: 'tribunal fora do mapa' })
    }

    const { baseUrl, apiKey } = await loadConfig()
    const url = `${baseUrl.replace(/\/+$/, '')}/api_publica_${alias}/_search`

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `APIKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: digits } } }),
    })

    if (!resp.ok) {
      return jsonResponse({ classe: null, orgao_julgador: null, skipped: false, alias, erro: `HTTP ${resp.status}` })
    }

    const data = await resp.json().catch(() => null)
    const source = data?.hits?.hits?.[0]?._source ?? null
    const classe = source?.classe?.nome ?? null
    const orgao_julgador = source?.orgaoJulgador?.nome ?? null

    return jsonResponse({ classe, orgao_julgador, alias, skipped: false })
  } catch (e) {
    // Nunca derruba o cadastro.
    return jsonResponse({ classe: null, orgao_julgador: null, skipped: false, erro: String(e) })
  }
})
