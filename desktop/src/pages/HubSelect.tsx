import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { homeRouteForRole } from '@/lib/roleRoutes'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/authService'
import type { TeamInfo, ActiveHub } from '@/types'

export default function HubSelect() {
  const { user, setHub, logout } = useAuthStore()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    authService
      .getMyTeams()
      .then(setTeams)
      .catch(() => setError('Failed to load your teams'))
      .finally(() => setLoading(false))
  }, [])

  const selectTeam = (team: TeamInfo) => {
    const hub: ActiveHub = {
      teamId: team.id,
      teamName: team.name,
      teamTag: team.tag,
      teamRegion: team.region,
      teamLogo: team.logoUrl,
      role: team.role,
    }
    setHub(hub)
    navigate(homeRouteForRole(team.role))
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-bg-primary p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Select Team</h1>
            <p className="mt-1 text-sm text-text-muted">
              Welcome, <span className="text-text-secondary">{user?.username}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={16} />
            Sign out
          </Button>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid gap-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            : teams.map((team, i) => (
                <motion.button
                  key={team.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => selectTeam(team)}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-bg-tertiary p-4 text-left transition-colors hover:border-accent/50 hover:bg-[#252220]"
                >
                  <Avatar src={team.logoUrl} name={team.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary transition-colors group-hover:text-accent">
                      {team.name}
                    </p>
                    <p className="text-xs text-text-muted">{team.tag} | {team.region}</p>
                  </div>
                  <Badge variant={team.role as 'owner' | 'manager' | 'captain' | 'player' | 'viewer'}>
                    {team.role}
                  </Badge>
                </motion.button>
              ))}
        </div>

        {!loading && teams.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm text-text-muted">No teams found for your account</p>
            <p className="text-xs text-text-muted">Ask your manager for an invite code</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
