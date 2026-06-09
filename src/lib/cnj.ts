// Utilidades para o número CNJ.
// Formato: NNNNNNN-DD.AAAA.J.TR.OOOO  (20 dígitos)

/** Mantém apenas os dígitos. */
export function onlyDigits(s: string): string {
  return (s ?? '').replace(/\D/g, '')
}

/** Valida o comprimento (20 dígitos). NÃO valida o dígito verificador. */
export function isCnjLengthValid(s: string): boolean {
  return onlyDigits(s).length === 20
}

/** Formata 20 dígitos na máscara CNJ. Se não tiver 20 dígitos, devolve o que veio. */
export function formatCnj(s: string): string {
  const d = onlyDigits(s)
  if (d.length !== 20) return s
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`
}
