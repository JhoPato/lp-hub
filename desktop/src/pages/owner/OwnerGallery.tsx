import { useEffect, useState } from 'react'
import { Trash2, ChevronDown, Download } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { adminService, type AdminTeam } from '@/services/adminService'
import { siteService, type GalleryItem, type TeamLogos } from '@/services/siteService'

const LOGO_LABELS: Record<string, string> = {
  main: 'Main',
  whiteBg: 'White BG',
  blackBg: 'Black BG',
  coloredBg: 'Colored BG',
}

export default function OwnerGallery() {
  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [selectedTeam, setSelectedTeam] = useState<AdminTeam | null>(null)
  const [logos, setLogos] = useState<TeamLogos | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [adminGallery, setAdminGallery] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    adminService.getTeams().then((t) => { setTeams(t); setSelectedTeam(t[0] ?? null) }).finally(() => setTeamsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    setLoading(true)
    siteService.getTeamGallery(selectedTeam._id)
      .then((d) => {
        setLogos(d.team.logos ?? null)
        setGallery([...(d.playerGallery ?? []), ...(d.managerGallery ?? [])])
        setAdminGallery([...(d.adminPlayerUploads ?? []), ...(d.adminManagerUploads ?? [])])
      })
      .catch(() => { setLogos(null); setGallery([]); setAdminGallery([]) })
      .finally(() => setLoading(false))
  }, [selectedTeam])

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this photo?')) return
    await siteService.deleteGalleryItem(id)
    setGallery((p) => p.filter((g) => g._id !== id))
    setAdminGallery((p) => p.filter((g) => g._id !== id))
  }

  const downloadFile = async (url: string, filename: string) => {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <PageWrapper title="Assets & Gallery">
      <div className="w-full space-y-6">
        {/* Team selector */}
        <div className="flex items-center gap-3">
          {teamsLoading ? <Skeleton className="h-9 w-48" /> : (
            <div className="relative">
              <select
                value={selectedTeam?._id ?? ''}
                onChange={(e) => setSelectedTeam(teams.find((t) => t._id === e.target.value) ?? null)}
                className="appearance-none rounded-md border border-border bg-bg-tertiary text-text-primary text-sm px-3 py-2 pr-8 outline-none focus:border-accent cursor-pointer"
              >
                {teams.map((t) => <option key={t._id} value={t._id}>{t.name} [{t.tag}]</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          )}
          {selectedTeam && !loading && (
            <span className="text-sm text-text-muted">{gallery.length} photos · {adminGallery.length} admin uploads</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* Logos section */}
            {logos && Object.keys(logos).length > 0 && (
              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-text-muted border-b border-border pb-2">
                  Team Logos
                </h3>
                <div className="flex flex-wrap gap-3">
                  {(Object.entries(logos) as [string, { url: string; publicId: string } | undefined][])
                    .filter(([, v]) => v?.url)
                    .map(([key, v]) => (
                      <div key={key} className="group relative flex flex-col items-center gap-2">
                        <div className="relative h-24 w-24 rounded-lg border border-border bg-[#1C1917] overflow-hidden flex items-center justify-center">
                          <img src={v!.url} alt={key} className="max-h-full max-w-full object-contain p-2" />
                          <button
                            onClick={() => downloadFile(v!.url, `${selectedTeam?.tag ?? 'logo'}_${key}.png`)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Download size={18} className="text-white" />
                          </button>
                        </div>
                        <span className="text-[10px] text-text-muted">{LOGO_LABELS[key] ?? key}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {adminGallery.length > 0 && (
              <GallerySection title="Admin Uploads" items={adminGallery} onDelete={deleteItem} teamTag={selectedTeam?.tag} onDownload={downloadFile} />
            )}
            {gallery.length > 0 && (
              <GallerySection title="Player Photos" items={gallery} onDelete={deleteItem} teamTag={selectedTeam?.tag} onDownload={downloadFile} />
            )}
            {gallery.length === 0 && adminGallery.length === 0 && (!logos || Object.keys(logos).length === 0) && (
              <p className="text-sm text-text-muted">No assets for this team.</p>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}

function GallerySection({
  title, items, onDelete, teamTag, onDownload,
}: {
  title: string
  items: GalleryItem[]
  onDelete: (id: string) => void
  teamTag?: string
  onDownload: (url: string, filename: string) => void
}) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-text-muted border-b border-border pb-2">
        {title} ({items.length})
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {items.map((item, i) => (
          <div key={item._id} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-tertiary">
            <img src={item.url} alt={item.caption} className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={() => onDownload(item.url, `${teamTag ?? 'photo'}_${i + 1}.jpg`)}
                className="rounded p-1.5 bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => onDelete(item._id)}
                className="rounded p-1.5 bg-danger/80 text-white hover:bg-danger transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {item.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {item.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
