import type { StatusIntimacao } from '../types'

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

/** Etiqueta neutra para a classe de um apenso e afins. */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-cias-superficie2 px-2 py-0.5 text-xs font-medium text-cias-texto2 ring-1 ring-inset ring-cias-borda">
      {children}
    </span>
  )
}
