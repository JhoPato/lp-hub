import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, ClipboardList, Image, Megaphone, Search, Swords, Users } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { adminService, type TeamStat } from '@/services/adminService'
import { cn } from '@/lib/utils'

type SortKey = 'impact' | 'win_rate' | 'pracc' | 'tasks' | 'issues' | 'alphabetical'

function formatLastPracc(value: string | null) {
  if (!value) return 'No pracc logged yet'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No pracc logged yet'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function teamHealth(team: TeamStat) {
  const issueCount = team.inactive + team.noPhoto + (team.tasksOpen > 6 ? 1 : 0)
  if (issueCount >= 5) return { label: 'Needs Attention', variant: 'danger' as const }
  if (issueCount >= 2) return { label: 'Watchlist', variant: 'warning' as const }
  return { label: 'Healthy', variant: 'success' as const }
}

function teamImpactScore(team: TeamStat) {
  const winRate = team.winRate ?? 0
  const completedTasks = team.tasksDone * 2
  const content = team.announcements + team.galleryPhotos + team.adminPhotos
  return Math.round((team.praccTotal * 1.5) + winRate + completedTasks + content - (team.inactive * 4) - team.noPhoto)
}

export default function OwnerTeamStats() {
  const [teams, setTeams] = useState<TeamStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('impact')

  useEffect(() => {
    adminService.getTeamStats()
      .then(setTeams)
      .catch(() => setError('Failed to load team stats.'))
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const totalPlayers = teams.reduce((sum, team) => sum + team.players, 0)
    const totalPracc = teams.reduce((sum, team) => sum + team.praccTotal, 0)
    const totalOpenTasks = teams.reduce((sum, team) => sum + team.tasksOpen, 0)
    const teamsWithWinRate = teams.filter((team) => team.winRate !== null)
    const averageWinRate = teamsWithWinRate.length
      ? Math.round(teamsWithWinRate.reduce((sum, team) => sum + (team.winRate ?? 0), 0) / teamsWithWinRate.length)
      : 0

    return {
      totalPlayers,
      totalPracc,
      totalOpenTasks,
      averageWinRate,
    }
  }, [teams])

  const visibleTeams = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = teams.filter((team) => {
      if (!query) return true
      return [team.name, team.tag, team.region].some((value) => value.toLowerCase().includes(query))
    })

    const sorted = [...filtered].sort((left, right) => {
      if (sortBy === 'alphabetical') return left.name.localeCompare(right.name)
      if (sortBy === 'win_rate') return (right.winRate ?? -1) - (left.winRate ?? -1)
      if (sortBy === 'pracc') return right.praccTotal - left.praccTotal
      if (sortBy === 'tasks') return right.tasksOpen - left.tasksOpen
      if (sortBy === 'issues') return (right.inactive + right.noPhoto) - (left.inactive + left.noPhoto)
      return teamImpactScore(right) - teamImpactScore(left)
    })

    return sorted
  }, [search, sortBy, teams])

  return (
    <PageWrapper title="Team Stats">
      <div className="w-full space-y-5">
        <div className="grid items-start gap-4 xl:items-stretch xl:grid-cols-[minmax(0,1.35fr)_340px]">
          <Card className="h-full overflow-visible">
            <CardBody className="relative h-full overflow-hidden rounded-[inherit] p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent_58%)]" />
              <div className="relative space-y-5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                    <BarChart3 size={18} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">Team performance map</h2>
                    <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                      This view now reads like an operations dashboard instead of a flat spreadsheet. You can scan team
                      health, workload, content output and practice rhythm much faster.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)
                  ) : (
                    <>
                      <SummaryMetric label="Teams" value={String(teams.length)} />
                      <SummaryMetric label="Players" value={String(summary.totalPlayers)} />
                      <SummaryMetric label="Avg Win Rate" value={`${summary.averageWinRate}%`} tone="success" />
                      <SummaryMetric label="Open Tasks" value={String(summary.totalOpenTasks)} tone="warning" />
                    </>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-bg-primary/45 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Search and sort
                  </p>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    icon={<Search size={14} />}
                    placeholder="Search by team name, tag or region"
                  />
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortKey)}
                    className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                  >
                    <option value="impact">Sort by impact</option>
                    <option value="win_rate">Sort by win rate</option>
                    <option value="pracc">Sort by pracc volume</option>
                    <option value="tasks">Sort by open tasks</option>
                    <option value="issues">Sort by issues</option>
                    <option value="alphabetical">Sort alphabetically</option>
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Org Load</CardTitle>
              <CardDescription>Quick aggregate view of pressure across all teams.</CardDescription>
            </CardHeader>
            <CardBody className="flex h-full flex-col gap-2.5 pt-3">
              <InsightPanel
                className="flex-1"
                icon={<Swords size={16} />}
                label="Total pracc volume"
                value={loading ? '--' : String(summary.totalPracc)}
                helper="Scrims and practice history logged across the organisation."
              />
              <InsightPanel
                className="flex-1"
                icon={<ClipboardList size={16} />}
                label="Tasks waiting"
                value={loading ? '--' : String(summary.totalOpenTasks)}
                helper="Useful to see where leadership bandwidth is starting to stack up."
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
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[360px] rounded-xl" />
            ))}
          </div>
        ) : visibleTeams.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-sm text-text-secondary">
              No teams matched your current search.
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleTeams.map((team) => {
              const completionTotal = team.tasksOpen + team.tasksDone
              const completionPct = completionTotal > 0 ? Math.round((team.tasksDone / completionTotal) * 100) : 0
              const health = teamHealth(team)

              return (
                <Card key={team._id} className="h-full overflow-hidden">
                  <CardBody className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <Avatar src={team.logoUrl} name={team.name} size="lg" />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-text-primary">{team.name}</h3>
                            <Badge variant={health.variant}>{health.label}</Badge>
                          </div>
                          <p className="text-sm text-text-secondary">
                            {team.tag} - {team.region}
                          </p>
                          <p className="text-xs text-text-muted">
                            Last pracc: {formatLastPracc(team.lastPracc)}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-bg-primary/60 px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Impact</p>
                        <p className="mt-1 text-xl font-semibold text-text-primary">{teamImpactScore(team)}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniStat label="Players" value={String(team.players)} />
                      <MiniStat label="Captains" value={String(team.captains)} />
                      <MiniStat label="Managers" value={String(team.managers)} />
                    </div>

                    <section className="space-y-3 rounded-xl border border-border bg-bg-primary/55 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Competitive</p>
                        <Badge variant={team.winRate !== null && team.winRate >= 50 ? 'success' : 'muted'}>
                          {team.winRate !== null ? `${team.winRate}% WR` : 'No WR yet'}
                        </Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SignalRow icon={<Swords size={14} />} label="Pracc played" value={String(team.praccTotal)} />
                        <SignalRow
                          icon={<Activity size={14} />}
                          label="Record"
                          value={`${team.praccWins}W / ${team.praccLosses}L / ${team.praccDraws}D`}
                        />
                      </div>
                      <ProgressBar pct={Math.max(0, team.winRate ?? 0)} tone={(team.winRate ?? 0) >= 50 ? 'success' : 'warning'} />
                    </section>

                    <section className="space-y-3 rounded-xl border border-border bg-bg-primary/55 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Operations</p>
                        <Badge variant={team.tasksOpen > 5 || team.inactive > 0 ? 'warning' : 'muted'}>
                          {team.tasksOpen > 5 || team.inactive > 0 ? 'Attention' : 'Stable'}
                        </Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SignalRow icon={<ClipboardList size={14} />} label="Open tasks" value={String(team.tasksOpen)} />
                        <SignalRow icon={<ClipboardList size={14} />} label="Task completion" value={`${completionPct}%`} />
                        <SignalRow icon={<Image size={14} />} label="Missing photos" value={String(team.noPhoto)} />
                        <SignalRow icon={<Users size={14} />} label="Inactive users" value={String(team.inactive)} />
                      </div>
                      <ProgressBar pct={completionPct} tone={completionPct >= 70 ? 'success' : 'warning'} />
                    </section>

                    <section className="mt-auto grid gap-3 sm:grid-cols-3">
                      <ContentTile label="Gallery" value={String(team.galleryPhotos)} icon={<Image size={14} />} />
                      <ContentTile label="Admin Uploads" value={String(team.adminPhotos)} icon={<Image size={14} />} />
                      <ContentTile label="Posts" value={String(team.announcements)} icon={<Megaphone size={14} />} />
                    </section>
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

function SummaryMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      tone === 'success' && 'border-success/20 bg-success/8',
      tone === 'warning' && 'border-warning/20 bg-warning/8',
      tone === 'default' && 'border-border bg-bg-primary/70'
    )}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-text-primary">{value}</div>
    </div>
  )
}

function InsightPanel({
  icon,
  label,
  value,
  helper,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  helper: string
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-bg-primary/60 p-3.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-lg border border-accent/15 bg-accent/10 p-2 text-accent">
          {icon}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-6 text-text-secondary">{helper}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function SignalRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-3 py-3">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="text-accent">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-text-primary">{value}</p>
    </div>
  )
}

function ProgressBar({ pct, tone }: { pct: number; tone: 'success' | 'warning' }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            tone === 'success' ? 'bg-success' : 'bg-warning'
          )}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}

function ContentTile({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/60 px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
        <span className="text-accent">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  )
}
