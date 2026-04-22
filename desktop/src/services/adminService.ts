import { api } from './api'

export interface AdminStats {
  teamCount: number
  playerCount: number
  managerCount: number
  captainCount: number
  totalUsers: number
  inviteActive: number
  inviteUsed: number
  inviteExpired: number
  photoCount: number
  adminPhotoCount: number
  praccCount: number
}

export interface StorageInfo {
  usedMB: number
  limitGB?: number
  limitMB?: number
  pct: number
}

export interface AdminStorage {
  cloudinary: StorageInfo | null
  mongo: StorageInfo | null
}

export interface AdminTeam {
  _id: string
  name: string
  tag: string
  region: string
  game?: string
  logoUrl?: string
  playerCount: number
  managerName: string | null
  multiRegionEnabled?: boolean
}

export interface AdminManager {
  _id: string
  username: string
  email: string
  isActive: boolean
  discordUsername?: string
  discordAvatar?: string
  profilePhotoUrl?: string
  teamId?: { _id: string; name: string; tag: string; region: string } | null
  teamIds?: Array<{ _id: string; name: string; tag: string; region: string }>
  createdAt: string
}

export interface TeamStat {
  _id: string
  name: string
  tag: string
  region: string
  logoUrl?: string
  players: number
  captains: number
  managers: number
  noPhoto: number
  inactive: number
  galleryPhotos: number
  adminPhotos: number
  praccTotal: number
  praccWins: number
  praccLosses: number
  praccDraws: number
  winRate: number | null
  lastPracc: string | null
  tasksOpen: number
  tasksDone: number
  announcements: number
  pinnedAnnouncements: number
}

export interface InviteCode {
  _id: string
  code: string
  role: string
  teamId?: { _id: string; name: string; tag: string; region: string } | null
  isUsed: boolean
  expiresAt: string
  createdAt: string
  usedBy?: { username: string } | null
  createdBy?: { username: string } | null
}

export interface TeamPlayer {
  _id: string
  username: string
  email: string
  role: 'player' | 'captain' | 'manager'
  isActive: boolean
  discordAvatar?: string
  profilePhotoUrl?: string
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    const { data } = await api.get<AdminStats>('/api/admin/stats')
    return data
  },
  async getStorage(): Promise<AdminStorage> {
    const { data } = await api.get<AdminStorage>('/api/admin/storage')
    return data
  },
  async getTeams(): Promise<AdminTeam[]> {
    const { data } = await api.get<AdminTeam[]>('/api/admin/teams')
    return data
  },
  async createTeam(body: { name: string; tag: string; region: string; game?: string }): Promise<AdminTeam> {
    const { data } = await api.post<AdminTeam>('/api/admin/teams', body)
    return data
  },
  async updateTeam(id: string, body: Partial<AdminTeam>): Promise<AdminTeam> {
    const { data } = await api.put<AdminTeam>(`/api/admin/teams/${id}`, body)
    return data
  },
  async deleteTeam(id: string): Promise<void> {
    await api.delete(`/api/admin/teams/${id}`)
  },
  async getManagers(): Promise<AdminManager[]> {
    const { data } = await api.get<AdminManager[]>('/api/admin/managers')
    return data
  },
  async setManagerActive(id: string, isActive: boolean): Promise<AdminManager> {
    const { data } = await api.patch<AdminManager>(`/api/admin/managers/${id}/active`, { isActive })
    return data
  },
  async removeManagerFromTeam(userId: string, teamId: string): Promise<AdminManager> {
    const { data } = await api.patch<AdminManager>(`/api/admin/managers/${userId}/remove-team`, { teamId })
    return data
  },
  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/api/admin/users/${userId}`)
  },
  async getTeamPlayers(teamId: string): Promise<TeamPlayer[]> {
    const { data } = await api.get<TeamPlayer[]>(`/api/admin/teams/${teamId}/players`)
    return data
  },
  async updatePlayerRole(teamId: string, userId: string, role: string): Promise<TeamPlayer> {
    const { data } = await api.patch<TeamPlayer>(`/api/admin/teams/${teamId}/players/${userId}/role`, { role })
    return data
  },
  async togglePlayerActive(teamId: string, userId: string, isActive: boolean): Promise<TeamPlayer> {
    const { data } = await api.patch<TeamPlayer>(`/api/admin/teams/${teamId}/players/${userId}/active`, { isActive })
    return data
  },
  async getTeamInvites(teamId: string): Promise<InviteCode[]> {
    const { data } = await api.get<InviteCode[]>(`/api/admin/teams/${teamId}/invites`)
    return data
  },
  async generateTeamInvite(teamId: string, role: string): Promise<InviteCode> {
    const { data } = await api.post<InviteCode>(`/api/admin/teams/${teamId}/invite`, { role })
    return data
  },
  async toggleTeamFeature(teamId: string, multiRegionEnabled: boolean): Promise<void> {
    await api.patch(`/api/admin/teams/${teamId}/features`, { multiRegionEnabled })
  },
  async impersonate(teamId: string, role: 'manager' | 'player' | 'captain'): Promise<{ token: string; teamName: string; teamId: string; role: string }> {
    const { data } = await api.post(`/api/admin/impersonate/${teamId}`, { role })
    return data
  },
  async getTeamStats(): Promise<TeamStat[]> {
    const { data } = await api.get<TeamStat[]>('/api/admin/team-stats')
    return data
  },
  async getInvites(): Promise<InviteCode[]> {
    const { data } = await api.get<InviteCode[]>('/api/invites')
    return data
  },
  async deleteInvite(id: string): Promise<void> {
    await api.delete(`/api/invites/${id}`)
  },
  async generateInvite(body: { role: string; teamId?: string; expiresInDays?: number }): Promise<InviteCode> {
    const { data } = await api.post<InviteCode>('/api/invites/generate', body)
    return data
  },
}
