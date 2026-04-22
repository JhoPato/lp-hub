import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useWorkspaceArea } from '@/hooks/useWorkspaceArea'
import { workspaceService, type WorkspacePlayer, type WorkspaceTask } from '@/services/workspaceService'
import { isDueToday, isOverdue, timeFromNow } from '@/lib/hubDates'
import { cn } from '@/lib/utils'

const initialForm = {
  title: '',
  description: '',
  category: 'general',
  priority: 'medium',
  dueDate: '',
  requiresUpload: false,
  assignedTo: [] as string[],
}

export default function Tasks() {
  const { canManageWorkspace } = useWorkspaceArea()
  const canManage = canManageWorkspace
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [players, setPlayers] = useState<WorkspacePlayer[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceTask | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    void load()
  }, [canManage])

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'completed'), [tasks])
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === 'completed'), [tasks])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [tasksResult, playersResult] = await Promise.allSettled([
        workspaceService.getTasks({ limit: 80 }),
        canManage ? workspaceService.getPlayers() : Promise.resolve([] as WorkspacePlayer[]),
      ])
      if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value.tasks)
      else setError('Tasks could not be loaded.')
      if (playersResult.status === 'fulfilled') setPlayers(playersResult.value)
    } finally {
      setLoading(false)
    }
  }

  function openEditor(task?: WorkspaceTask) {
    setEditing(task ?? null)
    setForm(task ? {
      title: task.title,
      description: task.description ?? '',
      category: task.category,
      priority: task.priority,
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
      requiresUpload: Boolean(task.requiresUpload),
      assignedTo: (task.assignedTo ?? []).map((item) => item._id ?? '').filter(Boolean),
    } : initialForm)
    setEditorOpen(true)
  }

  async function saveTask() {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      dueDate: form.dueDate || null,
    }
    try {
      if (editing) {
        const updated = await workspaceService.updateTask(editing._id, payload)
        setTasks((current) => current.map((task) => (task._id === updated._id ? { ...task, ...updated } : task)))
      } else {
        const created = await workspaceService.createTask(payload)
        setTasks((current) => [created, ...current])
      }
      setEditorOpen(false)
      setEditing(null)
      setForm(initialForm)
    } catch {
      setError('The task could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(task: WorkspaceTask, status: WorkspaceTask['status']) {
    setBusyId(task._id)
    try {
      const updated = await workspaceService.updateTaskStatus(task._id, status)
      setTasks((current) => current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)))
    } catch {
      setError('Task status could not be updated.')
    } finally {
      setBusyId('')
    }
  }

  async function removeTask(id: string) {
    if (!confirm('Delete this task?')) return
    setBusyId(id)
    try {
      await workspaceService.deleteTask(id)
      setTasks((current) => current.filter((task) => task._id !== id))
    } catch {
      setError('The task could not be deleted.')
    } finally {
      setBusyId('')
    }
  }

  async function addComment(task: WorkspaceTask) {
    const text = (commentDrafts[task._id] || '').trim()
    if (!text) return
    setBusyId(task._id)
    try {
      const comment = await workspaceService.addTaskComment(task._id, text)
      setTasks((current) => current.map((item) => item._id === task._id ? { ...item, comments: [...(item.comments ?? []), comment] } : item))
      setCommentDrafts((current) => ({ ...current, [task._id]: '' }))
    } catch {
      setError('The comment could not be added.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <PageWrapper title="Tasks">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Task Board</h2>
            <p className="mt-1 text-sm text-text-secondary">Assignments, deadlines and quick status updates.</p>
          </div>
          {canManage && (
            <Button onClick={() => openEditor()}>
              <Plus size={14} /> New task
            </Button>
          )}
        </div>

        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList size={18} className="text-accent" />Open Work</CardTitle>
              <CardDescription>{openTasks.length} open tasks across the hub.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
              ) : openTasks.length === 0 ? (
                <EmptyState message="No open tasks right now." />
              ) : (
                openTasks.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    canManage={canManage}
                    busy={busyId === task._id}
                    commentDraft={commentDrafts[task._id] ?? ''}
                    onEdit={() => openEditor(task)}
                    onDelete={() => void removeTask(task._id)}
                    onStatusChange={(status) => void updateStatus(task, status)}
                    onCommentDraftChange={(value) => setCommentDrafts((current) => ({ ...current, [task._id]: value }))}
                    onAddComment={() => void addComment(task)}
                  />
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 size={18} className="text-accent" />Completed</CardTitle>
              <CardDescription>Recently closed tasks.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
              ) : doneTasks.length === 0 ? (
                <EmptyState message="Nothing completed yet." />
              ) : (
                doneTasks.slice(0, 6).map((task) => (
                  <div key={task._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{task.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">{task.assignedTo?.length ? task.assignedTo.map((item) => item.username).filter(Boolean).join(', ') : 'Team-wide task'}</p>
                      </div>
                      <Badge variant="success">Completed</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit task' : 'New task'} className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <Field label="Due date" value={form.dueDate} type="date" onChange={(value) => setForm((current) => ({ ...current, dueDate: value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={5}
              className="w-full resize-none rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value as typeof form.category }))} options={[
              ['general', 'General'],
              ['analysis', 'Analysis'],
              ['preparation', 'Preparation'],
              ['physical', 'Physical'],
              ['vod_review', 'VOD Review'],
            ]} />
            <SelectField label="Priority" value={form.priority} onChange={(value) => setForm((current) => ({ ...current, priority: value as typeof form.priority }))} options={[
              ['low', 'Low'],
              ['medium', 'Medium'],
              ['high', 'High'],
            ]} />
          </div>
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-widest text-text-muted">Assignees</label>
            <div className="grid gap-2 md:grid-cols-2">
              {players.map((player) => {
                const checked = form.assignedTo.includes(player._id)
                return (
                  <label key={player._id} className="flex items-center gap-2 rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        assignedTo: event.target.checked
                          ? [...current.assignedTo, player._id]
                          : current.assignedTo.filter((id) => id !== player._id),
                      }))}
                    />
                    {player.username}
                  </label>
                )
              })}
              {players.length === 0 && <div className="text-sm text-text-muted">No players loaded.</div>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.requiresUpload}
              onChange={(event) => setForm((current) => ({ ...current, requiresUpload: event.target.checked }))}
            />
            Requires file upload
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void saveTask()} disabled={!form.title.trim()}>Save</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function TaskCard({ task, canManage, busy, commentDraft, onEdit, onDelete, onStatusChange, onCommentDraftChange, onAddComment }: {
  task: WorkspaceTask
  canManage: boolean
  busy: boolean
  commentDraft: string
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: WorkspaceTask['status']) => void
  onCommentDraftChange: (value: string) => void
  onAddComment: () => void
}) {
  const urgent = isOverdue(task.dueDate) || isDueToday(task.dueDate)
  return (
    <div className={cn('rounded-lg border border-border bg-bg-secondary px-4 py-4', urgent && 'border-danger/30 bg-danger/5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-text-primary">{task.title}</p>
            <Badge variant={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'muted'}>{task.priority}</Badge>
            <Badge variant={task.status === 'in_progress' ? 'default' : 'muted'}>{task.status.replace('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{task.description || 'No extra notes yet.'}</p>
          <p className="mt-2 text-xs text-text-muted">
            {task.assignedTo?.length ? task.assignedTo.map((item) => item.username).filter(Boolean).join(', ') : 'Team-wide task'}
            {' | '}
            {task.dueDate ? (isOverdue(task.dueDate) ? 'Overdue' : isDueToday(task.dueDate) ? 'Due today' : `Due ${timeFromNow(task.dueDate)}`) : 'No due date'}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={onEdit} className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary"><Pencil size={14} /></button>
            <button onClick={onDelete} disabled={busy} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {task.status !== 'pending' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => onStatusChange('pending')}>Mark pending</Button>}
        {task.status !== 'in_progress' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => onStatusChange('in_progress')}>Start</Button>}
        {task.status !== 'completed' && <Button size="sm" disabled={busy} onClick={() => onStatusChange('completed')}>Complete</Button>}
      </div>
      <div className="mt-4 rounded-lg border border-border bg-bg-tertiary/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
          <MessageSquare size={13} /> Comments
        </div>
        <div className="space-y-2">
          {(task.comments ?? []).slice(-3).map((comment, index) => (
            <div key={`${comment.createdAt}-${index}`} className="rounded-md bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{comment.authorName || 'Team'}</span>
              <span className="text-text-muted"> | {comment.text}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentDraft}
              onChange={(event) => onCommentDraftChange(event.target.value)}
              placeholder="Add a quick update"
              className="flex-1 rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
            <Button size="sm" variant="secondary" disabled={busy || !commentDraft.trim()} onClick={onAddComment}>Post</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
