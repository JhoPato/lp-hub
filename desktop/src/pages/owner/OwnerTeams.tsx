import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { Trash2, Users, Shield, Sword, Star, Pencil, ChevronUp, Copy, Check, ToggleLeft, ToggleRight, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { adminService, type AdminTeam, type TeamPlayer, type InviteCode } from '@/services/adminService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

type ImpRole = 'manager' | 'player' | 'captain'

const ROLE_CONFIG: Record<ImpRole, { label: string; icon: React.ReactNode; color: string; route: string }> = {
  manager: { label: 'Manager', icon: <Shield size={11} />, color: 'text-[#F59E0B] hover:bg-[#F59E0B]/10 border-[#F59E0B]/40', route: '/manager' },
  captain: { label: 'Captain', icon: <Star size={11} />,  color: 'text-[#D97706] hover:bg-[#D97706]/10 border-[#D97706]/40', route: '/board' },
  player:  { label: 'Player',  icon: <Sword size={11} />, color: 'text-[#B45309] hover:bg-[#B45309]/10 border-[#B45309]/40', route: '/board' },
}

export default function OwnerTeams() {
  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState<string | null>(null)
  const { user, startImpersonation } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    adminService.getTeams()
      .then(setTeams)
      .catch(() => setError('Failed to load teams'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this team? This cannot be undone.')) return
    await adminService.deleteTeam(id)
    setTeams((prev) => prev.filter((t) => t._id !== id))
    if (editOpen === id) setEditOpen(null)
  }

  const handleImpersonate = async (team: AdminTeam, role: ImpRole) => {
    const key = `${team._id}_${role}`
    setBusy(key)
    try {
      const res = await adminService.impersonate(team._id, role)
      startImpersonation(res.token, { id: user!.id, username: user!.username, role, teamId: team._id }, {
        teamId: team._id, teamName: team.name, teamTag: team.tag, teamRegion: team.region, teamLogo: team.logoUrl, role,
      })
      navigate(ROLE_CONFIG[role].route)
    } catch { alert('Failed to impersonate') }
    finally { setBusy(null) }
  }

  return (
    <PageWrapper title="Teams">
      <div className="w-full space-y-4">
        <p className="text-sm text-text-muted">{loading ? '—' : `${teams.length} teams`}</p>
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-tertiary text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-left">Tag</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Game</th>
                <th className="px-4 py-3 text-left">Manager</th>
                <th className="px-4 py-3 text-center">Players</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : teams.map((team) => (
                    <Fragment key={team._id}>
                      <tr className={cn('border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors', editOpen === team._id && 'bg-bg-tertiary/30')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar src={team.logoUrl} name={team.name} size="sm" />
                            <span className="font-medium text-text-primary">{team.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">{team.tag}</td>
                        <td className="px-4 py-3 text-text-secondary uppercase text-xs">{team.region}</td>
                        <td className="px-4 py-3 text-text-secondary">{team.game ?? '—'}</td>
                        <td className="px-4 py-3 text-text-secondary">{team.managerName ?? <span className="text-text-muted">None</span>}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1 text-text-secondary">
                            <Users size={13} /><span>{team.playerCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {(['manager', 'captain', 'player'] as ImpRole[]).map((role) => {
                              const cfg = ROLE_CONFIG[role]
                              const key = `${team._id}_${role}`
                              return (
                                <button key={role} onClick={() => handleImpersonate(team, role)} disabled={busy === key}
                                  className={cn('flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors', cfg.color, busy === key && 'opacity-50 cursor-not-allowed')}
                                  title={`Enter as ${cfg.label}`}>
                                  {cfg.icon}{cfg.label}
                                </button>
                              )
                            })}
                            <button
                              onClick={() => setEditOpen((p) => p === team._id ? null : team._id)}
                              className={cn('rounded p-1.5 transition-colors ml-1', editOpen === team._id ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary')}
                            >
                              {editOpen === team._id ? <ChevronUp size={14} /> : <Pencil size={14} />}
                            </button>
                            <button onClick={() => handleDelete(team._id)} className="rounded p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editOpen === team._id && (
                        <tr className="border-b border-border">
                          <td colSpan={7} className="p-0">
                            <TeamEditPanel team={team} onUpdated={(t) => setTeams((prev) => prev.map((x) => x._id === t._id ? { ...x, ...t } : x))} onDelete={() => handleDelete(team._id)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  )
}

// ─── Edit Panel ────────────────────────────────────────────────────────────────

function TeamEditPanel({ team, onUpdated, onDelete }: {
  team: AdminTeam
  onUpdated: (t: AdminTeam) => void
  onDelete: () => void
}) {
  const [form, setForm] = useState({ name: team.name, tag: team.tag, region: team.region, game: team.game ?? '' })
  const [players, setPlayers] = useState<TeamPlayer[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [multiRegion, setMultiRegion] = useState(team.multiRegionEnabled ?? false)
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyInvite, setBusyInvite] = useState<string | null>(null)
  const [busyPlayer, setBusyPlayer] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      adminService.getTeamPlayers(team._id),
      adminService.getTeamInvites(team._id),
    ]).then(([p, i]) => { setPlayers(p); setInvites(i) })
      .finally(() => setLoadingPlayers(false))
  }, [team._id])

  const save = async () => {
    setSaving(true)
    try {
      const updated = await adminService.updateTeam(team._id, form as Partial<AdminTeam>)
      onUpdated(updated)
    } finally { setSaving(false) }
  }

  const generateInvite = async (role: string) => {
    setBusyInvite(role)
    try {
      const inv = await adminService.generateTeamInvite(team._id, role)
      setInvites((p) => [inv, ...p])
    } finally { setBusyInvite(null) }
  }

  const revokeInvite = async (id: string) => {
    await adminService.deleteInvite(id)
    setInvites((p) => p.filter((i) => i._id !== id))
  }

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const changeRole = async (playerId: string, role: string) => {
    setBusyPlayer(playerId)
    try {
      const updated = await adminService.updatePlayerRole(team._id, playerId, role)
      setPlayers((p) => p.map((x) => x._id === playerId ? { ...x, role: updated.role } : x))
    } finally { setBusyPlayer(null) }
  }

  const toggleActive = async (player: TeamPlayer) => {
    setBusyPlayer(player._id + '_active')
    try {
      const updated = await adminService.togglePlayerActive(team._id, player._id, !player.isActive)
      setPlayers((p) => p.map((x) => x._id === player._id ? { ...x, isActive: updated.isActive } : x))
    } finally { setBusyPlayer(null) }
  }

  const toggleMultiRegion = async () => {
    const next = !multiRegion
    setMultiRegion(next)
    await adminService.toggleTeamFeature(team._id, next)
  }

  const activeInvites = invites.filter((i) => !i.isUsed && new Date(i.expiresAt) > new Date())

  return (
    <div className="bg-bg-primary border-t border-accent/20 px-6 py-5 space-y-6">
      {/* Fields + Save */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Name"   value={form.name}   onChange={(v) => setForm((p) => ({ ...p, name: v }))}   className="flex-1 min-w-[160px]" />
        <Field label="Tag"    value={form.tag}    onChange={(v) => setForm((p) => ({ ...p, tag: v }))}    className="w-24" />
        <Field label="Region" value={form.region} onChange={(v) => setForm((p) => ({ ...p, region: v }))} className="w-24" />
        <Field label="Game"   value={form.game}   onChange={(v) => setForm((p) => ({ ...p, game: v }))}   className="w-32" />
        <Button size="sm" loading={saving} onClick={save}><Save size={13} /> Save</Button>
      </div>

      {/* Invite + Multi-region + Delete */}
      <div className="flex flex-wrap items-center gap-2">
        {(['manager', 'captain', 'player'] as const).map((role) => (
          <Button key={role} variant="secondary" size="sm" loading={busyInvite === role} onClick={() => generateInvite(role)}>
            + {role.charAt(0).toUpperCase() + role.slice(1)} Invite
          </Button>
        ))}
        <button
          onClick={toggleMultiRegion}
          className={cn('ml-2 flex items-center gap-1.5 text-xs transition-colors', multiRegion ? 'text-accent' : 'text-text-muted hover:text-text-secondary')}
        >
          {multiRegion ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          Multi-region
        </button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={onDelete}>
          <Trash2 size={13} /> Delete Team
        </Button>
      </div>

      {/* Players */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3">Players</p>
        {loadingPlayers
          ? <Skeleton className="h-20 w-full" />
          : players.length === 0
            ? <p className="text-sm text-text-muted">No players.</p>
            : (
              <div className="space-y-1.5">
                {players.map((p) => (
                  <div key={p._id} className="flex items-center gap-3 rounded-md border border-border bg-bg-tertiary px-3 py-2">
                    <Avatar src={p.discordAvatar ?? p.profilePhotoUrl} name={p.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{p.username}</p>
                      <p className="text-xs text-text-muted truncate">{p.email}</p>
                    </div>
                    <Badge variant={p.role as 'manager' | 'player'}>{p.role}</Badge>
                    <select
                      value={p.role}
                      onChange={(e) => changeRole(p._id, e.target.value)}
                      disabled={busyPlayer === p._id}
                      className="rounded border border-border bg-bg-primary text-text-secondary text-xs px-2 py-1 outline-none focus:border-accent"
                    >
                      <option value="player">Player</option>
                      <option value="captain">Captain</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={busyPlayer === p._id + '_active'}
                      className={cn('text-xs font-medium transition-colors', p.isActive ? 'text-success hover:text-danger' : 'text-danger hover:text-success')}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* Active Invites */}
      {activeInvites.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3">Active Invites</p>
          <div className="space-y-1.5">
            {activeInvites.map((inv) => (
              <div key={inv._id} className="flex items-center gap-3 rounded-md border border-border bg-bg-tertiary px-3 py-2">
                <span className="font-mono text-sm text-text-primary tracking-wider">{inv.code}</span>
                <Badge variant="muted">{inv.role}</Badge>
                <span className="text-xs text-text-muted ml-auto">expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                <button onClick={() => copyInvite(inv.code)} className="rounded p-1 text-text-muted hover:text-text-primary transition-colors">
                  {copied === inv.code ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
                <button onClick={() => revokeInvite(inv._id)} className="rounded p-1 text-text-muted hover:text-danger transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary text-text-primary text-sm px-3 py-2 outline-none focus:border-accent transition-colors"
      />
    </div>
  )
}
