import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceArea } from '@/hooks/useWorkspaceArea'
import { workspaceService, type WorkspaceGalleryItem } from '@/services/workspaceService'

export default function Gallery() {
  const user = useAuthStore((state) => state.user)
  const { canManageWorkspace } = useWorkspaceArea()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<WorkspaceGalleryItem[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [type, setType] = useState<'photo' | 'screenshot'>('photo')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    void load()
  }, [])

  const stats = useMemo(() => {
    const photos = items.filter((item) => item.type === 'photo').length
    const screenshots = items.filter((item) => item.type === 'screenshot').length
    return { photos, screenshots }
  }, [items])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await workspaceService.getGallery())
    } catch {
      setError('Gallery could not be loaded yet.')
    } finally {
      setLoading(false)
    }
  }

  async function upload() {
    if (!file) return
    setSaving(true)
    setError('')
    try {
      const created = await workspaceService.uploadGallery(file, type, caption)
      setItems((current) => [created, ...current])
      setFile(null)
      setCaption('')
      setType('photo')
    } catch {
      setError('The upload could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  async function removeItem(id: string) {
    if (!confirm('Delete this gallery item?')) return
    setBusyId(id)
    try {
      await workspaceService.deleteGalleryItem(id)
      setItems((current) => current.filter((item) => item._id !== id))
    } catch {
      setError('The gallery item could not be deleted.')
    } finally {
      setBusyId('')
    }
  }

  function canDeleteItem(item: WorkspaceGalleryItem) {
    return canManageWorkspace || item.uploadedBy?._id === user?._id || item.uploadedBy?._id === user?.id
  }

  return (
    <PageWrapper title="Gallery">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-accent/20 bg-gradient-to-br from-accent/10 via-bg-tertiary to-bg-tertiary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImagePlus size={18} className="text-accent" />Upload media</CardTitle>
              <CardDescription>Photos and screenshots for the current roster area.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary" />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Type</label>
                  <select value={type} onChange={(event) => setType(event.target.value as 'photo' | 'screenshot')} className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
                    <option value="photo">Photo</option>
                    <option value="screenshot">Screenshot</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Caption</label>
                  <input value={caption} onChange={(event) => setCaption(event.target.value)} className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void upload()} loading={saving} disabled={!file}>Upload</Button>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <StatCard label="Total items" value={String(items.length)} />
            <StatCard label="Photos" value={String(stats.photos)} />
            <StatCard label="Screenshots" value={String(stats.screenshots)} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Media library</CardTitle>
            <CardDescription>Recent uploads for the current team.</CardDescription>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState message="No gallery items uploaded yet." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <div key={item._id} className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
                    <div className="aspect-[4/3] bg-bg-tertiary">
                      <img src={item.url} alt={item.caption || item.type} className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={item.type === 'photo' ? 'default' : 'muted'}>{item.type}</Badge>
                            {item.uploadedBy?.username && <span className="text-xs text-text-muted">by {item.uploadedBy.username}</span>}
                          </div>
                          <p className="mt-2 text-sm text-text-secondary">{item.caption || 'No caption provided.'}</p>
                        </div>
                        {canDeleteItem(item) && (
                          <button onClick={() => void removeItem(item._id)} disabled={busyId === item._id} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
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
