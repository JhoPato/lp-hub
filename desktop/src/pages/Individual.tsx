import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Clock3, RefreshCcw, SkipForward, Users } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceArea } from '@/hooks/useWorkspaceArea'
import {
  workspaceService,
  type HenrikSyncStatus,
  type RankedStatsResponse,
  type TeamTodayPlayer,
  type TodayCounts,
  type TrainingStatsResponse,
  type WorkspacePlayer,
} from '@/services/workspaceService'

export default function Individual() {
  const user = useAuthStore((state) => state.user)
  const { canLeadWorkspace } = useWorkspaceArea()
  const [error, setError] = useState('')
  const [players, setPlayers] = useState<WorkspacePlayer[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [today, setToday] = useState<TodayCounts | null>(null)
  const [ranked, setRanked] = useState<RankedStatsResponse | null>(null)
  const [training, setTraining] = useState<TrainingStatsResponse | null>(null)
  const [teamToday, setTeamToday] = useState<TeamTodayPlayer[]>([])
  const [syncStatus, setSyncStatus] = useState<HenrikSyncStatus | null>(null)
  const [busyAction, setBusyAction] = useState('')

  useEffect(() => {
    void loadPlayersAndData()
  }, [canLeadWorkspace])

  useEffect(() => {
    if (!selectedUserId && canLeadWorkspace && players.length > 0) {
      setSelectedUserId(players.find((player) => player.role !== 'manager')?._id ?? players[0]._id)
    }
  }, [canLeadWorkspace, players, selectedUserId])

  useEffect(() => {
    if (!canLeadWorkspace || selectedUserId) {
      void loadMetrics(selectedUserId)
    }
  }, [canLeadWorkspace, selectedUserId])

  const selectedPlayer = useMemo(() => {
    if (!selectedUserId) return null
    return players.find((player) => player._id === selectedUserId) ?? null
  }, [players, selectedUserId])

  async function loadPlayersAndData() {
    setError('')
    try {
      if (canLeadWorkspace) {
        const [playersData, teamTodayData, syncData] = await Promise.all([
          workspaceService.getPlayers(),
          workspaceService.getTeamTodayProgress(),
          workspaceService.getHenrikSyncStatus(),
        ])
        setPlayers(playersData.filter((player) => ['player', 'captain'].includes(player.role)))
        setTeamToday(teamTodayData.players)
        setSyncStatus(syncData)
      }
    } catch {
      setError('Some individual performance data could not be loaded.')
    }
  }

  async function loadMetrics(userId?: string | null) {
    try {
      const paramsUserId = canLeadWorkspace ? userId ?? undefined : undefined
      const [todayData, rankedData, trainingData] = await Promise.all([
        workspaceService.getTodayProgress(paramsUserId),
        workspaceService.getRankedStats(paramsUserId),
        workspaceService.getTrainingStats(paramsUserId),
      ])
      setToday(todayData)
      setRanked(rankedData)
      setTraining(trainingData)
    } catch {
      setToday(null)
      setRanked(null)
      setTraining(null)
      setError('The selected player does not have complete Riot tracking data yet.')
    }
  }

  async function runSync() {
    setBusyAction('sync')
    try {
      await workspaceService.runHenrikSync()
      setSyncStatus(await workspaceService.getHenrikSyncStatus())
    } catch {
      setError('Sync could not be started.')
    } finally {
      setBusyAction('')
    }
  }

  async function skipWait() {
    setBusyAction('skip')
    try {
      await workspaceService.skipHenrikWait()
      setSyncStatus(await workspaceService.getHenrikSyncStatus())
    } catch {
      setError('The current sync wait could not be skipped.')
    } finally {
      setBusyAction('')
    }
  }

  async function refreshTeamData() {
    setBusyAction('refresh')
    try {
      if (canLeadWorkspace) {
        const [teamTodayData, syncData] = await Promise.all([
          workspaceService.getTeamTodayProgress(),
          workspaceService.getHenrikSyncStatus(),
        ])
        setTeamToday(teamTodayData.players)
        setSyncStatus(syncData)
      }
      await loadMetrics(selectedUserId)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <PageWrapper title="Individual">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        {canLeadWorkspace && (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users size={18} className="text-accent" />Player focus</CardTitle>
                <CardDescription>Switch between roster members to inspect their current metrics.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4">
                <select value={selectedUserId ?? ''} onChange={(event) => setSelectedUserId(event.target.value)} className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
                  {players.map((player) => <option key={player._id} value={player._id}>{player.username}</option>)}
                </select>
                <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <p className="font-medium text-text-primary">{selectedPlayer?.username || 'No player selected'}</p>
                  <p className="mt-1 text-sm text-text-secondary">{selectedPlayer?.riotGameName ? `${selectedPlayer.riotGameName}#${selectedPlayer.riotTagLine || ''}` : 'Riot ID not configured'}</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock3 size={18} className="text-accent" />Henrik sync</CardTitle>
                <CardDescription>Captain and manager controls for the shared match-sync queue.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <p className="font-medium text-text-primary">Queue state</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Running: {syncStatus?.running ? 'yes' : 'no'} | Queue: {syncStatus?.queueLength ?? 0} | Waiting: {syncStatus?.waiting ? 'yes' : 'no'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void refreshTeamData()} variant="secondary" loading={busyAction === 'refresh'}><RefreshCcw size={14} /> Refresh</Button>
                  <Button onClick={() => void runSync()} loading={busyAction === 'sync'}><Activity size={14} /> Run sync</Button>
                  <Button onClick={() => void skipWait()} variant="secondary" loading={busyAction === 'skip'}><SkipForward size={14} /> Skip wait</Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Ranked today" value={String(today?.ranked ?? 0)} />
          <Metric label="DM today" value={String(today?.dm ?? 0)} />
          <Metric label="Tracked matches" value={String(ranked?.count ?? 0)} />
          <Metric label="Avg kills" value={String(training?.avgKills ?? 0)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Ranked overview</CardTitle>
              <CardDescription>Recent ranked snapshot for the selected player.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="rounded-lg border border-border bg-bg-secondary px-4 py-4">
                <p className="font-medium text-text-primary">{ranked?.riot?.gameName ? `${ranked.riot.gameName}#${ranked.riot.tagLine}` : selectedPlayer?.username || user?.username}</p>
                <p className="mt-2 text-sm text-text-secondary">
                  ACS {ranked?.acs ?? 0} | KD {ranked?.kd ?? 0} | HS {ranked?.hsPercent ?? 0}% | WR {ranked?.winRate ?? 0}%
                </p>
              </div>
              {(ranked?.matches ?? []).slice(0, 6).map((match, index) => (
                <div key={`${match.date}-${index}`} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{match.date ? new Date(match.date).toLocaleDateString() : 'Unknown date'}</p>
                      <p className="mt-1 text-sm text-text-secondary">ACS {match.acs ?? 0} | KD {match.kd ?? 0} | HS {match.hsPercent ?? 0}%</p>
                    </div>
                    <Badge variant={match.won ? 'success' : 'muted'}>{match.won ? 'Win' : 'Loss'}</Badge>
                  </div>
                </div>
              ))}
              {!ranked?.matches?.length && <EmptyState message="No ranked matches available yet." />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Training streak</CardTitle>
              <CardDescription>Recent daily DM and TDM volume.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {(training?.days ?? []).slice(-7).reverse().map((day) => (
                <div key={day.date} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{new Date(day.date).toLocaleDateString()}</p>
                      <p className="mt-1 text-sm text-text-secondary">DM {day.dm} | TDM {day.tdm} | Kills {day.kills}</p>
                    </div>
                    <Badge variant={(day.dm + day.tdm) > 0 ? 'success' : 'muted'}>{day.dm + day.tdm} games</Badge>
                  </div>
                </div>
              ))}
              {!training?.days?.length && <EmptyState message="No training data available yet." />}
            </CardBody>
          </Card>
        </div>

        {canLeadWorkspace && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-accent" />Team today</CardTitle>
              <CardDescription>Quick glance at today's roster activity.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teamToday.map((player) => (
                <div key={player.userId} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{player.username}</p>
                      <p className="mt-1 text-sm text-text-secondary">Ranked {player.ranked} | DM {player.dm}</p>
                    </div>
                    <Badge variant={player.hasRiotId ? 'success' : 'muted'}>{player.hasRiotId ? 'Tracked' : 'Missing Riot'}</Badge>
                  </div>
                </div>
              ))}
              {!teamToday.length && <EmptyState message="No team-wide progress data available." />}
            </CardBody>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
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
