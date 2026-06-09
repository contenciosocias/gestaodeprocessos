// Formatação de datas e classificação de prazos (sem dependências externas).

/** 'yyyy-mm-dd' -> 'dd/mm/aaaa'. Trata só a parte de data (evita fuso). */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export type PrazoStatus = 'vencido' | 'proximo' | 'ok'

const DIAS_PROXIMO = 3

/** Classifica um prazo fatal em relação a hoje (vencido / próximo / ok). */
export function classificarPrazo(iso: string | null | undefined): PrazoStatus | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const prazo = new Date(y, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diffDias = Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000)
  if (diffDias < 0) return 'vencido'
  if (diffDias <= DIAS_PROXIMO) return 'proximo'
  return 'ok'
}

/** Trecho curto do teor para a lista. */
/** Decodifica entidades HTML (ex.: &iacute; → í, &ccedil;&atilde;o → ção). */
export function decodeHtmlEntities(s: string | null | undefined): string {
  if (!s) return ''
  const el = document.createElement('textarea')
  el.innerHTML = s
  return el.value
}

export function trecho(texto: string | null | undefined, max = 160): string {
  if (!texto) return '—'
  const limpo = decodeHtmlEntities(texto).replace(/\s+/g, ' ').trim()
  return limpo.length > max ? limpo.slice(0, max).trimEnd() + '…' : limpo
}
