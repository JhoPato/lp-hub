import { api } from './api'

export interface NewsDraft {
  _id: string
  title: string
  content: string
  image: string
  video_id: string
  status: 'draft' | 'pending_review' | 'published' | 'rejected'
  createdByName: string
  reviewNote: string
  publishedId: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GalleryItem {
  _id: string
  url: string
  type: 'photo' | 'screenshot'
  caption: string
  isAdminUpload: boolean
  cloudinaryPublicId: string
  uploadedBy: { username: string; profilePhotoUrl?: string }
  createdAt: string
}

export interface TeamLogos {
  main?: { url: string; publicId: string }
  whiteBg?: { url: string; publicId: string }
  blackBg?: { url: string; publicId: string }
  coloredBg?: { url: string; publicId: string }
}

export interface TeamGallery {
  team: { _id: string; name: string; tag: string; logoUrl?: string; logos?: TeamLogos }
  playerGallery: GalleryItem[]
  managerGallery: GalleryItem[]
  adminPlayerUploads: GalleryItem[]
  adminManagerUploads: GalleryItem[]
}

export interface RosterTeam {
  _id: string
  name: string
  tag?: string
  game?: string
  region: string
  logoUrl?: string
  lpApiTeam?: { region: string | null; teamIndex: number | null }
  websiteRoster?: {
    players: Array<RosterMember | string>
    coaches: Array<RosterMember | string>
    lastSynced?: string | null
  }
}

export interface RosterMember {
  name: string
  role?: string
  country?: string
  nationality?: string
  twitter?: string
  vlr?: string
  photo?: string
}

export interface RosterLinkOption {
  region: string
  teamIndex: number
  name: string
}

export interface RosterBulkResult {
  name: string
  status: 'pulled' | 'pushed' | 'error' | 'not_found'
  players?: number
  coaches?: number
  error?: string
}

export interface ScheduleEvent {
  _id: string
  teamId: { name: string; tag: string } | string
  title: string
  type: 'pracc' | 'tournament' | 'warmup' | 'other'
  opponent?: string
  streamUrl?: string
  startTime: string
  endTime: string
  date: string
  notes?: string
  createdBy?: { username: string }
}

export interface VipTier {
  id: string
  name: string
  color: string
  price: string
  period: string
  stripeLink: string
  badge: string
  badgeImg?: string
  featured: boolean
  perks: string[]
}

export interface CobblemonVip {
  tiers: VipTier[]
}

export type CobblemonLeagueStatus = 'em_breve' | 'open' | 'ongoing' | 'closed'
export type CobblemonRegistrationWindowStatus = 'coming_soon' | 'open' | 'closed'
export type CobblemonRegistrationStatus = 'registered' | 'confirmed' | 'disqualified' | 'withdrawn'

export interface CobblemonRule {
  id: string
  icon: string
  title: string
  content: string
}

export interface CobblemonLeagueRegistration {
  status: CobblemonRegistrationWindowStatus
  maxParticipants: number
  currentParticipants: number
  discordLink: string
  formLink: string
}

export interface CobblemonMatchPlayer {
  name: string
  score: number | null
}

export interface CobblemonMatch {
  id: string
  player1: CobblemonMatchPlayer
  player2: CobblemonMatchPlayer
  winner: 1 | 2 | null
}

export interface CobblemonRound {
  round: number
  label: string
  matches: CobblemonMatch[]
}

export interface CobblemonStanding {
  rank: number
  player: string
  wins: number
  losses: number
  pts: number
  buchholz: number
}

export interface CobblemonLeague {
  name: string
  season: number
  logo: string
  status: CobblemonLeagueStatus
  statusLabel: string
  startDate: string
  format: string
  description: string
  rules: CobblemonRule[]
  registration: CobblemonLeagueRegistration
  rounds: CobblemonRound[]
  standings: CobblemonStanding[]

  // Legacy aliases kept so older desktop screens can still read the same data.
  discordLink?: string
  formLink?: string
  maxParticipants?: number
  currentParticipants?: number
}

export interface CobblemonRegistrationRecord {
  discordId: string
  season: number
  discordUsername: string
  discordAvatar?: string
  minecraftUsername?: string
  minecraftUUID?: string
  status: CobblemonRegistrationStatus
  registeredAt: string
  createdAt?: string
  updatedAt?: string
}

export interface CobblemonRegistrationsResponse {
  season: number
  registrations: CobblemonRegistrationRecord[]
}

export interface LiveNewsItem {
  id: string
  title: string
  content?: string
  image?: string
  video_id?: string
  date?: string
}

export interface SiteClip {
  id: string
  videoId: string
  submittedAt?: string
  discord?: string
  twitter?: string
}

export interface SiteAssetsTeamMember {
  name?: string
  photo?: string
}

export interface SiteAssetsTeam {
  name?: string
  region?: string
  logoUrl?: string
  players?: SiteAssetsTeamMember[]
  coaches?: SiteAssetsTeamMember[]
}

export interface SiteUploadResult {
  url: string
  publicId: string
  section: 'staff' | 'trophies' | 'creators' | 'news'
  originalName?: string
}

function normalizeVipTier(tier: Partial<VipTier> | null | undefined, index: number): VipTier {
  return {
    id: tier?.id || `tier-${index + 1}`,
    name: tier?.name || `Tier ${index + 1}`,
    color: tier?.color || '#888888',
    price: tier?.price || '',
    period: tier?.period || '/ month',
    stripeLink: tier?.stripeLink || '',
    badge: tier?.badge || 'STAR',
    badgeImg: tier?.badgeImg || '',
    featured: Boolean(tier?.featured),
    perks: Array.isArray(tier?.perks) ? tier!.perks.filter(Boolean) : [],
  }
}

function normalizeCobblemonVip(data: Partial<CobblemonVip> | null | undefined): CobblemonVip {
  return {
    tiers: Array.isArray(data?.tiers) ? data!.tiers.map((tier, index) => normalizeVipTier(tier, index)) : [],
  }
}

function normalizeCobblemonLeague(data: Partial<CobblemonLeague> | null | undefined): CobblemonLeague {
  const registration: Partial<CobblemonLeagueRegistration> = data?.registration || {}
  const rounds = Array.isArray(data?.rounds) ? data!.rounds : []
  const standings = Array.isArray(data?.standings) ? data!.standings : []

  const normalized: CobblemonLeague = {
    name: data?.name || 'LP Cobblemon League',
    season: typeof data?.season === 'number' ? data.season : 1,
    logo: data?.logo || '',
    status: (data?.status as CobblemonLeagueStatus) || 'em_breve',
    statusLabel: data?.statusLabel || 'COMING SOON',
    startDate: data?.startDate || '',
    format: data?.format || '',
    description: data?.description || '',
    rules: Array.isArray(data?.rules)
      ? data!.rules.map((rule, index) => ({
          id: rule?.id || `rule-${index + 1}`,
          icon: rule?.icon || '!',
          title: rule?.title || '',
          content: rule?.content || '',
        }))
      : [],
    registration: {
      status: (registration.status as CobblemonRegistrationWindowStatus) || 'coming_soon',
      maxParticipants: typeof registration.maxParticipants === 'number'
        ? registration.maxParticipants
        : typeof data?.maxParticipants === 'number' ? data.maxParticipants : 16,
      currentParticipants: typeof registration.currentParticipants === 'number'
        ? registration.currentParticipants
        : typeof data?.currentParticipants === 'number' ? data.currentParticipants : 0,
      discordLink: registration.discordLink || data?.discordLink || '',
      formLink: registration.formLink || data?.formLink || '',
    },
    rounds: rounds.map((round, roundIndex) => ({
      round: typeof round?.round === 'number' ? round.round : roundIndex + 1,
      label: round?.label || `Round ${roundIndex + 1}`,
      matches: Array.isArray(round?.matches)
        ? round.matches.map((match, matchIndex) => ({
            id: match?.id || `r${roundIndex + 1}m${matchIndex + 1}`,
            player1: {
              name: match?.player1?.name || '',
              score: typeof match?.player1?.score === 'number' ? match.player1.score : null,
            },
            player2: {
              name: match?.player2?.name || '',
              score: typeof match?.player2?.score === 'number' ? match.player2.score : null,
            },
            winner: match?.winner === 1 || match?.winner === 2 ? match.winner : null,
          }))
        : [],
    })),
    standings: standings.map((standing, index) => ({
      rank: typeof standing?.rank === 'number' ? standing.rank : index + 1,
      player: standing?.player || '',
      wins: typeof standing?.wins === 'number' ? standing.wins : 0,
      losses: typeof standing?.losses === 'number' ? standing.losses : 0,
      pts: typeof standing?.pts === 'number' ? standing.pts : 0,
      buchholz: typeof standing?.buchholz === 'number' ? standing.buchholz : 0,
    })),
    discordLink: registration.discordLink || data?.discordLink || '',
    formLink: registration.formLink || data?.formLink || '',
    maxParticipants: typeof registration.maxParticipants === 'number'
      ? registration.maxParticipants
      : typeof data?.maxParticipants === 'number' ? data.maxParticipants : 16,
    currentParticipants: typeof registration.currentParticipants === 'number'
      ? registration.currentParticipants
      : typeof data?.currentParticipants === 'number' ? data.currentParticipants : 0,
  }

  return normalized
}

export const siteService = {
  async getLiveNews(): Promise<LiveNewsItem[]> {
    const { data } = await api.get<LiveNewsItem[]>('/api/site/news')
    return data
  },
  async getNewsDrafts(): Promise<NewsDraft[]> {
    const { data } = await api.get<NewsDraft[]>('/api/site/news/drafts')
    return data
  },
  async publishNews(id: string): Promise<void> {
    await api.post(`/api/site/news/publish/${id}`)
  },
  async rejectNews(id: string, note: string): Promise<void> {
    await api.post(`/api/site/news/reject/${id}`, { note })
  },
  async deleteNewsDraft(id: string): Promise<void> {
    await api.delete(`/api/site/news/draft/${id}`)
  },
  async createNewsDraft(body: { title: string; content: string; image: string; video_id: string }): Promise<NewsDraft> {
    const { data } = await api.post<NewsDraft>('/api/site/news/draft', body)
    return data
  },
  async submitNewsDraft(id: string): Promise<NewsDraft> {
    const { data } = await api.post<NewsDraft>(`/api/site/news/submit/${id}`)
    return data
  },
  async updateNewsDraft(id: string, body: Partial<Pick<NewsDraft, 'title' | 'content' | 'image' | 'video_id'>>): Promise<NewsDraft> {
    const { data } = await api.put<NewsDraft>(`/api/site/news/draft/${id}`, body)
    return data
  },
  async editLiveNews(publishedId: string, body: { title: string; content: string; image: string; video_id: string; date?: string }): Promise<void> {
    await api.put(`/api/site/news/live/${publishedId}`, body)
  },
  async deleteLiveNews(publishedId: string): Promise<void> {
    await api.delete(`/api/site/news/live/${publishedId}`)
  },
  async getTeamGallery(teamId: string): Promise<TeamGallery> {
    const { data } = await api.get<TeamGallery>(`/api/gallery/team/${teamId}`)
    return data
  },
  async deleteGalleryItem(id: string): Promise<void> {
    await api.delete(`/api/gallery/${id}`)
  },
  async getAssets(): Promise<{ teams: SiteAssetsTeam[] }> {
    const { data } = await api.get<{ teams: SiteAssetsTeam[] } | SiteAssetsTeam[]>('/api/site/assets')
    return Array.isArray(data) ? { teams: data } : data
  },
  async getClips(): Promise<SiteClip[]> {
    const { data } = await api.get<SiteClip[]>('/api/site/clips')
    return data
  },
  async deleteClip(id: string): Promise<void> {
    await api.delete(`/api/site/clips/${id}`)
  },
  async uploadWebsiteContentImage(section: 'staff' | 'trophies' | 'creators' | 'news', file: File): Promise<SiteUploadResult> {
    const body = new FormData()
    body.append('file', file)

    const { data } = await api.post<SiteUploadResult>(`/api/site/upload?section=${section}`, body)
    return data
  },
  async getStaff(): Promise<unknown[]> {
    const { data } = await api.get('/api/site/about/staff')
    return data
  },
  async saveStaff(items: unknown[]): Promise<void> {
    await api.put('/api/site/about/staff', { data: items })
  },
  async getTrophies(): Promise<unknown[]> {
    const { data } = await api.get('/api/site/about/trophies')
    return data
  },
  async saveTrophies(items: unknown[]): Promise<void> {
    await api.put('/api/site/about/trophies', { data: items })
  },
  async getHistory(): Promise<unknown[]> {
    const { data } = await api.get('/api/site/about/history')
    return data
  },
  async saveHistory(items: unknown[]): Promise<void> {
    await api.put('/api/site/about/history', { data: items })
  },
  async getHallOfFame(): Promise<unknown[]> {
    const { data } = await api.get('/api/site/about/hall-of-fame')
    return data
  },
  async saveHallOfFame(items: unknown[]): Promise<void> {
    await api.put('/api/site/about/hall-of-fame', { data: items })
  },
  async getCreators(): Promise<unknown[]> {
    const { data } = await api.get('/api/site/about/creators')
    return data
  },
  async saveCreators(items: unknown[]): Promise<void> {
    await api.put('/api/site/about/creators', { data: items })
  },
  async getAllRosters(): Promise<RosterTeam[]> {
    const { data } = await api.get<RosterTeam[]>('/api/site/roster/all')
    return data
  },
  async getLpRosterTeams(): Promise<RosterLinkOption[]> {
    const { data } = await api.get<RosterLinkOption[]>('/api/site/roster/lp-teams')
    return Array.isArray(data) ? data : []
  },
  async linkRosterTeam(teamId: string, body: { region: string | null; teamIndex: number | null }): Promise<void> {
    await api.post('/api/site/roster/link', { teamId, ...body })
  },
  async saveRosterTeam(teamId: string, body: { players: RosterMember[]; coaches: RosterMember[] }): Promise<RosterTeam> {
    const { data } = await api.put<{ team: RosterTeam }>(`/api/site/roster/${teamId}`, body)
    return data.team
  },
  async syncRosterFromHub(teamId: string): Promise<RosterTeam> {
    const { data } = await api.post<{ team: RosterTeam }>(`/api/site/roster/${teamId}/sync-hub`)
    return data.team
  },
  async pullRosterTeam(teamId: string): Promise<RosterTeam> {
    const { data } = await api.post<{ team: RosterTeam }>(`/api/site/roster/${teamId}/pull`)
    return data.team
  },
  async pushRosterTeam(teamId: string): Promise<RosterTeam> {
    const { data } = await api.post<{ team: RosterTeam }>(`/api/site/roster/${teamId}/push`)
    return data.team
  },
  async pullAllRosters(): Promise<RosterBulkResult[]> {
    const { data } = await api.post<{ results: RosterBulkResult[] }>('/api/site/roster/pull-all')
    return Array.isArray(data.results) ? data.results : []
  },
  async pushAllRosters(): Promise<RosterBulkResult[]> {
    const { data } = await api.post<{ results: RosterBulkResult[] }>('/api/site/roster/push-all')
    return Array.isArray(data.results) ? data.results : []
  },
  async getPraccSchedule(): Promise<ScheduleEvent[]> {
    const { data } = await api.get<ScheduleEvent[]>('/api/schedule/pracc')
    return data
  },
  async getCobblemonVip(): Promise<CobblemonVip> {
    const { data } = await api.get<CobblemonVip>('/api/cobblemon/vip')
    return normalizeCobblemonVip(data)
  },
  async getCobblemonLeague(): Promise<CobblemonLeague> {
    const { data } = await api.get<CobblemonLeague>('/api/cobblemon/league')
    return normalizeCobblemonLeague(data)
  },
  async getCobblemonRegistrations(season?: number): Promise<CobblemonRegistrationsResponse> {
    const { data } = await api.get<CobblemonRegistrationsResponse>('/api/cobblemon/registrations', {
      params: season ? { season } : undefined,
    })
    return {
      season: data.season,
      registrations: Array.isArray(data.registrations) ? data.registrations : [],
    }
  },
  async updateCobblemonRegistrationStatus(discordId: string, status: CobblemonRegistrationStatus): Promise<{ registration: CobblemonRegistrationRecord; currentParticipants: number }> {
    const { data } = await api.patch<{ registration: CobblemonRegistrationRecord; currentParticipants: number }>(`/api/cobblemon/registrations/${discordId}`, { status })
    return data
  },
  async saveCobblemonVip(vip: CobblemonVip): Promise<CobblemonVip> {
    const payload = normalizeCobblemonVip(vip)
    const { data } = await api.put<{ data?: CobblemonVip }>('/api/cobblemon/vip', payload)
    return normalizeCobblemonVip(data?.data || payload)
  },
  async saveCobblemonLeague(league: CobblemonLeague): Promise<CobblemonLeague> {
    const payload = normalizeCobblemonLeague(league)
    const { data } = await api.put<{ data?: CobblemonLeague }>('/api/cobblemon/league', payload)
    return normalizeCobblemonLeague(data?.data || payload)
  },
}
