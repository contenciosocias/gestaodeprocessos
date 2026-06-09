import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** Largura máxima (classe Tailwind). Padrão: max-w-3xl. */
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-3xl' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`w-full ${maxWidth} rounded-xl border border-cias-borda bg-cias-base shadow-xl`}>
        <div className="flex items-center justify-between gap-4 border-b border-cias-borda px-6 py-4">
          <h2 className="text-base font-semibold text-cias-texto">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-cias-texto2 transition hover:bg-cias-superficie2 hover:text-cias-texto"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
