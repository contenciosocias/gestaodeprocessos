// Edge Function: sync-intimacoes
// ----------------------------------------------------------------------------
// Endpoint chamado pelo front (abrir/recarregar + botão "Atualizar agora").
// A lógica de sincronização vive em ../_shared/sync.ts (compartilhada com a
// função disparo-diario) — aqui é só o invólucro HTTP/CORS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handlePreflight, jsonResponse } from '../_shared/cors.ts'
import { syncIntimacoes } from '../_shared/sync.ts'

Deno.serve(async (req) => {
  const pre = handlePreflight(req)
  if (pre) return pre

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, erro: 'Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const resultado = await syncIntimacoes(supabase)
    return jsonResponse({ ok: true, ...resultado })
  } catch (e) {
    return jsonResponse({ ok: false, erro: String(e) }, 500)
  }
})
