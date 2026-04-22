import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useWorkspaceArea } from '@/hooks/useWorkspaceArea'
import { workspaceService, type WorkspaceScheduleEvent } from '@/services/workspaceService'
import { buildEventDate, formatDateTime, timeFromNow } from '@/lib/hubDates'

const initialForm = {
  type: 'pracc',
  title: '',
  date: '',
  startTime: '20:00',
  endTime: '22:00',
  notes: '',
  opponent: '',
  streamUrl: '',
}

export default function SchedulePage() {
  const { canLeadWorkspace, canManageWorkspace } = useWorkspaceArea()
  const canCreate = canLeadWorkspace
  const canDelete = canManageWorkspace
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [events, setEvents] = useState<WorkspaceScheduleEvent[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    const from = new Date()
    const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    try {
      setEvents(await workspaceService.getSchedule(from.toISOString(), to.toISOString()))
    } catch {
      setError('Schedule could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function createEvent() {
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    try {
      const created = await workspaceService.createScheduleEvent({
        type: form.type,
        title: form.title,
        notes: form.notes,
        startTime: form.startTime,
        endTime: form.endTime,
        isRecurring: false,
        dates: [form.date],
        opponent: form.opponent,
        streamUrl: form.streamUrl,
      })
      setEvents((current) => [...current, { ...created, date: form.date }].sort((a, b) => +new Date(a.date) - +new Date(b.date)))
      setEditorOpen(false)
      setForm(initialForm)
    } catch {
      setError('The event could not be created.')
    } finally {
      setSaving(false)
    }
  }

  async function removeEvent(id: string) {
    if (!confirm('Delete this schedule event?')) return
    setBusyId(id)
    try {
      await workspaceService.deleteScheduleEvent(id)
      setEvents((current) => current.filter((event) => event._id !== id))
    } catch {
      setError('The event could not be deleted.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <PageWrapper title="Schedule">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Team Calendar</h2>
            <p className="mt-1 text-sm text-text-secondary">Upcoming scrims, tournaments and warmup blocks.</p>
          </div>
          {canCreate && (
            <Button onClick={() => setEditorOpen(true)}>
              <Plus size={14} /> Add event
            </Button>
          )}
        </div>

        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays size={18} className="text-accent" />Upcoming</CardTitle>
            <CardDescription>Next thirty days for the current team.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
            ) : events.length === 0 ? (
              <EmptyState message="No events scheduled yet." />
            ) : (
              events.map((event) => {
                const eventDate = buildEventDate(event)
                return (
                  <div key={`${event._id}-${event.date}`} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-text-primary">{event.title}</p>
                          <Badge variant={event.type === 'tournament' ? 'warning' : event.type === 'pracc' ? 'default' : 'muted'}>{event.type}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">{formatDateTime(eventDate)} | {timeFromNow(eventDate)}</p>
                        {(event.opponent || event.notes) && (
                          <p className="mt-2 text-sm text-text-secondary">{[event.opponent && `vs ${event.opponent}`, event.notes].filter(Boolean).join(' | ')}</p>
                        )}
                      </div>
                      {canDelete && (
                        <button onClick={() => void removeEvent(event._id)} disabled={busyId === event._id} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title="Add schedule event" className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <SelectField label="Type" value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value }))} options={[
              ['pracc', 'Pracc'],
              ['tournament', 'Tournament'],
              ['warmup', 'Warmup'],
              ['other', 'Other'],
            ]} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Date" type="date" value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} />
            <Field label="Start" type="time" value={form.startTime} onChange={(value) => setForm((current) => ({ ...current, startTime: value }))} />
            <Field label="End" type="time" value={form.endTime} onChange={(value) => setForm((current) => ({ ...current, endTime: value }))} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Opponent" value={form.opponent} onChange={(value) => setForm((current) => ({ ...current, opponent: value }))} />
            <Field label="Stream URL" value={form.streamUrl} onChange={(value) => setForm((current) => ({ ...current, streamUrl: value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void createEvent()} disabled={!form.title.trim() || !form.date}>Save</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
