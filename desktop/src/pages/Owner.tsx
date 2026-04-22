import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Cloud,
  Database,
  FolderKanban,
  Image,
  Link2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { adminService, type AdminStats, type AdminStorage } from '@/services/adminService'
import { siteService, type RosterTeam } from '@/services/siteService'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS = [
  {
    title: 'Manage Teams',
    description: 'Create teams, keep tags aligned and adjust structure.',
    to: '/owner/teams',
    icon: <Users size={18} />,
  },
  {
    title: 'Review Managers',
    description: 'Check active leadership and team assignments.',
    to: '/owner/managers',
    icon: <ShieldCheck size={18} />,
  },
  {
    title: 'Publish News',
    description: 'Ship updates and featured posts to the public surface.',
    to: '/owner/news',
    icon: <Megaphone size={18} />,
  },
  {
    title: 'Open Assets',
    description: 'Handle logos, gallery items and website media blocks.',
    to: '/owner/gallery',
    icon: <Image size={18} />,
  },
  {
    title: 'Website Content',
    description: 'Update staff, creators, trophies and branded content.',
    to: '/owner/staff',
    icon: <FolderKanban size={18} />,
  },
  {
    title: 'Edit Rosters',
    description: 'Manage public team rosters and sync them with the HUB.',
    to: '/owner/rosters',
    icon: <Users size={18} />,
  },
  {
    title: 'Invite Access',
    description: 'Track code usage and issue new access safely.',
    to: '/owner/invites',
    icon: <Link2 size={18} />,
  },
]

export default function Owner() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [storage, setStorage] = useState<AdminStorage | null>(null)
  const [rosters, setRosters] = useState<RosterTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([adminService.getStats(), adminService.getStorage(), siteService.getAllRosters()])
      .then(([statsResult, storageResult, rosterResult]) => {
        if (statsResult.status === 'fulfilled') setStats(statsResult.value)
        if (storageResult.status === 'fulfilled') setStorage(storageResult.value)
        if (rosterResult.status === 'fulfilled') setRosters(rosterResult.value)
      })
      .finally(() => setLoading(false))
  }, [])

  const inviteHealth = useMemo(() => {
    const total = (stats?.inviteActive ?? 0) + (stats?.inviteUsed ?? 0) + (stats?.inviteExpired ?? 0)
    const healthyPct = total
      ? Math.round((((stats?.inviteActive ?? 0) + (stats?.inviteUsed ?? 0)) / total) * 100)
      : 0
    return { total, healthyPct }
  }, [stats])

  const orgDensity = useMemo(() => {
    const teams = stats?.teamCount ?? 0
    const users = stats?.totalUsers ?? 0
    return teams > 0 ? (users / teams).toFixed(1) : '0.0'
  }, [stats])

  const contentLoad = useMemo(() => {
    return (stats?.photoCount ?? 0) + (stats?.adminPhotoCount ?? 0) + (stats?.praccCount ?? 0)
  }, [stats])

  const rosterHealth = useMemo(() => {
    const linked = rosters.filter((team) => team.lpApiTeam?.region != null && team.lpApiTeam?.teamIndex != null).length
    const synced = rosters.filter((team) => Boolean(team.websiteRoster?.lastSynced)).length
    const withRoster = rosters.filter((team) => (team.websiteRoster?.players?.length || 0) + (team.websiteRoster?.coaches?.length || 0) > 0).length

    return {
      total: rosters.length,
      linked,
      synced,
      withRoster,
    }
  }, [rosters])

  return (
    <PageWrapper title="Owner Dashboard">
      <div className="flex w-full flex-col gap-6">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-accent/20 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]"
        >
          <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-accent">
                <Sparkles size={14} />
                Owner Control Center
              </div>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-text-primary">
                A cleaner operational view for the whole LP Hub ecosystem.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                Welcome back, {user?.username}. This dashboard is now oriented around decisions and platform health instead of mirroring the public website structure.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <HeroMetric label="Teams" value={stats?.teamCount} loading={loading} />
                <HeroMetric label="Total Users" value={stats?.totalUsers} loading={loading} />
                <HeroMetric label="Users / Team" value={orgDensity} loading={loading} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <InsightCard
                label="Access Health"
                value={loading ? '--' : `${inviteHealth.healthyPct}%`}
                helper={
                  loading
                    ? 'Checking codes...'
                    : `${stats?.inviteUsed ?? 0} used, ${stats?.inviteActive ?? 0} active, ${stats?.inviteExpired ?? 0} expired across ${inviteHealth.total} tracked invites`
                }
                tone="accent"
              />
              <InsightCard
                label="Content Footprint"
                value={loading ? '--' : String(contentLoad)}
                helper={loading ? 'Loading content stats...' : `${stats?.photoCount ?? 0} gallery items, ${stats?.adminPhotoCount ?? 0} admin uploads, ${stats?.praccCount ?? 0} pracc entries`}
                tone="neutral"
              />
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common owner flows that make more sense in an app shell.</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group rounded-xl border border-border bg-bg-secondary p-4 transition-colors hover:border-accent/35 hover:bg-bg-tertiary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-lg border border-accent/15 bg-accent/10 p-3 text-accent">
                        {action.icon}
                      </div>
                      <ArrowRight size={16} className="mt-1 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </div>
                    <p className="mt-4 font-medium text-text-primary">{action.title}</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{action.description}</p>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational Snapshot</CardTitle>
              <CardDescription>A compact read on the current organisation mix.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <SnapshotRow label="Players" value={stats?.playerCount} loading={loading} variant="default" />
              <SnapshotRow label="Captains" value={stats?.captainCount} loading={loading} variant="warning" />
              <SnapshotRow label="Managers" value={stats?.managerCount} loading={loading} variant="success" />
              <SnapshotRow label="Active Invites" value={stats?.inviteActive} loading={loading} variant="default" />
              <SnapshotRow label="Expired Invites" value={stats?.inviteExpired} loading={loading} variant="danger" />
            </CardBody>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Website Roster Health</CardTitle>
                <CardDescription>Public roster coverage and LP sync readiness from the dashboard.</CardDescription>
              </div>
              <Link to="/owner/rosters" className="text-sm font-medium text-accent transition-colors hover:text-accent/80">
                Open editor
              </Link>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PulseCard label="Teams" value={rosterHealth.total} loading={loading} />
              <PulseCard label="Linked" value={rosterHealth.linked} loading={loading} />
              <PulseCard label="With Roster" value={rosterHealth.withRoster} loading={loading} />
              <PulseCard label="Synced" value={rosterHealth.synced} loading={loading} />
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Platform Health</CardTitle>
              <CardDescription>Storage and infrastructure pressure points.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : (
                <>
                  {storage?.cloudinary ? (
                    <StorageBar
                      label="Cloudinary"
                      icon={<Cloud size={16} />}
                      used={`${storage.cloudinary.usedMB} MB`}
                      limit={`${storage.cloudinary.limitGB} GB`}
                      pct={storage.cloudinary.pct}
                    />
                  ) : (
                    <MutedPanel message="Cloudinary storage data unavailable." />
                  )}

                  {storage?.mongo ? (
                    <StorageBar
                      label="MongoDB Atlas"
                      icon={<Database size={16} />}
                      used={`${storage.mongo.usedMB} MB`}
                      limit={`${storage.mongo.limitMB} MB`}
                      pct={storage.mongo.pct}
                    />
                  ) : (
                    <MutedPanel message="MongoDB storage data unavailable." />
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content and Access Pulse</CardTitle>
              <CardDescription>Small signals that help you spot imbalance quickly.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <PulseCard label="Gallery Photos" value={stats?.photoCount} loading={loading} />
              <PulseCard label="Admin Uploads" value={stats?.adminPhotoCount} loading={loading} />
              <PulseCard label="Pracc Entries" value={stats?.praccCount} loading={loading} />
              <PulseCard label="Invite Codes Used" value={stats?.inviteUsed} loading={loading} />
            </CardBody>
          </Card>
        </section>
      </div>
    </PageWrapper>
  )
}

function HeroMetric({ label, value, loading }: { label: string; value?: number | string; loading: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-4 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-3 text-3xl font-semibold text-text-primary">{value ?? '--'}</p>
      )}
    </div>
  )
}

function InsightCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone: 'accent' | 'neutral'
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      tone === 'accent' ? 'border-accent/25 bg-accent/8' : 'border-border bg-bg-secondary/80'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-text-primary">{value}</p>
        </div>
        <Badge variant={tone === 'accent' ? 'default' : 'muted'}>{label}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{helper}</p>
    </div>
  )
}

function SnapshotRow({
  label,
  value,
  loading,
  variant,
}: {
  label: string
  value?: number
  loading: boolean
  variant: 'default' | 'warning' | 'success' | 'danger'
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-bg-secondary px-4 py-3">
      <p className="text-sm text-text-secondary">{label}</p>
      {loading ? <Skeleton className="h-6 w-10" /> : <Badge variant={variant}>{value ?? 0}</Badge>}
    </div>
  )
}

function PulseCard({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-bg-secondary p-4"
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      {loading ? <Skeleton className="mt-4 h-8 w-14" /> : <p className="mt-4 text-3xl font-semibold text-text-primary">{value ?? 0}</p>}
    </motion.div>
  )
}

function StorageBar({
  label,
  icon,
  used,
  limit,
  pct,
}: {
  label: string
  icon: React.ReactNode
  used: string
  limit: string
  pct: number
}) {
  const barColor = pct > 80 ? 'bg-danger' : pct > 50 ? 'bg-warning' : 'bg-accent'

  return (
    <div className="rounded-xl border border-border bg-bg-secondary px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-xs text-text-muted">
          {used} / {limit} | {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-primary">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
    </div>
  )
}

function MutedPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
      {message}
    </div>
  )
}
