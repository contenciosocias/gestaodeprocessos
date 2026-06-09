import type { Perfil } from '../types'

const PERFIL_LABEL: Record<Perfil, string> = { civel: 'Cível', trabalhista: 'Trabalhista' }

/**
 * Cabeçalho de página: "Título · ÁREA" (a área em laranja, menor, sem negrito),
 * com um espaço opcional à direita para ações (ex.: cadastro).
 */
export function PageHeader({
  titulo,
  perfil,
  subtitulo,
  right,
}: {
  titulo: string
  perfil: Perfil
  subtitulo?: string
  right?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-cias-texto">
          {titulo}{' '}
          <span className="text-base font-normal uppercase tracking-wide text-cias-laranja">
            · {PERFIL_LABEL[perfil]}
          </span>
        </h1>
        {subtitulo && <p className="mt-0.5 text-xs text-cias-texto2">{subtitulo}</p>}
      </div>
      {right}
    </div>
  )
}
