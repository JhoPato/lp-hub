import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ExternalLink, Image, Newspaper, Save, Search, Sparkles, UploadCloud, ImagePlus, Loader2, X } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { hubService, type AllTeam, type HubScheduleEvent } from '@/services/hubService'
import {
  siteService,
  type CobblemonLeague,
  type CobblemonVip,
  type LiveNewsItem,
  type NewsDraft,
  type SiteAssetsTeam,
} from '@/services/siteService'
import { useAuthStore } from '@/stores/authStore'
import { buildEventDate, formatDateTime, timeFromNow } from '@/lib/hubDates'
import { cn } from '@/lib/utils'

type SocialTab = 'news' | 'assets' | 'matches' | 'cobblemon'

interface NewsFormState {
  title: string
  content: string
  image: string
  video_id: string
}

const initialNewsForm: NewsFormState = {
  title: '',
  content: '',
  image: '',
  video_id: '',
}

export default function Social() {
  const user = useAuthStore((state) => state.user)
  const [tab, setTab] = useState<SocialTab>('news')
  const [error, setError] = useState('')

  const [newsLoading, setNewsLoading] = useState(true)
  const [drafts, setDrafts] = useState<NewsDraft[]>([])
  const [liveNews, setLiveNews] = useState<LiveNewsItem[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [newsForm, setNewsForm] = useState<NewsFormState>(initialNewsForm)
  const [savingDraft, setSavingDraft] = useState(false)
  const [newsImageUploading, setNewsImageUploading] = useState(false)

  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assets, setAssets] = useState<SiteAssetsTeam[]>([])
  const [teams, setTeams] = useState<Record<string, AllTeam>>({})
  const [assetSearch, setAssetSearch] = useState('')

  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matches, setMatches] = useState<HubScheduleEvent[]>([])

  const [cobblemonLoading, setCobblemonLoading] = useState(false)
  const [league, setLeague] = useState<CobblemonLeague>({
    name: '',
    season: 1,
    logo: '',
    status: 'em_breve',
    statusLabel: 'COMING SOON',
    startDate: '',
    format: '',
    description: '',
    rules: [],
    registration: {
      status: 'coming_soon',
      maxParticipants: 0,
      currentParticipants: 0,
      discordLink: '',
      formLink: '',
    },
    rounds: [],
    standings: [],
    discordLink: '',
    formLink: '',
    maxParticipants: 0,
    currentParticipants: 0,
  })
  const [vip, setVip] = useState<CobblemonVip>({ tiers: [] })
  const [savingLeague, setSavingLeague] = useState(false)

  const isOwner = user?.role === 'owner'
  const canSubmit = user?.role === 'social'

  useEffect(() => {
    void loadNews()
  }, [])

  useEffect(() => {
    if (tab === 'assets' && assets.length === 0 && !assetsLoading) void loadAssets()
    if (tab === 'matches' && matches.length === 0 && !matchesLoading) void loadMatches()
    if (tab === 'cobblemon' && vip.tiers.length === 0 && !cobblemonLoading) void loadCobblemon()
  }, [assets.length, assetsLoading, cobblemonLoading, matches.length, matchesLoading, tab, vip.tiers.length])

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase()
    if (!query) return assets
    return assets.filter((team) => {
      const inTeam = team.name?.toLowerCase().includes(query)
      const inPlayers = (team.players ?? []).some((player) => player.name?.toLowerCase().includes(query))
      const inCoaches = (team.coaches ?? []).some((coach) => coach.name?.toLowerCase().includes(query))
      return inTeam || inPlayers || inCoaches
    })
  }, [assetSearch, assets])

  async function loadNews() {
    setNewsLoading(true)
    setError('')
    const [draftsResult, liveResult] = await Promise.allSettled([
      siteService.getNewsDrafts(),
      siteService.getLiveNews(),
    ])

    if (draftsResult.status === 'fulfilled') setDrafts(draftsResult.value)
    if (liveResult.status === 'fulfilled') setLiveNews(liveResult.value)
    if (draftsResult.status === 'rejected' || liveResult.status === 'rejected') {
      setError('Some social content could not be loaded yet.')
    }

    setNewsLoading(false)
  }

  async function loadAssets() {
    setAssetsLoading(true)
    const [assetsResult, teamsResult] = await Promise.allSettled([
      siteService.getAssets(),
      hubService.getAllTeams(),
    ])

    if (assetsResult.status === 'fulfilled') setAssets(assetsResult.value.teams ?? [])
    if (teamsResult.status === 'fulfilled') {
      setTeams(Object.fromEntries(teamsResult.value.map((team) => [team.name.toLowerCase(), team])))
    }
    if (assetsResult.status === 'rejected') setError('Assets could not be loaded.')
    setAssetsLoading(false)
  }

  async function loadMatches() {
    setMatchesLoading(true)
    const from = new Date()
    const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    try {
      setMatches(await hubService.getTournamentSchedule(from.toISOString(), to.toISOString()))
    } catch {
      setError('Tournament schedule could not be loaded.')
    } finally {
      setMatchesLoading(false)
    }
  }

  async function loadCobblemon() {
    setCobblemonLoading(true)
    const [leagueResult, vipResult] = await Promise.allSettled([
      siteService.getCobblemonLeague(),
      siteService.getCobblemonVip(),
    ])
    if (leagueResult.status === 'fulfilled') setLeague(leagueResult.value)
    if (vipResult.status === 'fulfilled') setVip(vipResult.value)
    if (leagueResult.status === 'rejected' || vipResult.status === 'rejected') {
      setError('Cobblemon content could not be loaded.')
    }
    setCobblemonLoading(false)
  }

  function openEditor(draft?: NewsDraft) {
    setEditingDraftId(draft?._id ?? null)
    setNewsForm(
      draft
        ? {
            title: draft.title ?? '',
            content: draft.content ?? '',
            image: draft.image ?? '',
            video_id: draft.video_id ?? '',
          }
        : initialNewsForm
    )
    setEditorOpen(true)
  }

  async function saveDraft(submit = false) {
    if (!newsForm.title.trim()) {
      setError('A draft title is required.')
      return
    }

    setSavingDraft(true)
    setError('')
    try {
      let draft: NewsDraft
      if (editingDraftId) {
        draft = await siteService.updateNewsDraft(editingDraftId, newsForm)
        setDrafts((current) => current.map((item) => (item._id === editingDraftId ? draft : item)))
      } else {
        draft = await siteService.createNewsDraft(newsForm)
        setDrafts((current) => [draft, ...current])
      }

      if (submit && canSubmit) {
        const submitted = await siteService.submitNewsDraft(draft._id)
        setDrafts((current) => current.map((item) => (item._id === submitted._id ? submitted : item)))
      }

      setEditorOpen(false)
      setEditingDraftId(null)
      setNewsForm(initialNewsForm)
    } catch {
      setError('The draft could not be saved.')
    } finally {
      setSavingDraft(false)
    }
  }

  async function submitDraft(id: string) {
    try {
      const submitted = await siteService.submitNewsDraft(id)
      setDrafts((current) => current.map((item) => (item._id === submitted._id ? submitted : item)))
    } catch {
      setError('That draft could not be submitted for review.')
    }
  }

  async function deleteDraft(id: string) {
    if (!confirm('Delete this draft?')) return
    try {
      await siteService.deleteNewsDraft(id)
      setDrafts((current) => current.filter((item) => item._id !== id))
    } catch {
      setError('That draft could not be deleted.')
    }
  }

  async function saveCobblemonLeague() {
    setSavingLeague(true)
    try {
      await siteService.saveCobblemonLeague(league)
    } catch {
      setError('Cobblemon league settings could not be saved.')
    } finally {
      setSavingLeague(false)
    }
  }

  return (
    <PageWrapper title="Social">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <TabButton active={tab === 'news'} onClick={() => setTab('news')} icon={Newspaper} label="News" />
          <TabButton active={tab === 'assets'} onClick={() => setTab('assets')} icon={Image} label="Assets" />
          <TabButton active={tab === 'matches'} onClick={() => setTab('matches')} icon={CalendarDays} label="Matches" />
          <TabButton active={tab === 'cobblemon'} onClick={() => setTab('cobblemon')} icon={Sparkles} label="Cobblemon" />
        </div>

        {error && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {error}
          </div>
        )}

        {tab === 'news' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">News Drafts</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Create desktop-native drafts and keep the published feed in view.
                </p>
              </div>
              <Button onClick={() => openEditor()}>New Draft</Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Drafts</CardTitle>
                  <CardDescription>
                    {newsLoading ? 'Loading drafts...' : `${drafts.length} total drafts`}
                  </CardDescription>
                </CardHeader>
                <CardBody className="grid gap-4 md:grid-cols-2">
                  {newsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-56 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                    ))
                  ) : drafts.length === 0 ? (
                    <EmptyState message="No drafts yet. Create one from the desktop app." className="md:col-span-2" />
                  ) : (
                    drafts.map((draft) => (
                      <Card key={draft._id} className="overflow-hidden bg-bg-secondary">
                        {draft.image ? (
                          <img src={draft.image} alt={draft.title} className="h-36 w-full object-cover" />
                        ) : (
                          <div className="flex h-36 items-center justify-center bg-bg-tertiary text-sm uppercase tracking-[0.18em] text-text-muted">
                            Draft
                          </div>
                        )}
                        <CardBody className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text-primary">{draft.title}</p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {new Date(draft.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={statusVariant(draft.status)}>
                              {draft.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="line-clamp-3 text-sm text-text-secondary">{draft.content || 'No copy yet.'}</p>
                          {draft.reviewNote && (
                            <div className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
                              {draft.reviewNote}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openEditor(draft)}>
                              Edit
                            </Button>
                            {canSubmit && ['draft', 'rejected'].includes(draft.status) && (
                              <Button size="sm" onClick={() => void submitDraft(draft._id)}>
                                Submit
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => void deleteDraft(draft._id)}>
                              Delete
                            </Button>
                          </div>
                        </CardBody>
                      </Card>
                    ))
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Published Feed</CardTitle>
                  <CardDescription>What is currently live on the site.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-3">
                  {newsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                    ))
                  ) : liveNews.length === 0 ? (
                    <EmptyState message="No published news right now." />
                  ) : (
                    liveNews.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-text-primary">{item.title}</p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {item.date ? new Date(item.date).toLocaleDateString() : 'Live now'}
                            </p>
                          </div>
                          <Badge variant="success">Published</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {tab === 'assets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Assets & Gallery</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Team logos, player photos, and coach assets from the website content layer.
                </p>
              </div>
              <div className="w-full max-w-xs">
                <Input
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                  icon={<Search size={14} />}
                  placeholder="Search team or player"
                />
              </div>
            </div>

            {assetsLoading ? (
              <div className="grid gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="h-56 animate-skeleton-pulse bg-bg-tertiary" />
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <EmptyState message="No assets matched your search." />
            ) : (
              <div className="grid gap-4">
                {filteredAssets.map((team) => {
                  const hubTeam = team.name ? teams[team.name.toLowerCase()] : undefined
                  const logo = hubTeam?.logos?.main?.url || hubTeam?.logoUrl || team.logoUrl
                  const players = (team.players ?? []).filter((player) => player.photo)
                  const coaches = (team.coaches ?? []).filter((coach) => coach.photo)
                  return (
                    <Card key={`${team.name}-${team.region}`}>
                      <CardBody className="space-y-4">
                        <div className="flex items-center gap-4">
                          {logo ? (
                            <img src={logo} alt={team.name} className="h-12 w-12 rounded-lg border border-border object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-bg-secondary text-sm text-text-muted">
                              LP
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-text-primary">{team.name}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{team.region || 'Unknown region'}</p>
                          </div>
                        </div>

                        {players.length > 0 && (
                          <AssetSection title="Players" items={players} />
                        )}
                        {coaches.length > 0 && (
                          <AssetSection title="Coaches" items={coaches} />
                        )}
                        {players.length === 0 && coaches.length === 0 && (
                          <EmptyState message="No uploaded assets for this team yet." />
                        )}
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'matches' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Next Matches</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Upcoming tournament schedule from the social-facing content workflow.
              </p>
            </div>

            {matchesLoading ? (
              <div className="grid gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className="h-24 animate-skeleton-pulse bg-bg-tertiary" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <EmptyState message="No tournament matches scheduled in the next 60 days." />
            ) : (
              <div className="grid gap-3">
                {matches.map((event) => {
                  const eventDate = buildEventDate(event)
                  const team = typeof event.teamId === 'string' ? null : event.teamId
                  const teamLogo = team?.logos?.main?.url || team?.logoUrl
                  return (
                    <Card key={`${event._id}-${event.date}`}>
                      <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="min-w-[64px] rounded-lg border border-border bg-bg-secondary px-3 py-2 text-center">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                              {eventDate.toLocaleDateString(undefined, { weekday: 'short' })}
                            </p>
                            <p className="text-xl font-semibold text-text-primary">{eventDate.getDate()}</p>
                          </div>
                          {teamLogo ? (
                            <img src={teamLogo} alt={team?.tag || team?.name} className="h-11 w-11 rounded-lg object-cover" />
                          ) : null}
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-accent">{event.title}</p>
                            <p className="mt-1 font-medium text-text-primary">
                              {(team?.name || team?.tag || 'LP Team')}
                              {event.opponent ? ` vs ${event.opponent}` : ''}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {formatDateTime(eventDate)} · {timeFromNow(eventDate)}
                            </p>
                          </div>
                        </div>

                        {event.streamUrl && (
                          <a
                            href={event.streamUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 self-start rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
                          >
                            <ExternalLink size={14} />
                            Stream
                          </a>
                        )}
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'cobblemon' && (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Cobblemon League</CardTitle>
                <CardDescription>Editable summary fields already exposed by the desktop API.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label="League name"
                  value={league.name ?? ''}
                  onChange={(event) => setLeague((current) => ({ ...current, name: event.target.value }))}
                />
                <Input
                  label="Discord link"
                  value={league.discordLink ?? ''}
                  onChange={(event) => setLeague((current) => ({ ...current, discordLink: event.target.value }))}
                />
                <Input
                  label="Form link"
                  value={league.formLink ?? ''}
                  onChange={(event) => setLeague((current) => ({ ...current, formLink: event.target.value }))}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Max participants"
                    type="number"
                    value={league.maxParticipants ?? 0}
                    onChange={(event) => setLeague((current) => ({ ...current, maxParticipants: Number(event.target.value) }))}
                  />
                  <Input
                    label="Current participants"
                    type="number"
                    value={league.currentParticipants ?? 0}
                    onChange={(event) => setLeague((current) => ({ ...current, currentParticipants: Number(event.target.value) }))}
                  />
                </div>
                <Button loading={savingLeague} onClick={() => void saveCobblemonLeague()}>
                  <Save size={14} />
                  Save league summary
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>VIP Tiers</CardTitle>
                <CardDescription>
                  {cobblemonLoading ? 'Loading tiers...' : `${vip.tiers.length} VIP tiers synced`}
                </CardDescription>
              </CardHeader>
              <CardBody className="space-y-3">
                {cobblemonLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />
                  ))
                ) : vip.tiers.length === 0 ? (
                  <EmptyState message="No VIP tiers found." />
                ) : (
                  vip.tiers.map((tier) => (
                    <div key={tier.id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tier.badge}</span>
                            <p className="font-medium text-text-primary">{tier.name}</p>
                            {tier.featured && <Badge variant="warning">Featured</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-accent">
                            {tier.price} <span className="text-text-secondary">{tier.period}</span>
                          </p>
                          <p className="mt-2 text-sm text-text-secondary">
                            {(tier.perks || []).slice(0, 3).join(' · ')}
                          </p>
                        </div>
                        <span
                          className="mt-1 h-3 w-3 rounded-full border border-white/10"
                          style={{ backgroundColor: tier.color }}
                        />
                      </div>
                    </div>
                  ))
                )}
                {isOwner && (
                  <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted">
                    Full approval and publishing controls are still available in the dedicated owner views.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingDraftId ? 'Edit Draft' : 'New Draft'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={newsForm.title}
            onChange={(event) => setNewsForm((current) => ({ ...current, title: event.target.value }))}
          />
          <div className="rounded-md border border-border bg-bg-tertiary p-2">
            <textarea
              value={newsForm.content}
              onChange={(event) => setNewsForm((current) => ({ ...current, content: event.target.value }))}
              rows={6}
              placeholder="Write the story copy here..."
              className="w-full resize-y bg-transparent px-2 py-1 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <NewsImageField value={newsForm.image} onChange={(value) => setNewsForm((current) => ({ ...current, image: value }))} onUploadingChange={setNewsImageUploading} />
          <Input
            label="YouTube video ID"
            value={newsForm.video_id}
            onChange={(event) => setNewsForm((current) => ({ ...current, video_id: event.target.value }))}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={newsImageUploading}>
              Cancel
            </Button>
            <Button variant="secondary" loading={savingDraft} onClick={() => void saveDraft(false)} disabled={newsImageUploading}>
              Save draft
            </Button>
            {canSubmit && (
              <Button loading={savingDraft} onClick={() => void saveDraft(true)} disabled={newsImageUploading}>
                Save & submit
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Newspaper
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-accent/30 bg-accent/10 text-accent'
          : 'border-border bg-bg-tertiary text-text-secondary hover:text-text-primary'
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}

function EmptyState({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted', className)}>
      {message}
    </div>
  )
}

function AssetSection({
  title,
  items,
}: {
  title: string
  items: Array<{ name?: string; photo?: string }>
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={`${title}-${item.name}-${item.photo}`} className="overflow-hidden rounded-lg border border-border bg-bg-secondary">
            <img src={item.photo} alt={item.name} className="h-28 w-full object-cover" />
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <p className="truncate text-sm text-text-primary">{item.name || 'Unknown'}</p>
              <a
                href={item.photo}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-accent"
              >
                Open
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function statusVariant(status: NewsDraft['status']) {
  if (status === 'published') return 'success'
  if (status === 'pending_review') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'muted'
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

function NewsImageField({ value, onChange, onUploadingChange }: { value: string; onChange: (value: string) => void; onUploadingChange: (uploading: boolean) => void }) {
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
              <p className="text-sm font-medium text-text-primary">{preview ? 'Image ready for this draft' : 'Upload a news cover image'}</p>
              <p className="text-xs leading-5 text-text-muted">
                Accepts WEBP, PNG, JPG and JPEG. The uploaded Cloudinary CDN URL is saved into the draft automatically.
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

      <Input label="CDN / External URL" value={value} onChange={(event) => handleManualUrl(event.target.value)} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
