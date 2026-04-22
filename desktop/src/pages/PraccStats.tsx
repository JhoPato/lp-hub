import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Shield, Swords, Target } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { workspaceService, type WorkspacePraccPlayerStat, type WorkspacePraccStatsResponse } from '@/services/workspaceService'

export default function PraccStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<WorkspacePraccStatsResponse | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const mapBreakdown = useMemo(() => {
    const bucket = new Map<string, { matches: number; wins: number }>()
    for (const match of stats?.matches ?? []) {
      const key = match.mapName || 'Unknown map'
      const current = bucket.get(key) ?? { matches: 0, wins: 0 }
      current.matches += 1
      if (match.result === 'W') current.wins += 1
      bucket.set(key, current)
    }
    return Array.from(bucket.entries())
      .map(([mapName, value]) => ({ mapName, ...value, winRate: value.matches ? Math.round((value.wins / value.matches) * 100) : 0 }))
      .sort((a, b) => b.matches - a.matches)
  }, [stats])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setStats(await workspaceService.getPraccStats())
    } catch {
      setError('Pracc stats could not be loaded yet.')
    } finally {
      setLoading(false)
    }
  }

  const leader = stats?.playerStats?.[0] ?? null
  const wins = stats?.matches?.filter((match) => match.result === 'W').length ?? 0
  const total = stats?.total ?? 0
  const winRate = total ? Math.round((wins / total) * 100) : 0

  return (
    <PageWrapper title="Pracc Stats">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Swords} label="Matches" value={loading ? '--' : String(total)} />
          <StatCard icon={Shield} label="Win Rate" value={loading ? '--' : `${winRate}%`} />
          <StatCard icon={Target} label="Pistol WR" value={loading ? '--' : `${stats?.econStats?.pistolWR ?? 0}%`} />
          <StatCard icon={BarChart3} label="Top ACS" value={loading ? '--' : String(leader?.acs ?? 0)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Player Leaderboard</CardTitle>
              <CardDescription>Performance snapshot across imported praccs.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
              ) : !stats?.playerStats?.length ? (
                <EmptyState message="No player stats available yet." />
              ) : (
                stats.playerStats.slice(0, 8).map((player, index) => <PlayerRow key={`${player.gameName}#${player.tagLine}`} player={player} rank={index + 1} />)
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Economy Overview</CardTitle>
              <CardDescription>Round classes from recorded pracc history.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-3">
              <EconRow label="Pistols" played={stats?.econStats?.pistolPlayed ?? 0} won={stats?.econStats?.pistolWon ?? 0} wr={stats?.econStats?.pistolWR} />
              <EconRow label="Bonus" played={stats?.econStats?.bonusPlayed ?? 0} won={stats?.econStats?.bonusWon ?? 0} wr={stats?.econStats?.bonusWR} />
              <EconRow label="Eco" played={stats?.econStats?.ecoPlayed ?? 0} won={stats?.econStats?.ecoWon ?? 0} wr={stats?.econStats?.ecoWR} />
              <EconRow label="Half-buy" played={stats?.econStats?.halfBuyPlayed ?? 0} won={stats?.econStats?.halfBuyWon ?? 0} wr={stats?.econStats?.halfBuyWR} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Map Breakdown</CardTitle>
            <CardDescription>How the team is trending across the current map pool.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
            ) : mapBreakdown.length === 0 ? (
              <EmptyState message="No map data available yet." />
            ) : (
              mapBreakdown.map((map) => (
                <div key={map.mapName} className="rounded-lg border border-border bg-bg-secondary px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{map.mapName}</p>
                      <p className="mt-1 text-sm text-text-secondary">{map.matches} match{map.matches === 1 ? '' : 'es'}</p>
                    </div>
                    <Badge variant={map.winRate >= 50 ? 'success' : 'warning'}>{map.winRate}% WR</Badge>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-primary">
                    <div className={`h-full rounded-full ${map.winRate >= 50 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${Math.min(100, map.winRate)}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
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

function PlayerRow({ player, rank }: { player: WorkspacePraccPlayerStat; rank: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="muted">#{rank}</Badge>
            <p className="font-medium text-text-primary">{player.gameName}#{player.tagLine}</p>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            ACS {player.acs} | KD {player.kd} | HS {player.headshotPercent}% | KAST {player.kastPercent}%
          </p>
          <p className="mt-1 text-xs text-text-muted">{player.matchCount} matches tracked</p>
        </div>
        <div className="text-right text-xs text-text-muted">
          <div>{player.kills} / {player.deaths} / {player.assists}</div>
          <div className="mt-1">Clutch {player.clutchRate}%</div>
        </div>
      </div>
    </div>
  )
}

function EconRow({ label, played, won, wr }: { label: string; played: number; won: number; wr: number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-text-primary">{label}</p>
          <p className="mt-1 text-sm text-text-secondary">{won} won / {played} played</p>
        </div>
        <Badge variant={typeof wr === 'number' && wr >= 50 ? 'success' : 'muted'}>{wr ?? 0}%</Badge>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
