import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, iconRight, id, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const hasValue = Boolean(props.value || props.defaultValue)

    return (
      <div className="relative w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'absolute left-3 transition-all duration-150 pointer-events-none text-text-muted',
              icon ? 'left-9' : 'left-3',
              focused || hasValue
                ? 'top-1.5 text-[10px] text-accent'
                : 'top-1/2 -translate-y-1/2 text-sm'
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none flex items-center">{icon}</span>
          )}
          <input
            ref={ref}
            id={id}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
            className={cn(
              'w-full rounded-md border bg-bg-tertiary text-text-primary text-sm transition-colors',
              'placeholder:text-text-muted outline-none',
              'focus:border-accent focus:ring-1 focus:ring-accent',
              error ? 'border-danger' : 'border-border',
              label ? 'pt-5 pb-1.5' : 'py-2.5',
              icon ? 'pl-9' : 'pl-3',
              iconRight ? 'pr-9' : 'pr-3',
              className
            )}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">{iconRight}</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
