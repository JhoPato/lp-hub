import { api } from './api'
import type { LoginResponse, User, TeamInfo } from '@/types'

export const authService = {
  async login(emailOrUsername: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/api/auth/login', { email: emailOrUsername, password })
    return data
  },

  async register(inviteCode: string, username: string, email: string, password: string) {
    const { data } = await api.post<{ token: string; user: User }>(
      '/api/auth/register',
      { inviteCode, username, email, password }
    )
    return data
  },

  async selectTeam(tempToken: string, teamId: string) {
    const { data } = await api.post<{ token: string; user: User }>(
      '/api/auth/select-team',
      { teamId },
      { headers: { Authorization: `Bearer ${tempToken}` } }
    )
    return data
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>('/api/auth/me')
    return data
  },

  async getMyTeams(): Promise<TeamInfo[]> {
    const { data } = await api.get<{ teams: TeamInfo[] }>('/api/auth/my-teams')
    return data.teams
  },

  async loginWithDiscordToken(discordToken: string): Promise<{ token: string; user: User }> {
    // Discord OAuth already issues a signed JWT — just verify it's usable by calling /me
    const { data } = await api.get<User>('/api/auth/me', {
      headers: { Authorization: `Bearer ${discordToken}` },
    })
    return { token: discordToken, user: data }
  },
}
