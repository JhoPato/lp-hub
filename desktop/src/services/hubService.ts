import { api } from './api'

export interface AnnouncementItem {
  _id: string
  title: string
  body: string
  isPinned: boolean
  createdAt: string
}

export interface HubUserRef {
  username?: string
}

export interface HubTask {
  _id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed'
  dueDate?: string | null
  assignedTo?: HubUserRef[]
  createdAt: string
}

export interface HubTasksResponse {
  tasks: HubTask[]
  total: number
  page: number
  pages: number
}

export interface HubScheduleEvent {
  _id: string
  title: string
  type: 'pracc' | 'tournament' | 'warmup' | 'other'
  startTime?: string
  endTime?: string
  date: string
  opponent?: string
  streamUrl?: string
  notes?: string
  teamId?:
    | string
    | {
        name?: string
        tag?: string
        region?: string
        logoUrl?: string
        logos?: { main?: { url?: string } }
      }
}

export interface HubTeamMember {
  _id: string
  username: string
  role: 'player' | 'captain' | 'manager' | 'social' | 'owner'
  isActive?: boolean
  profilePhotoUrl?: string
  discordAvatar?: string
}

export interface HubGoal {
  _id: string
  playerId: string
  minRanked: number
  minDM: number
  warmupMinutes: number
  playerRankedAdjust?: number
  playerDMAdjust?: number
}

export interface TodayProgress {
  hasRiotId: boolean
  ranked: number
  dm: number
}

export interface AllTeam {
  _id: string
  name: string
  tag: string
  region: string
  logoUrl?: string
  logos?: {
    main?: { url?: string }
  }
}

export interface PraccMatchesResponse {
  total?: number
}

export const hubService = {
  async getAnnouncements(limit = 30) {
    const { data } = await api.get<{ items: AnnouncementItem[] }>('/api/announcements', {
      params: { limit },
    })
    return data.items ?? []
  },

  async getTasks(params?: { status?: string; limit?: number; mine?: boolean }) {
    const { data } = await api.get<HubTasksResponse>('/api/tasks', {
      params: {
        status: params?.status,
        limit: params?.limit,
        mine: params?.mine,
      },
    })
    return data
  },

  async getSchedule(from: string, to: string) {
    const { data } = await api.get<HubScheduleEvent[]>('/api/schedule', {
      params: { from, to },
    })
    return data
  },

  async getTournamentSchedule(from: string, to: string) {
    const { data } = await api.get<HubScheduleEvent[]>('/api/schedule/tournament', {
      params: { from, to },
    })
    return data
  },

  async getPlayers() {
    const { data } = await api.get<HubTeamMember[]>('/api/team/players')
    return data
  },

  async getGoals() {
    const { data } = await api.get<{ goals: HubGoal[] }>('/api/goals')
    return data.goals ?? []
  },

  async getTodayProgress() {
    const { data } = await api.get<TodayProgress>('/api/henrik/player/today')
    return data
  },

  async getPraccMatches(limit = 1) {
    const { data } = await api.get<PraccMatchesResponse>('/api/pracc/matches', {
      params: { limit },
    })
    return data
  },

  async getAllTeams() {
    const { data } = await api.get<AllTeam[]>('/api/team/all')
    return data
  },
}
