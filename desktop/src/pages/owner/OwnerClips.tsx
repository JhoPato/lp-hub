import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ExternalLink, Film, MessageSquareText, Play, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { siteService, type SiteClip } from '@/services/siteService'

function formatShortDate(value?: string) {
  if (!value) return 'Unknown date'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatLongDate(value?: string) {
  if (!value) return 'Submission date unavailable'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Submission date unavailable'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function clipThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

function clipWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`
}

function clipEmbedUrl(videoId: string) {
  const params = new URLSearchParams({
    autoplay: '0',
    rel: '0',
    modestbranding: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

export default function OwnerClips() {
  const [clips, setClips] = useState<SiteClip[]>([])
  const [loading, setLoading] = useState(true)
  const [activeClip, setActiveClip] = useState<SiteClip | null>(null)
  const [deletingId, setDeletingId] = useState('')
  const [embedReady, setEmbedReady] = useState(false)

  useEffect(() => {
    siteService.getClips()
      .then((data) => setClips(Array.isArray(data) ? data : []))
      .catch(() => setClips([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setEmbedReady(false)
  }, [activeClip?.id])

  const stats = useMemo(() => {
    const withDiscord = clips.filter((clip) => Boolean(clip.discord?.trim())).length
    const withTwitter = clips.filter((clip) => Boolean(clip.twitter?.trim())).length

    return [
      { label: 'Public submissions', value: clips.length },
      { label: 'Discord contact', value: withDiscord },
      { label: 'Twitter contact', value: withTwitter },
    ]
  }, [clips])

  const deleteClip = async (clip: SiteClip) => {
    if (!confirm('Delete this clip from the LP public submissions list?')) return

    setDeletingId(clip.id)
    try {
      await siteService.deleteClip(clip.id)
      setClips((current) => current.filter((entry) => entry.id !== clip.id))
      setActiveClip((current) => current?.id === clip.id ? null : current)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <PageWrapper title="Clips - Fanbase">
      <div className="w-full space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
          <Card className="overflow-hidden">
            <CardBody className="relative p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent_55%)]" />
              <div className="relative space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                    <Film size={18} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">Public LP clips inbox</h2>
                    <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                      This area now pulls the real fanbase clips feed from the public LP website. Each card represents
                      a submitted YouTube clip with the contact details shared on the public form.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {loading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-24 rounded-xl" />
                      ))
                    : stats.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-border bg-bg-primary/70 px-4 py-3"
                        >
                          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">{item.label}</div>
                          <div className="mt-3 text-3xl font-semibold text-text-primary">{item.value}</div>
                        </div>
                      ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>
                Data comes from `GET /api/site/clips`, which proxies the public LP site clips endpoint instead of the
                team gallery.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4 text-sm text-text-secondary">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-primary/70 px-3 py-2">
                <Play size={14} className="text-accent" />
                <span>YouTube thumbnails and embeds are generated from `videoId`.</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-primary/70 px-3 py-2">
                <MessageSquareText size={14} className="text-accent" />
                <span>Discord and Twitter are optional submitter contacts from the public form.</span>
              </div>
            </CardBody>
          </Card>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[320px] rounded-xl" />
            ))}
          </div>
        ) : clips.length === 0 ? (
          <Card>
            <CardBody className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-primary text-text-muted">
                <Film size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-text-primary">No submitted clips</h3>
                <p className="max-w-md text-sm text-text-secondary">
                  The public LP site did not return any fanbase clips yet. When players or fans submit a clip there,
                  it should appear here automatically.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {clips.map((clip) => (
              <Card key={clip.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setActiveClip(clip)
                    setEmbedReady(false)
                  }}
                  className="group relative block aspect-video w-full overflow-hidden border-b border-border bg-black text-left"
                >
                  <img
                    src={clipThumbnail(clip.videoId)}
                    alt={`Clip ${clip.videoId}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
                      <Play size={18} className="ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute left-3 top-3">
                    <Badge variant="default">Fan submission</Badge>
                  </div>
                </button>

                <CardBody className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <CalendarClock size={14} className="text-text-muted" />
                    <span>Submitted {formatShortDate(clip.submittedAt)}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {clip.discord && <Badge variant="muted">Discord: {clip.discord}</Badge>}
                    {clip.twitter && <Badge variant="muted">Twitter: {clip.twitter}</Badge>}
                    {!clip.discord && !clip.twitter && <Badge variant="muted">No contact details</Badge>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => { setActiveClip(clip); setEmbedReady(false) }}>
                      <Play size={14} /> Watch
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.open(clipWatchUrl(clip.videoId), '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink size={14} /> Open YouTube
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-danger hover:bg-danger/10 hover:text-danger"
                      onClick={() => deleteClip(clip)}
                      loading={deletingId === clip.id}
                    >
                      <Trash2 size={14} /> Delete
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!activeClip}
        onClose={() => setActiveClip(null)}
        title="Clip Preview"
        className="max-w-4xl"
      >
        {activeClip && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <div className="aspect-video">
                {embedReady ? (
                  <iframe
                    src={clipEmbedUrl(activeClip.videoId)}
                    title={`Clip ${activeClip.videoId}`}
                    allow="encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="h-full w-full"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEmbedReady(true)}
                    className="group relative block h-full w-full overflow-hidden text-left"
                  >
                    <img
                      src={clipThumbnail(activeClip.videoId)}
                      alt={`Clip ${activeClip.videoId}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
                        <Play size={20} className="ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-white">Start embedded preview</p>
                        <p className="text-xs text-white/75">
                          Uses YouTube privacy-enhanced mode. If the embedded player fails on this PC, open it directly on YouTube.
                        </p>
                      </div>
                      <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-medium text-white">
                        In-app player
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <CalendarClock size={14} className="text-text-muted" />
                  <span>Submitted {formatLongDate(activeClip.submittedAt)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeClip.discord && <Badge variant="muted">Discord: {activeClip.discord}</Badge>}
                  {activeClip.twitter && <Badge variant="muted">Twitter: {activeClip.twitter}</Badge>}
                  {!activeClip.discord && !activeClip.twitter && <Badge variant="muted">No contact details</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.open(clipWatchUrl(activeClip.videoId), '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink size={14} /> Open YouTube
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteClip(activeClip)}
                  loading={deletingId === activeClip.id}
                >
                  <Trash2 size={14} /> Delete Clip
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}
