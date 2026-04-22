import { motion } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { TeamInfo } from '@/types'

interface Props {
  teams: TeamInfo[]
  onSelect: (teamId: string) => void
  onCancel: () => void
}

export default function TeamSelectModal({ teams, onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-base font-semibold text-text-primary">Select team</h2>
        <p className="mb-4 text-sm text-text-muted">You belong to multiple teams</p>

        <div className="flex flex-col gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg-tertiary px-4 py-3 text-left transition-colors hover:border-accent/50 hover:bg-[#252220]"
            >
              <Avatar src={t.logoUrl} name={t.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                <p className="text-xs text-text-muted">{t.region}</p>
              </div>
              <Badge variant={t.role as 'owner' | 'manager' | 'player' | 'viewer'}>{t.role}</Badge>
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onCancel}>
          Cancel
        </Button>
      </motion.div>
    </div>
  )
}
