import { useEffect, useRef, useState } from 'react'
import { Check, X, Trash2, Eye, Plus, Pencil, UploadCloud, ImagePlus, Loader2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { siteService, type NewsDraft, type LiveNewsItem } from '@/services/siteService'
import { cn } from '@/lib/utils'

type Tab = 'live' | 'pending' | 'drafts'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'muted' | 'danger' | 'default'> = {
  draft: 'muted',
  pending_review: 'warning',
  published: 'success',
  rejected: 'danger',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'live',    label: 'Live'           },
  { id: 'pending', label: 'Pending Review' },
  { id: 'drafts',  label: 'All Drafts'     },
]

export default function OwnerNews() {
  const [tab, setTab] = useState<Tab>('live')

  // Live news from LP API
  const [liveNews, setLiveNews] = useState<LiveNewsItem[]>([])
  const [loadingLive, setLoadingLive] = useState(true)

  // Drafts from MongoDB
  const [drafts, setDrafts] = useState<NewsDraft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)

  const [busy, setBusy] = useState('')

  // Preview modal
  const [preview, setPreview] = useState<NewsDraft | null>(null)

  // Reject modal
  const [rejectModal, setRejectModal] = useState<NewsDraft | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  // Live edit modal
  const [editLive, setEditLive] = useState<LiveNewsItem | null>(null)
  const [liveForm, setLiveForm] = useState({ title: '', content: '', image: '', video_id: '', date: '' })

  // Create draft modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', content: '', image: '', video_id: '' })
  const [creating, setCreating] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  useEffect(() => {
    siteService.getLiveNews()
      .then(setLiveNews)
      .finally(() => setLoadingLive(false))
    siteService.getNewsDrafts()
      .then(setDrafts)
      .finally(() => setLoadingDrafts(false))
  }, [])

  const pending   = drafts.filter((d) => d.status === 'pending_review')
  const allDrafts = drafts

  // ── Actions ──────────────────────────────────────────────────────────────

  const publish = async (draft: NewsDraft) => {
    setBusy(draft._id)
    try {
      await siteService.publishNews(draft._id)
      setDrafts((p) => p.map((d) => d._id === draft._id ? { ...d, status: 'published' } : d))
      // Refresh live news after publish
      siteService.getLiveNews().then(setLiveNews)
    } finally { setBusy('') }
  }

  const reject = async () => {
    if (!rejectModal) return
    setBusy(rejectModal._id)
    try {
      await siteService.rejectNews(rejectModal._id, rejectNote)
      setDrafts((p) => p.map((d) => d._id === rejectModal._id ? { ...d, status: 'rejected', reviewNote: rejectNote } : d))
      setRejectModal(null); setRejectNote('')
    } finally { setBusy('') }
  }

  const removeDraft = async (id: string) => {
    if (!confirm('Delete this draft?')) return
    await siteService.deleteNewsDraft(id)
    setDrafts((p) => p.filter((d) => d._id !== id))
  }

  const openLiveEdit = (item: LiveNewsItem) => {
    setLiveForm({
      title:    item.title,
      content:  item.content  || '',
      image:    item.image    || '',
      video_id: item.video_id || '',
      date:     item.date     || '',
    })
    setEditLive(item)
  }

  const saveLiveEdit = async () => {
    if (!editLive) return
    setBusy(editLive.id)
    try {
      await siteService.editLiveNews(editLive.id, liveForm)
      setLiveNews((p) => p.map((n) => n.id === editLive.id ? { ...n, ...liveForm } : n))
      setEditLive(null)
    } finally { setBusy('') }
  }

  const deleteLive = async (item: LiveNewsItem) => {
    if (!confirm('Remove this post from the live site?')) return
    setBusy(item.id)
    try {
      await siteService.deleteLiveNews(item.id)
      setLiveNews((p) => p.filter((n) => n.id !== item.id))
      // Update draft status if it exists
      setDrafts((p) => p.map((d) => d.publishedId === item.id ? { ...d, status: 'draft', publishedId: null, publishedAt: null } : d))
    } finally { setBusy('') }
  }

  const createDraft = async () => {
    if (!createForm.title.trim()) return
    setCreating(true)
    try {
      const draft = await siteService.createNewsDraft(createForm)
      setDrafts((p) => [draft, ...p])
      setCreateOpen(false)
      setCreateForm({ title: '', content: '', image: '', video_id: '' })
      setTab('drafts')
    } finally { setCreating(false) }
  }

  // ── Tab counts ────────────────────────────────────────────────────────────

  const tabCount: Record<Tab, number | undefined> = {
    live:    loadingLive    ? undefined : liveNews.length,
    pending: loadingDrafts  ? undefined : pending.length,
    drafts:  loadingDrafts  ? undefined : allDrafts.length,
  }

  return (
    <PageWrapper title="News">
      <div className="w-full space-y-5">

        {/* Tab bar + New Draft button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 rounded-lg border border-border bg-bg-tertiary p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-primary',
                )}
              >
                {t.label}
                {tabCount[t.id] !== undefined && tabCount[t.id]! > 0 && (
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none', tab === t.id ? 'bg-white/20' : 'bg-bg-primary text-text-muted')}>
                    {tabCount[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} /> New Draft
          </Button>
        </div>

        {/* Tab content */}
        {tab === 'live' && (
          loadingLive
            ? <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-lg" />)}</div>
            : <LiveTab items={liveNews} busy={busy} onEdit={openLiveEdit} onDelete={deleteLive} />
        )}
        {tab === 'pending' && (
          loadingDrafts
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            : <PendingTab items={pending} busy={busy} onPublish={publish} onReject={setRejectModal} onPreview={setPreview} />
        )}
        {tab === 'drafts' && (
          loadingDrafts
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            : <DraftsTab items={allDrafts} busy={busy} onPublish={publish} onReject={setRejectModal} onDelete={removeDraft} onPreview={setPreview} />
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}

      {/* Preview draft */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title} className="max-w-2xl">
        {preview && (
          <div className="space-y-3">
            {preview.image && <img src={preview.image} alt="" className="w-full rounded-lg object-cover max-h-48" />}
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{preview.content}</p>
            {preview.reviewNote && (
              <p className="text-xs text-danger border border-danger/30 rounded px-3 py-2">
                Rejection note: {preview.reviewNote}
              </p>
            )}
            {preview.status === 'pending_review' && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => { publish(preview); setPreview(null) }} loading={busy === preview._id}>
                  <Check size={14} /> Publish
                </Button>
                <Button variant="danger" size="sm" onClick={() => { setPreview(null); setRejectModal(preview) }}>
                  <X size={14} /> Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject news draft">
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">"{rejectModal?.title}"</p>
          <textarea
            className="w-full rounded-md border border-border bg-bg-tertiary text-text-primary text-sm p-3 outline-none focus:border-accent resize-none"
            rows={3}
            placeholder="Rejection note (optional)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={reject} loading={!!busy}>Reject</Button>
            <Button variant="ghost" size="sm" onClick={() => setRejectModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Live edit */}
      <Modal open={!!editLive} onClose={() => setEditLive(null)} title="Edit live post" className="max-w-2xl">
        {editLive && (
          <div className="space-y-4">
            <FormField label="Title" value={liveForm.title} onChange={(v) => setLiveForm((p) => ({ ...p, title: v }))} />
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-1">Content</label>
              <textarea
                value={liveForm.content}
                onChange={(e) => setLiveForm((p) => ({ ...p, content: e.target.value }))}
                rows={6}
                className="w-full rounded-md border border-border bg-bg-tertiary text-text-primary text-sm px-3 py-2 outline-none focus:border-accent transition-colors resize-none"
              />
            </div>
            <NewsImageField value={liveForm.image} onChange={(v) => setLiveForm((p) => ({ ...p, image: v }))} onUploadingChange={setImageUploading} />
            <FormField label="YouTube Video ID" value={liveForm.video_id} onChange={(v) => setLiveForm((p) => ({ ...p, video_id: v }))} />
            <FormField label="Date (e.g. 2025-04-19)" value={liveForm.date} onChange={(v) => setLiveForm((p) => ({ ...p, date: v }))} />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={saveLiveEdit} loading={busy === editLive.id} disabled={imageUploading}>Save changes</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditLive(null)} disabled={imageUploading}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create draft */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New draft" className="max-w-2xl">
        <div className="space-y-4">
          <FormField label="Title" value={createForm.title} onChange={(v) => setCreateForm((p) => ({ ...p, title: v }))} />
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-1">Content</label>
            <textarea
              value={createForm.content}
              onChange={(e) => setCreateForm((p) => ({ ...p, content: e.target.value }))}
              rows={6}
              className="w-full rounded-md border border-border bg-bg-tertiary text-text-primary text-sm px-3 py-2 outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
          <NewsImageField value={createForm.image} onChange={(v) => setCreateForm((p) => ({ ...p, image: v }))} onUploadingChange={setImageUploading} />
          <FormField label="YouTube Video ID" value={createForm.video_id} onChange={(v) => setCreateForm((p) => ({ ...p, video_id: v }))} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={createDraft} loading={creating} disabled={!createForm.title.trim() || imageUploading}>Create draft</Button>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)} disabled={imageUploading}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

// ── Tab components ────────────────────────────────────────────────────────────

function LiveTab({ items, busy, onEdit, onDelete }: {
  items: LiveNewsItem[]
  busy: string
  onEdit: (item: LiveNewsItem) => void
  onDelete: (item: LiveNewsItem) => void
}) {
  if (items.length === 0) return <p className="text-sm text-text-muted py-4">No live posts yet.</p>

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-tertiary text-[11px] uppercase tracking-wider text-text-muted">
            <th className="px-4 py-3 text-left">Title</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors">
              <td className="px-4 py-3 font-medium text-text-primary max-w-xs truncate">{item.title}</td>
              <td className="px-4 py-3 text-text-muted text-xs">{item.date || '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(item)} className="rounded p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(item)} disabled={busy === item.id} className="rounded p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PendingTab({ items, busy, onPublish, onReject, onPreview }: {
  items: NewsDraft[]
  busy: string
  onPublish: (d: NewsDraft) => void
  onReject: (d: NewsDraft) => void
  onPreview: (d: NewsDraft) => void
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted py-4">No drafts pending review.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((d) => (
        <div key={d._id} className="flex items-center gap-3 rounded-lg border border-warning/40 bg-bg-tertiary px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">{d.title}</p>
            <p className="text-xs text-text-muted">by {d.createdByName} · {new Date(d.updatedAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onPreview(d)} className="rounded p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"><Eye size={14} /></button>
            <button onClick={() => onPublish(d)} disabled={!!busy} className="rounded p-1.5 text-text-muted hover:text-success hover:bg-success/10 transition-colors" title="Publish"><Check size={14} /></button>
            <button onClick={() => onReject(d)} className="rounded p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Reject"><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

function DraftsTab({ items, busy, onPublish, onReject, onDelete, onPreview }: {
  items: NewsDraft[]
  busy: string
  onPublish: (d: NewsDraft) => void
  onReject: (d: NewsDraft) => void
  onDelete: (id: string) => void
  onPreview: (d: NewsDraft) => void
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted py-4">No drafts yet.</p>
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-tertiary text-[11px] uppercase tracking-wider text-text-muted">
            <th className="px-4 py-3 text-left">Title</th>
            <th className="px-4 py-3 text-left">Author</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => {
            const variant   = STATUS_VARIANT[d.status] ?? 'default'
            const canPublish = d.status === 'pending_review'
            const canDelete  = d.status !== 'published'
            return (
              <tr key={d._id} className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary max-w-xs truncate">{d.title}</td>
                <td className="px-4 py-3 text-text-secondary text-xs">{d.createdByName}</td>
                <td className="px-4 py-3"><Badge variant={variant}>{d.status.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-3 text-text-muted text-xs">{new Date(d.updatedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onPreview(d)} className="rounded p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"><Eye size={14} /></button>
                    {canPublish && <>
                      <button onClick={() => onPublish(d)} disabled={!!busy} className="rounded p-1.5 text-text-muted hover:text-success hover:bg-success/10 transition-colors"><Check size={14} /></button>
                      <button onClick={() => onReject(d)} className="rounded p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><X size={14} /></button>
                    </>}
                    {canDelete && <button onClick={() => onDelete(d._id)} className="rounded p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary text-text-primary text-sm px-3 py-2 outline-none focus:border-accent transition-colors"
      />
    </div>
  )
}

function getUploadErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const maybeError = error as { response?: { status?: number; data?: { error?: string } }; message?: string }
    if (maybeError.response?.status === 404) {
      return 'The upload endpoint could not be reached. Check that the desktop app is connected to the LP Hub API.'
    }
    return maybeError.response?.data?.error || maybeError.message || 'Upload failed.'
  }
  return 'Upload failed.'
}

function NewsImageField({ value, onChange, onUploadingChange }: { value: string; onChange: (v: string) => void; onUploadingChange: (uploading: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const preview = localPreview || value
  const invalidUrlMessage = 'This image URL returned 404 or is no longer public. Discord attachment links often expire. Upload the file directly or use a stable CDN URL.'

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const clearLocalPreview = () => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    clearLocalPreview()
    setError('')

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)
    onUploadingChange(true)

    try {
      const uploaded = await siteService.uploadWebsiteContentImage('news', file)
      clearLocalPreview()
      onChange(uploaded.url)
    } catch (uploadError) {
      setError(getUploadErrorMessage(uploadError))
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  const handleManualUrl = (next: string) => {
    clearLocalPreview()
    setError('')
    onChange(next)
  }

  const clearImage = () => {
    clearLocalPreview()
    setError('')
    onChange('')
  }

  const handlePreviewError = () => {
    if (!localPreview && value) setError(invalidUrlMessage)
  }

  const handlePreviewLoad = () => {
    if (error === invalidUrlMessage) setError('')
  }

  return (
    <div className="space-y-2">
      <label className="block text-[10px] uppercase tracking-widest text-text-muted">Cover Image</label>
      <div className="rounded-xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(232,144,24,0.12),transparent_38%),linear-gradient(180deg,rgba(28,24,21,0.98),rgba(21,18,16,0.98))] p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl border border-border/80 bg-bg-primary/70 shadow-inner sm:w-44">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" onError={handlePreviewError} onLoad={handlePreviewLoad} />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-muted">
                <ImagePlus size={18} />
                <span className="text-[11px] uppercase tracking-[0.22em]">Cloudinary</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">{preview ? 'Image ready for this post' : 'Upload a news cover image'}</p>
              <p className="text-xs leading-5 text-text-muted">
                Accepts WEBP, PNG, JPG and JPEG. The uploaded Cloudinary CDN URL is saved into the news post automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
                <UploadCloud size={14} />
                {value ? 'Replace image' : 'Upload image'}
              </Button>
              {(preview || value) && (
                <Button type="button" size="sm" variant="ghost" onClick={clearImage} disabled={uploading}>
                  <X size={14} />
                  Clear
                </Button>
              )}
              {uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-accent">
                  <Loader2 size={12} className="animate-spin" />
                  Uploading to Cloudinary...
                </span>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/webp,image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>
      <FormField label="CDN / External URL" value={value} onChange={handleManualUrl} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
