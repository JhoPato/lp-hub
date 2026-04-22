import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { adminService, type AdminManager } from '@/services/adminService'
import { cn } from '@/lib/utils'

type ManagerFilter = 'all' | 'active' | 'inactive' | 'multi_team' | 'unassigned'

function formatManagerDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function OwnerManagers() {
  const [managers, setManagers] = useState<AdminManager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ManagerFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    adminService.getManagers()
      .then(setManagers)
      .catch(() => setError('Failed to load managers.'))
      .finally(() => setLoading(false))
  }, [])

  const metrics = useMemo(() => {
    const active = managers.filter((manager) => manager.isActive).length
    const inactive = managers.length - active
    const multiTeam = managers.filter((manager) => (manager.teamIds?.length ?? 0) > 1).length
    const unassigned = managers.filter((manager) => (manager.teamIds?.length ?? 0) === 0 && !manager.teamId?._id).length

    return { total: managers.length, active, inactive, multiTeam, unassigned }
  }, [managers])

  const filteredManagers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return managers.filter((manager) => {
      const teams = manager.teamIds ?? []
      const isMultiTeam = teams.length > 1
      const isUnassigned = teams.length === 0 && !manager.teamId?._id

      const matchesFilter = (
        filter === 'all'
        || (filter === 'active' && manager.isActive)
        || (filter === 'inactive' && !manager.isActive)
        || (filter === 'multi_team' && isMultiTeam)
        || (filter === 'unassigned' && isUnassigned)
      )

      if (!matchesFilter) return false
      if (!query) return true

      const haystack = [
        manager.username,
        manager.email,
        manager.discordUsername,
        manager.teamId?.name,
        manager.teamId?.tag,
        ...(teams.flatMap((team) => [team.name, team.tag, team.region])),
      ]

      return haystack.filter(Boolean).some((value) => value!.toLowerCase().includes(query))
    })
  }, [filter, managers, search])

  const toggleExpand = (id: string) => {
    setExpanded((current) => current === id ? null : id)
  }

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const toggleActive = (manager: AdminManager) =>
    withBusy(`${manager._id}_active`, async () => {
      const updated = await adminService.setManagerActive(manager._id, !manager.isActive)
      setManagers((current) => current.map((item) => item._id === manager._id ? { ...item, ...updated } : item))
    })

  const removeFromTeam = (manager: AdminManager, teamId: string) =>
    withBusy(`${manager._id}_team_${teamId}`, async () => {
      const updated = await adminService.removeManagerFromTeam(manager._id, teamId)
      setManagers((current) => current.map((item) => item._id === manager._id ? { ...item, ...updated } : item))
    })

  const deleteManager = (manager: AdminManager) => {
    if (!confirm(`Delete account "${manager.username}"? This cannot be undone.`)) return

    void withBusy(`${manager._id}_delete`, async () => {
      await adminService.deleteUser(manager._id)
      setManagers((current) => current.filter((item) => item._id !== manager._id))
      setExpanded((current) => current === manager._id ? null : current)
    })
  }

  return (
    <PageWrapper title="Managers">
      <div className="w-full space-y-5">
        <div className="grid items-start gap-4 xl:items-stretch xl:grid-cols-[minmax(0,1.35fr)_340px]">
          <Card className="h-full overflow-visible">
            <CardBody className="relative h-full overflow-hidden rounded-[inherit] p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent_55%)]" />
              <div className="relative space-y-5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">Manager operations</h2>
                    <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                      Review who is active, who owns more than one team, and where organisation coverage is thin.
                      This redesign keeps the existing controls but makes assignments much easier to scan.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)
                  ) : (
                    <>
                      <MetricCard label="Managers" value={String(metrics.total)} />
                      <MetricCard label="Active" value={String(metrics.active)} tone="success" />
                      <MetricCard label="Multi-Team" value={String(metrics.multiTeam)} tone="warning" />
                      <MetricCard label="Unassigned" value={String(metrics.unassigned)} tone="muted" />
                    </>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-bg-primary/45 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Find and segment
                  </p>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    icon={<Search size={14} />}
                    placeholder="Search manager, email, Discord or team"
                  />
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
                    <FilterButton active={filter === 'active'} onClick={() => setFilter('active')} label="Active" />
                    <FilterButton active={filter === 'inactive'} onClick={() => setFilter('inactive')} label="Inactive" />
                    <FilterButton active={filter === 'multi_team'} onClick={() => setFilter('multi_team')} label="Multi-Team" />
                    <FilterButton active={filter === 'unassigned'} onClick={() => setFilter('unassigned')} label="Unassigned" />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Focus</CardTitle>
              <CardDescription>Quick read on where the org needs owner attention.</CardDescription>
            </CardHeader>
            <CardBody className="flex h-full flex-col gap-2.5 pt-3">
              <FocusPanel
                className="flex-1"
                title="Inactive accounts"
                value={loading ? '--' : String(metrics.inactive)}
                helper="Managers who currently cannot operate team flows."
                tone="danger"
              />
              <FocusPanel
                className="flex-1"
                title="Unassigned coverage"
                value={loading ? '--' : String(metrics.unassigned)}
                helper="Managers with no team connected right now."
                tone="muted"
              />
            </CardBody>
          </Card>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[230px] rounded-xl" />
            ))}
          </div>
        ) : filteredManagers.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-sm text-text-secondary">
              No managers matched your current search and filter.
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredManagers.map((manager) => {
              const isOpen = expanded === manager._id
              const teams = manager.teamIds ?? []
              const primaryTeam = manager.teamId
              const isBusyActive = busy === `${manager._id}_active`
              const isBusyDelete = busy === `${manager._id}_delete`

              return (
                <Card key={manager._id} className="overflow-hidden">
                  <CardBody className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <Avatar src={manager.discordAvatar ?? manager.profilePhotoUrl} name={manager.username} size="lg" />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-text-primary">{manager.username}</h3>
                            <Badge variant={manager.isActive ? 'success' : 'danger'}>
                              {manager.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {(teams.length > 1) && <Badge variant="warning">Multi-Team</Badge>}
                          </div>
                          <p className="truncate text-sm text-text-secondary">{manager.email}</p>
                          <p className="text-xs text-text-muted">
                            Joined {formatManagerDate(manager.createdAt)}
                            {primaryTeam ? ` - Primary team: ${primaryTeam.name} [${primaryTeam.tag}]` : ' - No primary team'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleExpand(manager._id)}
                        className="rounded-lg border border-border bg-bg-primary/70 p-2 text-text-muted transition-colors hover:border-accent/35 hover:text-text-primary"
                        aria-label={isOpen ? 'Collapse manager card' : 'Expand manager card'}
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <InlineMetric label="Teams" value={String(teams.length)} />
                      <InlineMetric label="Discord" value={manager.discordUsername ? 'Connected' : 'Missing'} />
                      <InlineMetric label="Status" value={manager.isActive ? 'Enabled' : 'Disabled'} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Assigned Teams</p>
                        <span className="text-xs text-text-muted">{teams.length} linked</span>
                      </div>
                      {teams.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {teams.map((team) => (
                            <div key={team._id} className="rounded-full border border-border bg-bg-primary/60 px-3 py-1.5 text-sm text-text-primary">
                              {team.tag} - {team.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-text-secondary">
                          No teams assigned right now.
                        </div>
                      )}
                    </div>

                    {isOpen && (
                      <div className="space-y-4 rounded-xl border border-border bg-bg-primary/55 p-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <InfoField label="Discord" value={manager.discordUsername ?? 'Not connected'} />
                          <InfoField label="Primary Team" value={primaryTeam ? `${primaryTeam.name} [${primaryTeam.tag}]` : 'Not set'} />
                          <InfoField label="Joined" value={formatManagerDate(manager.createdAt)} />
                        </div>

                        {teams.length > 0 && (
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                              Remove Team Access
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {teams.map((team) => {
                                const removeBusy = busy === `${manager._id}_team_${team._id}`
                                return (
                                  <div key={team._id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2">
                                    <span className="text-sm text-text-primary">{team.name}</span>
                                    <span className="text-xs text-text-muted">[{team.tag}]</span>
                                    <button
                                      onClick={() => removeFromTeam(manager, team._id)}
                                      disabled={removeBusy}
                                      className={cn(
                                        'rounded p-1 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger',
                                        removeBusy && 'cursor-not-allowed opacity-50'
                                      )}
                                      title={`Remove from ${team.name}`}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={isBusyActive}
                        onClick={() => toggleActive(manager)}
                      >
                        {manager.isActive ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={isBusyDelete}
                        onClick={() => deleteManager(manager)}
                      >
                        <Trash2 size={13} /> Delete Account
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning' | 'muted'
}) {
  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      tone === 'success' && 'border-success/20 bg-success/8',
      tone === 'warning' && 'border-warning/20 bg-warning/8',
      tone === 'muted' && 'border-border bg-bg-primary/70',
      tone === 'default' && 'border-border bg-bg-primary/70'
    )}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-text-primary">{value}</div>
    </div>
  )
}

function FocusPanel({
  title,
  value,
  helper,
  tone,
  className,
}: {
  title: string
  value: string
  helper: string
  tone: 'danger' | 'muted'
  className?: string
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3.5',
      tone === 'danger' ? 'border-danger/25 bg-danger/8' : 'border-border bg-bg-primary/60'
      ,
      className
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{title}</p>
          <p className="mt-2.5 text-3xl font-semibold text-text-primary">{value}</p>
        </div>
        <Badge variant={tone === 'danger' ? 'danger' : 'muted'}>
          {tone === 'danger' ? 'Needs Review' : 'Coverage'}
        </Badge>
      </div>
      <p className="mt-2.5 text-sm leading-6 text-text-secondary">{helper}</p>
    </div>
  )
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-2 text-sm transition-colors',
        active
          ? 'border-accent/40 bg-accent/12 text-accent'
          : 'border-border bg-bg-secondary text-text-secondary hover:border-accent/25 hover:text-text-primary'
      )}
    >
      {label}
    </button>
  )
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary px-4 py-3">
      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="truncate text-sm text-text-primary">{value}</p>
    </div>
  )
}
