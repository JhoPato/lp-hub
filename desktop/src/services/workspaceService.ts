import { api } from './api'

export interface WorkspaceAuthor {
  _id?: string
  username?: string
  role?: string
}

export interface WorkspaceAnnouncement {
  _id: string
  title: string
  body: string
  isPinned: boolean
  createdAt: string
  updatedAt?: string
  authorId?: WorkspaceAuthor
}

export interface WorkspaceAnnouncementResponse {
  items: WorkspaceAnnouncement[]
  total: number
  page: number
  pages: number
}

export interface WorkspaceTaskComment {
  _id?: string
  authorId?: string
  authorName?: string
  text: string
  createdAt?: string
}

export interface WorkspaceTaskUpload {
  _id?: string
  url: string
  publicId?: string
  caption?: string
  uploadedAt?: string
}

export interface WorkspaceTaskAssignee {
  _id?: string
  username?: string
}

export interface WorkspaceLinkedPracc {
  _id?: string
  opponent?: string
  date?: string
  vodUrl?: string
  result?: string
  mapName?: string
}

export interface WorkspaceTask {
  _id: string
  title: string
  description?: string
  category: 'general' | 'analysis' | 'preparation' | 'physical' | 'vod_review'
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed'
  dueDate?: string | null
  createdAt: string
  updatedAt?: string
  assignedTo: WorkspaceTaskAssignee[]
  createdBy?: WorkspaceAuthor
  comments?: WorkspaceTaskComment[]
  uploadedFiles?: WorkspaceTaskUpload[]
  requiresUpload?: boolean
  vodType?: 'none' | 'pracc' | 'external'
  linkedPraccId?: WorkspaceLinkedPracc | string | null
  externalVodUrl?: string | null
}

export interface WorkspaceTasksResponse {
  tasks: WorkspaceTask[]
  total: number
  page: number
  pages: number
}

export interface WorkspaceScheduleEvent {
  _id: string
  title: string
  type: 'pracc' | 'tournament' | 'warmup' | 'other'
  startTime?: string
  endTime?: string
  date: string
  notes?: string
  opponent?: string
  streamUrl?: string
  isRecurring?: boolean
  recurDays?: number[]
  dates?: string[]
}

export interface WorkspaceGalleryItem {
  _id: string
  url: string
  type: 'photo' | 'screenshot'
  caption?: string
  createdAt: string
  cloudinaryPublicId?: string
  uploadedBy?: {
    _id?: string
    username?: string
    role?: string
    profilePhotoUrl?: string
  }
}

export interface WorkspaceGalleryResponse {
  total?: number
  page?: number
  pages?: number
  matches?: unknown[]
  maps?: string[]
  playerStats?: WorkspacePraccPlayerStat[]
  econStats?: WorkspacePraccEconStats
}

export interface WorkspacePraccMatchSummary {
  _id: string
  date?: string
  result?: 'W' | 'L' | 'D'
  scoreUs?: number
  scoreThem?: number
  mapName?: string | null
  mapId?: string
  opponent?: string
  vodUrl?: string
  comments?: WorkspaceTaskComment[]
}

export interface WorkspacePraccListResponse {
  matches: WorkspacePraccMatchSummary[]
  total: number
  page: number
  pages: number
  maps: string[]
}

export interface WorkspacePraccPlayerMapBreakdown {
  mapName: string
  matchCount: number
  wins: number
  winRate: number
  acs: number
  kd: number
  kills: number
  deaths: number
  assists: number
  damagePerRound: number
  headshotPercent: number
}

export interface WorkspacePraccPlayerStat {
  gameName: string
  tagLine: string
  hubPlayerId?: string | null
  matchCount: number
  kills: number
  deaths: number
  assists: number
  acs: number
  kd: number
  kda: number
  damagePerRound: number
  headshotPercent: number
  kastPercent: number
  firstKills: number
  firstDeaths: number
  mk2: number
  mk3: number
  mk4: number
  mk5: number
  clutchesAttempted: number
  clutchesWon: number
  clutchRate: number
  matchResults: Array<{ date?: string; result?: string; mapName?: string; scoreUs?: number; scoreThem?: number }>
  mapBreakdown: WorkspacePraccPlayerMapBreakdown[]
}

export interface WorkspacePraccEconStats {
  pistolPlayed: number
  pistolWon: number
  pistolWR: number | null
  bonusPlayed: number
  bonusWon: number
  bonusWR: number | null
  ecoPlayed: number
  ecoWon: number
  ecoWR: number | null
  halfBuyPlayed: number
  halfBuyWon: number
  halfBuyWR: number | null
}

export interface WorkspacePraccStatsResponse {
  total: number
  matches: WorkspacePraccMatchSummary[]
  playerStats: WorkspacePraccPlayerStat[]
  econStats: WorkspacePraccEconStats
}

export interface WorkspaceTeam {
  _id: string
  name: string
  tag: string
  region: string
  logoUrl?: string
  hasHenrikKey?: boolean
  logos?: {
    main?: { url?: string }
  }
}

export interface WorkspacePlayer {
  _id: string
  username: string
  email?: string
  role: 'player' | 'captain' | 'manager' | 'social' | 'owner'
  isActive?: boolean
  profilePhotoUrl?: string
  discordAvatar?: string
  apiPanelPlayerName?: string | null
  riotGameName?: string | null
  riotTagLine?: string | null
  riotRegion?: string | null
}

export interface WorkspaceInvite {
  _id: string
  code: string
  role: 'player' | 'captain' | 'manager' | 'social' | 'owner'
  expiresAt: string
  createdAt: string
  isUsed: boolean
  usedBy?: { username?: string } | null
  createdBy?: { username?: string } | null
}

export interface ProfileMe {
  _id: string
  username: string
  email: string
  role: 'player' | 'captain' | 'manager' | 'social' | 'owner'
  profilePhotoUrl?: string
  discordAvatar?: string
  riotGameName?: string | null
  riotTagLine?: string | null
  riotRegion?: string | null
  riotGameName2?: string | null
  riotTagLine2?: string | null
  riotRegion2?: string | null
  teamId?: WorkspaceTeam | string | null
}

export interface TodayCounts {
  hasRiotId: boolean
  ranked: number
  dm: number
}

export interface TeamTodayPlayer extends TodayCounts {
  userId: string
  username: string
}

export interface TeamTodayResponse {
  players: TeamTodayPlayer[]
}

export interface RankedMatch {
  date?: string
  acs?: number
  kd?: number
  hsPercent?: number
  won?: boolean
  _account?: number
}

export interface RankedStatsResponse {
  riot?: { gameName?: string; tagLine?: string; region?: string }
  username?: string | null
  count: number
  acs: number
  kd: number
  hsPercent: number
  winRate: number
  matches: RankedMatch[]
}

export interface TrainingDay {
  date: string
  dm: number
  tdm: number
  kills: number
}

export interface TrainingStatsResponse {
  riot?: { gameName?: string; tagLine?: string; region?: string }
  username?: string | null
  days: TrainingDay[]
  days1?: TrainingDay[]
  days2?: TrainingDay[]
  totals: {
    dm: number
    tdm: number
  }
  avgKills: number
}

export interface HenrikSyncStatus {
  running?: boolean
  queueLength?: number
  current?: unknown
  waiting?: boolean
}

export const workspaceService = {
  async getAnnouncements(limit = 30, page = 1) {
    const { data } = await api.get<WorkspaceAnnouncementResponse>('/api/announcements', { params: { limit, page } })
    return data
  },
  async createAnnouncement(body: { title: string; body: string; isPinned?: boolean }) {
    const { data } = await api.post<WorkspaceAnnouncement>('/api/announcements', body)
    return data
  },
  async updateAnnouncement(id: string, body: { title: string; body: string }) {
    const { data } = await api.put<WorkspaceAnnouncement>(`/api/announcements/${id}`, body)
    return data
  },
  async toggleAnnouncementPin(id: string) {
    const { data } = await api.patch<WorkspaceAnnouncement>(`/api/announcements/${id}/pin`)
    return data
  },
  async deleteAnnouncement(id: string) {
    await api.delete(`/api/announcements/${id}`)
  },

  async getTasks(params?: { page?: number; limit?: number; status?: string; category?: string; mine?: boolean }) {
    const { data } = await api.get<WorkspaceTasksResponse>('/api/tasks', { params })
    return data
  },
  async createTask(body: Record<string, unknown>) {
    const { data } = await api.post<WorkspaceTask>('/api/tasks', body)
    return data
  },
  async updateTask(id: string, body: Record<string, unknown>) {
    const { data } = await api.put<WorkspaceTask>(`/api/tasks/${id}`, body)
    return data
  },
  async updateTaskStatus(id: string, status: WorkspaceTask['status']) {
    const { data } = await api.patch<WorkspaceTask>(`/api/tasks/${id}/status`, { status })
    return data
  },
  async deleteTask(id: string) {
    await api.delete(`/api/tasks/${id}`)
  },
  async addTaskComment(id: string, text: string) {
    const { data } = await api.post<WorkspaceTaskComment>(`/api/tasks/${id}/comments`, { text })
    return data
  },

  async getSchedule(from: string, to: string) {
    const { data } = await api.get<WorkspaceScheduleEvent[]>('/api/schedule', { params: { from, to } })
    return data
  },
  async createScheduleEvent(body: Record<string, unknown>) {
    const { data } = await api.post<WorkspaceScheduleEvent>('/api/schedule', body)
    return data
  },
  async deleteScheduleEvent(id: string) {
    await api.delete(`/api/schedule/${id}`)
  },

  async getPraccMatches(params?: { page?: number; limit?: number; result?: string; map?: string }) {
    const { data } = await api.get<WorkspacePraccListResponse>('/api/pracc/matches', { params })
    return data
  },
  async getPraccStats() {
    const { data } = await api.get<WorkspacePraccStatsResponse>('/api/pracc/matches/stats')
    return data
  },
  async importPraccMatch(file: File, body?: { opponent?: string; mapName?: string }) {
    const form = new FormData()
    form.append('matchJson', file)
    if (body?.opponent) form.append('opponent', body.opponent)
    if (body?.mapName) form.append('mapName', body.mapName)
    const { data } = await api.post<{ message: string; match: WorkspacePraccMatchSummary }>('/api/pracc/matches/import', form)
    return data
  },
  async updatePraccMatch(id: string, body: { opponent?: string; mapName?: string }) {
    const { data } = await api.put<{ message: string; match: WorkspacePraccMatchSummary }>(`/api/pracc/matches/${id}`, body)
    return data
  },
  async deletePraccMatch(id: string) {
    await api.delete(`/api/pracc/matches/${id}`)
  },

  async getGallery() {
    const { data } = await api.get<WorkspaceGalleryItem[]>('/api/gallery')
    return data
  },
  async uploadGallery(file: File, type: 'photo' | 'screenshot', caption = '') {
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    if (caption) form.append('caption', caption)
    const { data } = await api.post<WorkspaceGalleryItem>('/api/gallery/upload', form)
    return data
  },
  async deleteGalleryItem(id: string) {
    await api.delete(`/api/gallery/${id}`)
  },

  async getPlayers() {
    const { data } = await api.get<WorkspacePlayer[]>('/api/team/players')
    return data
  },
  async updatePlayerRole(userId: string, role: 'player' | 'captain' | 'manager') {
    const { data } = await api.patch<WorkspacePlayer>(`/api/team/players/${userId}/role`, { role })
    return data
  },
  async updatePlayerActive(userId: string, isActive: boolean) {
    const { data } = await api.patch<WorkspacePlayer>(`/api/team/players/${userId}/deactivate`, { isActive })
    return data
  },
  async updatePlayerPanelSync(userId: string, apiPanelPlayerName: string) {
    const { data } = await api.patch<WorkspacePlayer>(`/api/team/players/${userId}/panel-sync`, { apiPanelPlayerName })
    return data
  },

  async getInvites() {
    const { data } = await api.get<WorkspaceInvite[]>('/api/invites')
    return data
  },
  async generateInvite(body: { role: 'player' | 'captain' | 'manager'; expiresInDays: number }) {
    const { data } = await api.post<WorkspaceInvite>('/api/invites/generate', body)
    return data
  },
  async revokeInvite(id: string) {
    await api.delete(`/api/invites/${id}`)
  },

  async getTeam() {
    const { data } = await api.get<WorkspaceTeam>('/api/team')
    return data
  },
  async updateTeam(body: { name: string; tag: string; region: string }) {
    const { data } = await api.put<WorkspaceTeam>('/api/team', body)
    return data
  },
  async updateHenrikKey(henrikApiKey: string) {
    const { data } = await api.patch<{ ok: true; hasKey: boolean }>('/api/team/henrik-key', { henrikApiKey })
    return data
  },
  async uploadTeamLogo(file: File) {
    const form = new FormData()
    form.append('logo', file)
    const { data } = await api.patch<WorkspaceTeam>('/api/team/logo', form)
    return data
  },

  async getProfile() {
    const { data } = await api.get<ProfileMe>('/api/auth/me')
    return data
  },
  async updateProfile(body: { username: string; email: string }) {
    const { data } = await api.patch<ProfileMe>('/api/profile/me', body)
    return data
  },
  async uploadProfilePhoto(file: File) {
    const form = new FormData()
    form.append('photo', file)
    const { data } = await api.patch<{ profilePhotoUrl: string }>('/api/profile/photo', form)
    return data
  },
  async updateRiot(body: Record<string, unknown>) {
    const { data } = await api.patch('/api/profile/riot', body)
    return data
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.post('/api/auth/change-password', { currentPassword, newPassword })
    return data
  },

  async getTodayProgress(userId?: string) {
    const { data } = await api.get<TodayCounts>('/api/henrik/player/today', { params: userId ? { userId } : undefined })
    return data
  },
  async getTeamTodayProgress() {
    const { data } = await api.get<TeamTodayResponse>('/api/henrik/team/today')
    return data
  },
  async getRankedStats(userId?: string) {
    const { data } = await api.get<RankedStatsResponse>('/api/henrik/player/ranked', { params: userId ? { userId } : undefined })
    return data
  },
  async getTrainingStats(userId?: string) {
    const { data } = await api.get<TrainingStatsResponse>('/api/henrik/player/training', { params: userId ? { userId } : undefined })
    return data
  },
  async getHenrikSyncStatus() {
    const { data } = await api.get<HenrikSyncStatus>('/api/henrik/sync/status')
    return data
  },
  async runHenrikSync() {
    const { data } = await api.post<{ message: string }>('/api/henrik/sync/run')
    return data
  },
  async skipHenrikWait() {
    const { data } = await api.post<{ skipped: boolean; message: string }>('/api/henrik/sync/skip')
    return data
  },
}
