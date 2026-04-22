import { useEffect, useState } from 'react'
import { Trash2, Copy, Check, Plus, Sparkles } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { adminService, type AdminTeam, type InviteCode } from '@/services/adminService'
import { cn } from '@/lib/utils'

function inviteStatus(inv: InviteCode): 'success' | 'danger' | 'muted' {
  if (inv.isUsed) return 'muted'
  if (new Date(inv.expiresAt) < new Date()) return 'danger'
  return 'success'
}

function inviteLabel(inv: InviteCode): string {
  if (inv.isUsed) return 'Used'
  if (new Date(inv.expiresAt) < new Date()) return 'Expired'
  return 'Active'
}

export default function OwnerInvites() {
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createRole, setCreateRole] = useState('player')
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [selectedTeamId, setSelectedTeamId] = useState('')

  const teamScopedRole = ['player', 'captain', 'manager'].includes(createRole)

  useEffect(() => {
    Promise.all([adminService.getInvites(), adminService.getTeams()])
      .then(([inviteRows, teamRows]) => {
        setInvites(inviteRows)
        setTeams(teamRows)
        setSelectedTeamId(teamRows[0]?._id ?? '')
      })
      .catch(() => setError('Failed to load invites'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this invite?')) return
    try {
      await adminService.deleteInvite(id)
      setInvites((prev) => prev.filter((i) => i._id !== id))
    } catch {
      alert('Failed to revoke invite')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  const createInvite = async () => {
    if (teamScopedRole && !selectedTeamId) {
      setError('Select a team before generating a player, captain, or manager invite.')
      return
    }

    setCreating(true)
    setError('')
    try {
      const created = await adminService.generateInvite({
        role: createRole,
        expiresInDays: Number(expiresInDays) || 7,
        teamId: teamScopedRole ? selectedTeamId : undefined,
      })
      setInvites((prev) => [created, ...prev])
      copyCode(created.code)
      setCreateOpen(false)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create invite')
    } finally {
      setCreating(false)
    }
  }

  const active = invites.filter((i) => !i.isUsed && new Date(i.expiresAt) > new Date()).length
  const used = invites.filter((i) => i.isUsed).length
  const expired = invites.filter((i) => !i.isUsed && new Date(i.expiresAt) <= new Date()).length

  return (
    <PageWrapper title="Invites">
      <div className="w-full space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="relative overflow-visible">
            <div className="pointer-events-none absolute -right-16 top-6 h-40 w-40 rounded-full bg-accent/12 blur-3xl" />
            <div className="pointer-events-none absolute right-24 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-accent/8 blur-2xl" />
            <CardBody className="relative overflow-hidden rounded-[inherit] p-0">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_58%)]" />
              <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_62%)]" />
              <div className="relative space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">Access invites</h2>
                    <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                      Generate fresh codes for new members, copy them quickly, and keep an eye on what is still live.
                    </p>
                  </div>
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus size={14} /> Create invite
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <InviteMetric label="Active" value={String(active)} tone="success" />
                  <InviteMetric label="Used" value={String(used)} tone="muted" />
                  <InviteMetric label="Expired" value={String(expired)} tone="danger" />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Notes</CardTitle>
              <CardDescription>Owner invites can create organisation-wide access when needed.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              <div className="rounded-xl border border-border bg-bg-primary/60 p-4">
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles size={15} />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Recommended</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  Use `player`, `captain`, and `manager` for team access. Reserve `social` and `owner` for internal ops only.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-tertiary text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Used By</th>
                <th className="px-4 py-3 text-left">Created By</th>
                <th className="px-4 py-3 text-left">Expires</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : invites.map((inv) => {
                    const status = inviteStatus(inv)
                    const isExpiredOrUsed = status !== 'success'
                    return (
                      <tr
                        key={inv._id}
                        className={cn(
                          'border-b border-border/50 transition-colors',
                          isExpiredOrUsed ? 'opacity-50' : 'hover:bg-bg-tertiary/50'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-text-primary tracking-widest">{inv.code}</code>
                            <button
                              onClick={() => copyCode(inv.code)}
                              className="text-text-muted hover:text-text-primary transition-colors"
                            >
                              {copied === inv.code ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {inv.teamId ? (
                            <div className="space-y-0.5">
                              <p className="font-medium text-text-primary">
                                {inv.teamId.name} [{inv.teamId.tag}]
                              </p>
                              <p className="text-text-muted">{inv.teamId.region}</p>
                            </div>
                          ) : (
                            <span className="text-text-muted">Org-wide</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              ['owner', 'manager', 'captain', 'player', 'viewer'].includes(inv.role)
                                ? inv.role as 'owner' | 'manager' | 'captain' | 'player' | 'viewer'
                                : 'default'
                            }
                          >
                            {inv.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={status}>{inviteLabel(inv)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {inv.usedBy?.username ?? <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {inv.createdBy?.username ?? <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {!inv.isUsed && (
                              <button
                                onClick={() => handleDelete(inv._id)}
                                className="rounded p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>

        <Modal
          open={createOpen}
          onClose={() => !creating && setCreateOpen(false)}
          title="Create invite"
          footer={(
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={() => void createInvite()} loading={creating}>
                <Plus size={14} /> Generate code
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Role
              </label>
              <select
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value)}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
              >
                <option value="player">Player</option>
                <option value="captain">Captain</option>
                <option value="manager">Manager</option>
                <option value="social">Social</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            {teamScopedRole && (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Team
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                  className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name} [{team.tag}] - {team.region}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Expires In Days
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="rounded-xl border border-border bg-bg-primary/55 p-4 text-sm leading-6 text-text-secondary">
              {teamScopedRole
                ? 'Player, captain, and manager invites must be attached to an existing team.'
                : '`Social` and `owner` invites are teamless and should be used carefully.'}
            </div>
          </div>
        </Modal>
      </div>
    </PageWrapper>
  )
}

function InviteMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'success' | 'muted' | 'danger'
}) {
  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      tone === 'success' && 'border-success/20 bg-success/8',
      tone === 'danger' && 'border-danger/20 bg-danger/8',
      tone === 'muted' && 'border-border bg-bg-primary/70'
    )}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-text-primary">{value}</p>
    </div>
  )
}
