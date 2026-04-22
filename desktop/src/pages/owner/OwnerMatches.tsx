import { useEffect, useState } from 'react'
import { Calendar, Clock, Swords, Trophy } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { siteService, type ScheduleEvent } from '@/services/siteService'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<string, React.ReactNode> = {
  pracc: <Swords size={14} />,
  tournament: <Trophy size={14} />,
  warmup: <Clock size={14} />,
  other: <Calendar size={14} />,
}

const TYPE_COLOR: Record<string, string> = {
  pracc: 'text-accent',
  tournament: 'text-warning',
  warmup: 'text-success',
  other: 'text-text-muted',
}

function teamName(ev: ScheduleEvent): string {
  if (!ev.teamId) return '—'
  if (typeof ev.teamId === 'string') return ev.teamId
  return `${ev.teamId.name} [${ev.teamId.tag}]`
}

export default function OwnerMatches() {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pracc' | 'tournament'>('all')

  useEffect(() => {
    siteService.getPraccSchedule().then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  // Group by date
  const grouped = filtered.reduce<Record<string, ScheduleEvent[]>>((acc, ev) => {
    const d = new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!acc[d]) acc[d] = []
    acc[d].push(ev)
    return acc
  }, {})

  return (
    <PageWrapper title="Next Matches">
      <div className="w-full space-y-5">
        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'pracc', 'tournament'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                filter === f ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )}
            >
              {f}
            </button>
          ))}
          {!loading && <span className="ml-auto text-sm text-text-muted self-center">{filtered.length} events</span>}
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-text-muted">No upcoming events.</p>
        ) : (
          Object.entries(grouped).map(([date, evs]) => (
            <div key={date}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-text-muted border-b border-border pb-1.5">
                {date}
              </h3>
              <div className="flex flex-col gap-2">
                {evs.map((ev) => (
                  <div key={ev._id} className="flex items-center gap-4 rounded-lg border border-border bg-bg-tertiary px-4 py-3">
                    <span className={cn('shrink-0', TYPE_COLOR[ev.type] ?? 'text-text-muted')}>
                      {TYPE_ICON[ev.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{ev.title}</p>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>{teamName(ev)}</span>
                        {ev.opponent && <><span>·</span><span>vs {ev.opponent}</span></>}
                        {ev.notes && <><span>·</span><span className="truncate">{ev.notes}</span></>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-text-secondary">{ev.startTime} – {ev.endTime}</p>
                      <Badge variant="muted" className="mt-1">{ev.type}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </PageWrapper>
  )
}
