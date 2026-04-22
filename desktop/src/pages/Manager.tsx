import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, Megaphone, ShieldAlert, Users } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { hubService, type AnnouncementItem, type HubScheduleEvent, type HubTask } from '@/services/hubService'
import { buildEventDate, formatDateTime, timeFromNow } from '@/lib/hubDates'

interface ManagerDashboardState {
  players: number
  praccs: number
  events: HubScheduleEvent[]
  announcements: AnnouncementItem[]
  tasks: HubTask[]
}

export default function Manager() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [state, setState] = useState<ManagerDashboardState>({
    players: 0,
    praccs: 0,
    events: [],
    announcements: [],
    tasks: [],
  })

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const now = new Date()
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const [playersResult, praccsResult, eventsResult, announcementsResult, pendingTasksResult, progressTasksResult] =
        await Promise.allSettled([
          hubService.getPlayers(),
          hubService.getPraccMatches(1),
          hubService.getSchedule(now.toISOString(), nextWeek.toISOString()),
          hubService.getAnnouncements(4),
          hubService.getTasks({ status: 'pending', limit: 50 }),
          hubService.getTasks({ status: 'in_progress', limit: 50 }),
        ])

      if (!active) return

      if (
        playersResult.status === 'rejected' ||
        eventsResult.status === 'rejected' ||
        announcementsResult.status === 'rejected'
      ) {
        setError('Some manager data could not be loaded. The dashboard is showing what is available.')
      }

      const tasks = [
        ...(pendingTasksResult.status === 'fulfilled' ? pendingTasksResult.value.tasks : []),
        ...(progressTasksResult.status === 'fulfilled' ? progressTasksResult.value.tasks : []),
      ]

      setState({
        players: playersResult.status === 'fulfilled' ? playersResult.value.length : 0,
        praccs: praccsResult.status === 'fulfilled' ? praccsResult.value.total ?? 0 : 0,
        events: eventsResult.status === 'fulfilled' ? eventsResult.value : [],
        announcements: announcementsResult.status === 'fulfilled' ? announcementsResult.value : [],
        tasks,
      })
      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [])

  const stats = useMemo(() => {
    const openTasks = state.tasks.length
    return [
      { label: 'Players', value: state.players, icon: Users },
      { label: 'Open Tasks', value: openTasks, icon: ClipboardList },
      { label: 'Events (7d)', value: state.events.length, icon: CalendarDays },
      { label: 'Praccs Logged', value: state.praccs, icon: ShieldAlert },
    ]
  }, [state.events.length, state.players, state.praccs, state.tasks.length])

  return (
    <PageWrapper title="Manager">
      <div className="flex w-full flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardBody className="flex items-center gap-4">
                <div className="rounded-lg border border-accent/20 bg-accent/10 p-3 text-accent">
                  <stat.icon size={18} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-text-primary">{loading ? '--' : stat.value}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{stat.label}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays size={18} className="text-accent" />
                Upcoming Events
              </CardTitle>
              <CardDescription>Next seven days for the active hub.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                ))
              ) : state.events.length === 0 ? (
                <EmptyState message="No events scheduled this week." />
              ) : (
                state.events.slice(0, 4).map((event) => {
                  const eventDate = buildEventDate(event)
                  return (
                    <div key={`${event._id}-${event.date}`} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-text-primary">{event.title}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {formatDateTime(eventDate)} · {timeFromNow(eventDate)}
                          </p>
                          {event.opponent && (
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-text-muted">
                              vs {event.opponent}
                            </p>
                          )}
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone size={18} className="text-accent" />
                Latest Announcements
              </CardTitle>
              <CardDescription>Team communication at a glance.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                ))
              ) : state.announcements.length === 0 ? (
                <EmptyState message="No announcements yet." />
              ) : (
                state.announcements.map((announcement) => (
                  <div key={announcement._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">{announcement.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                          {announcement.body}
                        </p>
                      </div>
                      {announcement.isPinned && <Badge variant="warning">Pinned</Badge>}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList size={18} className="text-accent" />
              Open Tasks
            </CardTitle>
            <CardDescription>Pending and in-progress work across the hub.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
              ))
            ) : state.tasks.length === 0 ? (
              <EmptyState message="No open tasks right now." />
            ) : (
              state.tasks.slice(0, 6).map((task) => (
                <div key={task._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{task.title}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {task.assignedTo?.length
                          ? task.assignedTo.map((assignee) => assignee.username || 'Team').join(', ')
                          : 'Team-wide task'}
                        {' · '}
                        {task.dueDate ? `Due ${timeFromNow(task.dueDate)}` : 'No due date'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'muted'}>
                        {task.priority}
                      </Badge>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
      {message}
    </div>
  )
}
