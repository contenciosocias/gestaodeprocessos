import { ExternalLink } from 'lucide-react'
import { Modal } from './Modal'
import type { IntimacaoComProcesso } from '../types'
import { decodeHtmlEntities, formatDateBR } from '../lib/format'

export function TeorModal({ intimacao, onClose }: { intimacao: IntimacaoComProcesso | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(intimacao)} onClose={onClose} title="Teor da intimação">
      {intimacao && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Campo rotulo="Processo" valor={intimacao.numero_processo} />
            <Campo rotulo="Tribunal / Órgão" valor={[intimacao.sigla_tribunal, intimacao.nome_orgao].filter(Boolean).join(' · ')} />
            <Campo rotulo="Tipo" valor={intimacao.tipo_comunicacao} />
            <Campo rotulo="Disponibilização" valor={formatDateBR(intimacao.data_disponibilizacao)} />
            <Campo rotulo="Destinatário" valor={intimacao.destinatario_advogado} />
          </dl>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-cias-texto2">Teor</div>
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-cias-borda bg-cias-superficie p-4 text-sm leading-relaxed text-cias-texto">
              {decodeHtmlEntities(intimacao.teor) || 'Sem teor disponível.'}
            </div>
          </div>

          {intimacao.link_certidao && (
            <a
              href={intimacao.link_certidao}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-cias-vermelho hover:underline"
            >
              <ExternalLink size={15} /> Abrir certidão
            </a>
          )}
        </div>
      )}
    </Modal>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-cias-texto2">{rotulo}</dt>
      <dd className="text-cias-texto">{valor || '—'}</dd>
    </div>
  )
}
