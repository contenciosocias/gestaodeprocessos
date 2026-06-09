import type { StatusIntimacao } from '../types'
import { classificarPrazo, formatDateBR } from '../lib/format'

const STATUS_LABEL: Record<StatusIntimacao, string> = {
  nova: 'Nova',
  lida: 'Lida',
  providenciada: 'Providenciada',
}

// Badges de status: Nova = laranja, Lida = cinza, Providenciada = verde discreto.
const STATUS_CLASS: Record<StatusIntimacao, string> = {
  nova: 'bg-cias-laranja/12 text-cias-laranja ring-1 ring-inset ring-cias-laranja/25',
  lida: 'bg-cias-superficie2 text-cias-texto2 ring-1 ring-inset ring-cias-borda',
  providenciada: 'bg-cias-sucesso/10 text-cias-sucesso ring-1 ring-inset ring-cias-sucesso/25',
}

export function StatusBadge({ status }: { status: StatusIntimacao }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// Polo do CIAS no processo: ativo (verde), passivo (laranja), interessado (roxo).
export const POLO_LABEL: Record<string, string> = {
  ativo: 'Ativo',
  passivo: 'Passivo',
  interessado: 'Interessado',
}
export const POLO_TEXT_CLASS: Record<string, string> = {
  ativo: 'text-cias-sucesso',
  passivo: 'text-cias-laranja',
  interessado: 'text-cias-roxo',
}

/** Exibe o polo como texto em negrito, colorido conforme o valor. */
export function PoloText({ valor }: { valor: string | null }) {
  if (!valor) return <span className="text-cias-texto2">—</span>
  const cls = POLO_TEXT_CLASS[valor]
  return <span className={`font-bold ${cls ?? 'text-cias-texto'}`}>{POLO_LABEL[valor] ?? valor}</span>
}

/** Etiqueta neutra para a classe de um apenso e afins. */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-cias-superficie2 px-2 py-0.5 text-xs font-medium text-cias-texto2 ring-1 ring-inset ring-cias-borda">
      {children}
    </span>
  )
}

// Prazo fatal: vencido (vermelho), próximo ≤ 3 dias (laranja), ok (neutro). Sem prazo => "—".
const PRAZO_CLASS: Record<'vencido' | 'proximo' | 'ok', string> = {
  vencido: 'bg-cias-vermelho/12 text-cias-vermelho ring-1 ring-inset ring-cias-vermelho/30',
  proximo: 'bg-cias-laranja/12 text-cias-laranja ring-1 ring-inset ring-cias-laranja/30',
  ok: 'bg-cias-superficie2 text-cias-texto2 ring-1 ring-inset ring-cias-borda',
}

/** Indicador de prazo fatal: data formatada, colorida pela urgência (classificarPrazo). */
export function PrazoFatalBadge({ prazo }: { prazo: string | null | undefined }) {
  const status = classificarPrazo(prazo)
  if (!status) return <span className="text-cias-texto3">—</span>
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRAZO_CLASS[status]}`}
      title={
        status === 'vencido' ? 'Prazo vencido' : status === 'proximo' ? 'Prazo próximo (≤ 3 dias)' : 'Prazo fatal'
      }
    >
      {formatDateBR(prazo)}
    </span>
  )
}
