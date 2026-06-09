// Envio de e-mail — PROVIDER ISOLADO.
// ----------------------------------------------------------------------------
// Hoje: Brevo (faixa gratuita ~300 e-mails/dia, API HTTP que funciona a partir
// de Edge Function). A chave vai no secret BREVO_API_KEY do Supabase.
//
// O resto do sistema só conhece enviarEmail({ remetente, para, assunto, html }).
// Trocar de provider depois = reescrever SÓ este arquivo.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export interface EnvioEmail {
  remetente: string // e-mail verificado no provedor (disparo_remetente)
  para: string[] // destinatários
  assunto: string
  html: string
}

export async function enviarEmail({ remetente, para, assunto, html }: EnvioEmail): Promise<void> {
  if (para.length === 0) return // nada a fazer

  const apiKey = Deno.env.get('BREVO_API_KEY')
  if (!apiKey) throw new Error('Secret BREVO_API_KEY ausente nas variáveis da função.')
  if (!remetente) throw new Error('Remetente não configurado (Configurações → Disparo de intimações).')

  const resp = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: remetente },
      to: para.map((email) => ({ email })),
      subject: assunto,
      htmlContent: html,
    }),
  })

  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '')
    throw new Error(`Brevo HTTP ${resp.status}: ${corpo}`)
  }
}
