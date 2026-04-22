import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, className, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="relative flex min-h-full items-start justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-2xl',
                'max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-3rem)]',
                className
              )}
            >
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>

              {title && (
                <div className="shrink-0 border-b border-border/80 px-6 py-5 pr-14">
                  <h2 className="text-base font-semibold text-text-primary">{title}</h2>
                </div>
              )}

              <div className={cn('overflow-y-auto', title ? 'px-6 py-5' : 'p-6')}>
                {children}
              </div>

              {footer && (
                <div className="shrink-0 border-t border-border/80 bg-bg-secondary px-6 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
