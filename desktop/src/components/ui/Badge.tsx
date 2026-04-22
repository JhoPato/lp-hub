import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-accent/20 text-accent',
        success: 'bg-success/20 text-success',
        warning: 'bg-warning/20 text-warning',
        danger: 'bg-danger/20 text-danger',
        muted: 'bg-bg-tertiary text-text-muted border border-border',
        owner: 'bg-accent/20 text-accent',
        manager: 'bg-warning/20 text-warning',
        captain: 'bg-accent/20 text-accent',
        player: 'bg-success/20 text-success',
        viewer: 'bg-bg-tertiary text-text-muted border border-border',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
