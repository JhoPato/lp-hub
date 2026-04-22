import { useEffect, useMemo, useState } from 'react'
import { Copy, Link2, Plus, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { workspaceService, type WorkspaceInvite } from '@/services/workspaceService'

export default function InviteCodes() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [role, setRole] = useState<'player' | 'captain'>('player')
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    void load()
  }, [])

  const stats = useMemo(() => ({
    active: invites.filter((invite) => !invite.isUsed && new Date(invite.expiresAt) > new Date()).length,
    used: invites.filter((invite) => invite.isUsed).length,
    expired: invites.filter((invite) => !invite.isUsed && new Date(invite.expiresAt) <= new Date()).length,
  }), [invites])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setInvites(await workspaceService.getInvites())
    } catch {
      setError('Invite codes could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function generate() {
    setSaving(true)
    setError('')
    try {
      const created = await workspaceService.generateInvite({ role, expiresInDays: Number(expiresInDays) || 7 })
      setInvites((current) => [created, ...current])
    } catch {
      setError('The invite code could not be generated.')
    } finally {
      setSaving(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this invite code?')) return
    setBusyId(id)
    try {
      await workspaceService.revokeInvite(id)
      setInvites((current) => current.filter((invite) => invite._id !== id))
    } catch {
      setError('The invite code could not be revoked.')
    } finally {
      setBusyId('')
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      setError('The code could not be copied right now.')
    }
  }

  return (
    <PageWrapper title="Invite Codes">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="border-accent/20 bg-gradient-to-br from-accent/10 via-bg-tertiary to-bg-tertiary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus size={18} className="text-accent" />Create invite</CardTitle>
              <CardDescription>Managers can issue codes for player and captain access.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Role</label>
                <select value={role} onChange={(event) => setRole(event.target.value as 'player' | 'captain')} className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
                  <option value="player">Player</option>
                  <option value="captain">Captain</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Expires in days</label>
                <input value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => void generate()} loading={saving}><Link2 size={14} /> Generate code</Button>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <StatCard label="Active" value={String(stats.active)} />
            <StatCard label="Used" value={String(stats.used)} />
            <StatCard label="Expired" value={String(stats.expired)} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invite history</CardTitle>
            <CardDescription>Track which codes are live, used or expired.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
            ) : invites.length === 0 ? (
              <EmptyState message="No invite codes generated yet." />
            ) : (
              invites.map((invite) => {
                const expired = new Date(invite.expiresAt) <= new Date()
                const status = invite.isUsed ? 'used' : expired ? 'expired' : 'active'
                const roleVariant = invite.role === 'player' || invite.role === 'captain' || invite.role === 'manager' || invite.role === 'owner'
                  ? invite.role
                  : 'muted'
                return (
                  <div key={invite._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-semibold tracking-[0.18em] text-text-primary">{invite.code}</p>
                          <Badge variant={roleVariant}>{invite.role}</Badge>
                          <Badge variant={status === 'active' ? 'success' : status === 'used' ? 'muted' : 'warning'}>{status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">
                          Expires {new Date(invite.expiresAt).toLocaleString()}
                          {invite.usedBy?.username ? ` | used by ${invite.usedBy.username}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void copyCode(invite.code)}>
                          <Copy size={14} /> Copy
                        </Button>
                        {!invite.isUsed && !expired && (
                          <Button variant="secondary" size="sm" disabled={busyId === invite._id} onClick={() => void revoke(invite._id)}>
                            <Trash2 size={14} /> Revoke
                          </Button>
                        )}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-2xl font-semibold text-text-primary">{value}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
      </CardBody>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
