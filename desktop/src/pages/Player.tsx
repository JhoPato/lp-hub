import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Flame, Megaphone, Target } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { hubService, type AnnouncementItem, type HubGoal, type HubScheduleEvent, type HubTask, type TodayProgress } from '@/services/hubService'
import { useAuthStore } from '@/stores/authStore'
import { buildEventDate, formatDateTime, isDueToday, isOverdue, timeFromNow } from '@/lib/hubDates'
import { cn } from '@/lib/utils'

interface PlayerDashboardState {
  announcements: AnnouncementItem[]
  tasks: HubTask[]
  events: HubScheduleEvent[]
  goals: HubGoal[]
  today: TodayProgress | null
}

export default function Player() {
  const user = useAuthStore((state) => state.user)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [state, setState] = useState<PlayerDashboardState>({
    announcements: [],
    tasks: [],
    events: [],
    goals: [],
    today: null,
  })

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const from = new Date()
      const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const [announcementsResult, pendingTasksResult, progressTasksResult, eventsResult, goalsResult, todayResult] =
        await Promise.allSettled([
          hubService.getAnnouncements(30),
          hubService.getTasks({ status: 'pending', limit: 20 }),
          hubService.getTasks({ status: 'in_progress', limit: 20 }),
          hubService.getSchedule(from.toISOString(), to.toISOString()),
          hubService.getGoals(),
          hubService.getTodayProgress(),
        ])

      if (!active) return

      if (
        announcementsResult.status === 'rejected' ||
        eventsResult.status === 'rejected' ||
        goalsResult.status === 'rejected'
      ) {
        setError('Some player data could not be loaded. The rest of the dashboard is still live.')
      }

      setState({
        announcements: announcementsResult.status === 'fulfilled' ? announcementsResult.value : [],
        tasks: [
          ...(pendingTasksResult.status === 'fulfilled' ? pendingTasksResult.value.tasks : []),
          ...(progressTasksResult.status === 'fulfilled' ? progressTasksResult.value.tasks : []),
        ],
        events: eventsResult.status === 'fulfilled' ? eventsResult.value : [],
        goals: goalsResult.status === 'fulfilled' ? goalsResult.value : [],
        today: todayResult.status === 'fulfilled' ? todayResult.value : null,
      })
      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [])

  const pinnedAnnouncements = useMemo(
    () => state.announcements.filter((announcement) => announcement.isPinned).slice(0, 3),
    [state.announcements]
  )

  const nextEvent = state.events[0]
  const laterEvents = state.events.slice(1, 5)

  const goal = useMemo(() => {
    const playerId = user?._id || user?.id
    return (
      state.goals.find((item) => item.playerId === String(playerId)) ||
      state.goals.find((item) => item.playerId === 'all') ||
      null
    )
  }, [state.goals, user?._id, user?.id])

  const rankedGoal = Math.max(0, (goal?.minRanked ?? 0) + (goal?.playerRankedAdjust ?? 0))
  const dmGoal = Math.max(0, (goal?.minDM ?? 0) + (goal?.playerDMAdjust ?? 0))
  const rankedDone = state.today?.ranked ?? 0
  const dmDone = state.today?.dm ?? 0

  return (
    <PageWrapper title="Player">
      <div className="flex w-full flex-col gap-6">
        {nextEvent && (
          <Card className="border-accent/25 bg-gradient-to-br from-accent/10 via-bg-tertiary to-bg-tertiary">
            <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-accent">Next Event</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{nextEvent.title}</p>
                <p className="mt-2 text-sm text-text-secondary">
                  {formatDateTime(buildEventDate(nextEvent))} · {timeFromNow(buildEventDate(nextEvent))}
                  {nextEvent.opponent ? ` · vs ${nextEvent.opponent}` : ''}
                </p>
              </div>
              <Badge variant={nextEvent.type === 'tournament' ? 'warning' : nextEvent.type === 'pracc' ? 'default' : 'muted'}>
                {nextEvent.type}
              </Badge>
            </CardBody>
          </Card>
        )}

        {error && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {error}
          </div>
        )}

        {goal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target size={18} className="text-accent" />
                Today's Training Goals
              </CardTitle>
              <CardDescription>
                {state.today?.hasRiotId
                  ? 'Live progress from your connected Riot account.'
                  : 'Connect a Riot ID in your profile to track this automatically.'}
              </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <GoalProgress label="Ranked" value={rankedDone} target={rankedGoal} />
              <GoalProgress label="Deathmatch" value={dmDone} target={dmGoal} accent="bg-warning" />
            </CardBody>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone size={18} className="text-accent" />
                Pinned Announcements
              </CardTitle>
              <CardDescription>Important team updates that stay on top.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                ))
              ) : pinnedAnnouncements.length === 0 ? (
                <EmptyState message="No pinned announcements right now." />
              ) : (
                pinnedAnnouncements.map((announcement) => (
                  <div key={announcement._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                    <p className="font-medium text-text-primary">{announcement.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{announcement.body}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame size={18} className="text-accent" />
                My Tasks
              </CardTitle>
              <CardDescription>Open assignments and anything due soon.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                ))
              ) : state.tasks.length === 0 ? (
                <EmptyState message="No open tasks assigned right now." />
              ) : (
                state.tasks.slice(0, 6).map((task) => {
                  const urgent = isOverdue(task.dueDate) || isDueToday(task.dueDate)
                  return (
                    <div
                      key={task._id}
                      className={cn(
                        'rounded-lg border border-border bg-bg-secondary px-4 py-3',
                        urgent && 'border-danger/30 bg-danger/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary">{task.title}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {task.dueDate
                              ? isOverdue(task.dueDate)
                                ? 'Overdue'
                                : isDueToday(task.dueDate)
                                  ? 'Due today'
                                  : `Due ${timeFromNow(task.dueDate)}`
                              : 'No due date'}
                          </p>
                        </div>
                        <Badge variant={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'muted'}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays size={18} className="text-accent" />
              Upcoming Events
            </CardTitle>
            <CardDescription>The rest of the schedule after your next event.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
              ))
            ) : laterEvents.length === 0 ? (
              <EmptyState message="No additional events scheduled." />
            ) : (
              laterEvents.map((event) => {
                const eventDate = buildEventDate(event)
                return (
                  <div key={`${event._id}-${event.date}`} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{event.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {formatDateTime(eventDate)} · {timeFromNow(eventDate)}
                        </p>
                      </div>
                      <Badge variant={event.type === 'tournament' ? 'warning' : event.type === 'pracc' ? 'default' : 'muted'}>
                        {event.type}
                      </Badge>
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

function GoalProgress({
  label,
  value,
  target,
  accent = 'bg-accent',
}: {
  label: string
  value: number
  target: number
  accent?: string
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 100

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{value}</span> / {target}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-primary">
        <div className={cn('h-full rounded-full transition-all', accent)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
      {message}
    </div>
  )
}
