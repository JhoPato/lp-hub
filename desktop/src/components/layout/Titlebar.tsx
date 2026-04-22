import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Titlebar() {
  const isElectron = Boolean(window.api)

  if (!isElectron) return null

  return (
    <div
      className="flex h-8 items-center justify-between bg-bg-primary border-b border-border select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-3">
        <span className="text-xs font-semibold text-text-muted tracking-widest uppercase">LP-Hub</span>
      </div>
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <TitlebarBtn onClick={() => window.api.window.minimize()} label="Minimize">
          <Minus size={12} />
        </TitlebarBtn>
        <TitlebarBtn onClick={() => window.api.window.maximize()} label="Maximize">
          <Square size={11} />
        </TitlebarBtn>
        <TitlebarBtn
          onClick={() => window.api.window.close()}
          label="Close"
          className="hover:bg-danger"
        >
          <X size={12} />
        </TitlebarBtn>
      </div>
    </div>
  )
}

function TitlebarBtn({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  className?: string
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-8 w-11 items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors',
        className
      )}
    >
      {children}
    </button>
  )
}
