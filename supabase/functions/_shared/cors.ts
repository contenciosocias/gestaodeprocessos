// CORS compartilhado pelas Edge Functions.
//
// O front (GitHub Pages) chama as funções em outro domínio (Supabase), então o
// navegador faz um preflight OPTIONS e exige os cabeçalhos abaixo. Sem isso, as
// chamadas são bloqueadas.
//
// Para o MVP interno mantemos "*" (qualquer origem). Se quiser restringir,
// troque por https://<usuario>.github.io (e seu domínio próprio, se houver).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

/** Responde ao preflight OPTIONS; retorna null se não for preflight. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

/** Resposta JSON já com os cabeçalhos de CORS. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
