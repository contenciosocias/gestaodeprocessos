import type { Perfil } from '../types'

const PERFIL_LABEL: Record<Perfil, string> = { civel: 'Cível', trabalhista: 'Trabalhista' }

/**
 * Cabeçalho de página: "Título · ÁREA" (a área em laranja, menor, sem negrito),
 * com um espaço opcional à direita para ações (ex.: cadastro).
 */
export function PageHeader({
  titulo,
  perfil,
  right,
}: {
  titulo: string
  perfil: Perfil
  right?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight text-cias-texto">
        {titulo}{' '}
        <span className="text-base font-normal uppercase tracking-wide text-cias-laranja">
          · {PERFIL_LABEL[perfil]}
        </span>
      </h1>
      {right}
    </div>
  )
}
