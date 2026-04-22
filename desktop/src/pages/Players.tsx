import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw, Save, Shield, Users } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { workspaceService, type WorkspacePlayer } from '@/services/workspaceService'

export default function Players() {
  const user = useAuthStore((state) => state.user)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [players, setPlayers] = useState<WorkspacePlayer[]>([])
  const [panelDrafts, setPanelDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    void load()
  }, [])

  const stats = useMemo(() => ({
    total: players.length,
    active: players.filter((player) => player.isActive !== false).length,
    captains: players.filter((player) => player.role === 'captain').length,
    managers: players.filter((player) => player.role === 'manager').length,
  }), [players])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await workspaceService.getPlayers()
      setPlayers(data)
      setPanelDrafts(Object.fromEntries(data.map((item) => [item._id, item.apiPanelPlayerName ?? ''])))
    } catch {
      setError('Players could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function updateRole(player: WorkspacePlayer, role: 'player' | 'captain' | 'manager') {
    setBusyId(`${player._id}:role`)
    try {
      const updated = await workspaceService.updatePlayerRole(player._id, role)
      setPlayers((current) => current.map((entry) => entry._id === updated._id ? updated : entry))
    } catch {
      setError('The role could not be updated.')
    } finally {
      setBusyId('')
    }
  }

  async function toggleActive(player: WorkspacePlayer) {
    setBusyId(`${player._id}:active`)
    try {
      const updated = await workspaceService.updatePlayerActive(player._id, player.isActive === false)
      setPlayers((current) => current.map((entry) => entry._id === updated._id ? updated : entry))
    } catch {
      setError('The active state could not be updated.')
    } finally {
      setBusyId('')
    }
  }

  async function savePanelSync(player: WorkspacePlayer) {
    setBusyId(`${player._id}:panel`)
    try {
      const updated = await workspaceService.updatePlayerPanelSync(player._id, panelDrafts[player._id] ?? '')
      setPlayers((current) => current.map((entry) => entry._id === updated._id ? updated : entry))
    } catch {
      setError('The panel sync name could not be saved.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <PageWrapper title="Players">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Roster Control</h2>
            <p className="mt-1 text-sm text-text-secondary">Manage roles, activity state and panel sync names.</p>
          </div>
          <Button variant="secondary" onClick={() => void load()}><RefreshCcw size={14} /> Refresh</Button>
        </div>

        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Total" value={String(stats.total)} />
          <StatCard icon={Shield} label="Active" value={String(stats.active)} />
          <StatCard icon={Shield} label="Captains" value={String(stats.captains)} />
          <StatCard icon={Shield} label="Managers" value={String(stats.managers)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
            <CardDescription>All users connected to the current team.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
            ) : players.length === 0 ? (
              <EmptyState message="No players found for this team." />
            ) : (
              players.map((player) => {
                const isSelf = player._id === user?._id || player._id === user?.id
                const roleVariant = player.role === 'player' || player.role === 'captain' || player.role === 'manager' || player.role === 'owner'
                  ? player.role
                  : 'muted'
                return (
                  <div key={player._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-4">
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
                      <div className="flex items-center gap-3">
                        <Avatar src={player.discordAvatar || player.profilePhotoUrl} name={player.username} size="lg" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-text-primary">{player.username}</p>
                            <Badge variant={roleVariant}>{player.role}</Badge>
                            {isSelf && <Badge variant="muted">You</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">
                            {player.riotGameName ? `${player.riotGameName}#${player.riotTagLine || ''}` : 'No Riot ID configured'}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Role</label>
                          <select
                            value={player.role}
                            disabled={isSelf || busyId === `${player._id}:role`}
                            onChange={(event) => void updateRole(player, event.target.value as 'player' | 'captain' | 'manager')}
                            className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                          >
                            <option value="player">Player</option>
                            <option value="captain">Captain</option>
                            <option value="manager">Manager</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Activity</label>
                          <Button variant={player.isActive === false ? 'secondary' : 'primary'} className="w-full" disabled={isSelf || busyId === `${player._id}:active`} onClick={() => void toggleActive(player)}>
                            {player.isActive === false ? 'Activate' : 'Deactivate'}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">LP Panel Sync</label>
                        <div className="flex gap-2">
                          <input
                            value={panelDrafts[player._id] ?? ''}
                            onChange={(event) => setPanelDrafts((current) => ({ ...current, [player._id]: event.target.value }))}
                            placeholder="Exact panel player name"
                            className="flex-1 rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                          />
                          <Button variant="secondary" disabled={busyId === `${player._id}:panel`} onClick={() => void savePanelSync(player)}>
                            <Save size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="rounded-lg border border-accent/20 bg-accent/10 p-3 text-accent">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-text-primary">{value}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
        </div>
      </CardBody>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
