import { useEffect, useMemo, useState } from 'react'
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useWorkspaceArea } from '@/hooks/useWorkspaceArea'
import { workspaceService, type WorkspaceAnnouncement } from '@/services/workspaceService'

const initialForm = { title: '', body: '', isPinned: false }

export default function Announcements() {
  const { canManageWorkspace } = useWorkspaceArea()
  const canManage = canManageWorkspace
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<WorkspaceAnnouncement[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceAnnouncement | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    void load()
  }, [])

  const pinned = useMemo(() => items.filter((item) => item.isPinned), [items])
  const latest = useMemo(() => items.filter((item) => !item.isPinned), [items])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await workspaceService.getAnnouncements(40)
      setItems(data.items)
    } catch {
      setError('Announcements could not be loaded yet.')
    } finally {
      setLoading(false)
    }
  }

  function openEditor(item?: WorkspaceAnnouncement) {
    setEditing(item ?? null)
    setForm(item ? { title: item.title, body: item.body, isPinned: item.isPinned } : initialForm)
    setEditorOpen(true)
  }

  async function saveAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const updated = await workspaceService.updateAnnouncement(editing._id, { title: form.title, body: form.body })
        setItems((current) => current.map((item) => (item._id === updated._id ? { ...item, ...updated, isPinned: form.isPinned } : item)))
        if (editing.isPinned !== form.isPinned) {
          const toggled = await workspaceService.toggleAnnouncementPin(editing._id)
          setItems((current) => current.map((item) => (item._id === toggled._id ? toggled : item)))
        }
      } else {
        const created = await workspaceService.createAnnouncement(form)
        setItems((current) => [created, ...current])
      }
      setEditorOpen(false)
      setEditing(null)
      setForm(initialForm)
    } catch {
      setError('The announcement could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePin(item: WorkspaceAnnouncement) {
    setBusyId(item._id)
    try {
      const updated = await workspaceService.toggleAnnouncementPin(item._id)
      setItems((current) => current.map((entry) => (entry._id === updated._id ? updated : entry)))
    } catch {
      setError('The pin state could not be updated.')
    } finally {
      setBusyId('')
    }
  }

  async function removeAnnouncement(id: string) {
    if (!confirm('Delete this announcement?')) return
    setBusyId(id)
    try {
      await workspaceService.deleteAnnouncement(id)
      setItems((current) => current.filter((item) => item._id !== id))
    } catch {
      setError('The announcement could not be deleted.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <PageWrapper title="Announcements">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Team Broadcast</h2>
            <p className="mt-1 text-sm text-text-secondary">Pinned items stay on top for the whole roster.</p>
          </div>
          {canManage && (
            <Button onClick={() => openEditor()}>
              <Plus size={14} /> New announcement
            </Button>
          )}
        </div>

        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Pin size={18} className="text-accent" />Pinned</CardTitle>
              <CardDescription>Priority updates for the team.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
              ) : pinned.length === 0 ? (
                <EmptyState message="No pinned announcements right now." />
              ) : (
                pinned.map((item) => (
                  <AnnouncementCard
                    key={item._id}
                    item={item}
                    canManage={canManage}
                    busy={busyId === item._id}
                    onEdit={() => openEditor(item)}
                    onTogglePin={() => void togglePin(item)}
                    onDelete={() => void removeAnnouncement(item._id)}
                  />
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Megaphone size={18} className="text-accent" />Latest Updates</CardTitle>
              <CardDescription>Recent communication for everyone in the hub.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
              ) : items.length === 0 ? (
                <EmptyState message="No announcements yet." />
              ) : (
                [...pinned, ...latest].map((item) => (
                  <AnnouncementRow
                    key={item._id}
                    item={item}
                    canManage={canManage}
                    busy={busyId === item._id}
                    onEdit={() => openEditor(item)}
                    onTogglePin={() => void togglePin(item)}
                    onDelete={() => void removeAnnouncement(item._id)}
                  />
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit announcement' : 'New announcement'} className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Body</label>
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              rows={7}
              className="w-full resize-none rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))}
            />
            Pin this announcement
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void saveAnnouncement()} disabled={!form.title.trim() || !form.body.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function AnnouncementCard({ item, canManage, busy, onEdit, onTogglePin, onDelete }: {
  item: WorkspaceAnnouncement
  canManage: boolean
  busy: boolean
  onEdit: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text-primary">{item.title}</p>
            <Badge variant="warning">Pinned</Badge>
          </div>
          <p className="mt-2 text-sm text-text-secondary">{item.body}</p>
          <p className="mt-3 text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary"><Pencil size={14} /></button>
            <button onClick={onTogglePin} disabled={busy} className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-primary hover:text-accent"><Pin size={14} /></button>
            <button onClick={onDelete} disabled={busy} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function AnnouncementRow({ item, canManage, busy, onEdit, onTogglePin, onDelete }: {
  item: WorkspaceAnnouncement
  canManage: boolean
  busy: boolean
  onEdit: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text-primary">{item.title}</p>
            {item.isPinned && <Badge variant="warning">Pinned</Badge>}
          </div>
          <p className="mt-1 line-clamp-3 text-sm text-text-secondary">{item.body}</p>
          <p className="mt-2 text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={onEdit} className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary"><Pencil size={14} /></button>
            <button onClick={onTogglePin} disabled={busy} className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-primary hover:text-accent"><Pin size={14} /></button>
            <button onClick={onDelete} disabled={busy} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
