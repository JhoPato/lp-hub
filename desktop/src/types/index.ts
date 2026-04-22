export interface User {
  id: string
  _id?: string
  username: string
  email?: string
  profilePhotoUrl?: string
  discordAvatar?: string
  role: 'player' | 'captain' | 'manager' | 'social' | 'owner'
  teamId?: string
}

export interface TeamInfo {
  id: string
  name: string
  tag: string
  region: string
  logoUrl?: string
  role: User['role']
  active: boolean
}

// Stored in Zustand + electron-store after user picks a team
export interface ActiveHub {
  teamId: string
  teamName: string
  teamTag: string
  teamRegion: string
  teamLogo?: string
  role: User['role']
}

// /login response when user has exactly one team
export interface AuthResponse {
  token: string
  user: User
}

// /login response when user belongs to multiple teams
export interface MultiTeamAuthResponse {
  requiresTeamSelect: true
  tempToken: string
  teams: TeamInfo[]
  user: User
}

export type LoginResponse = AuthResponse | MultiTeamAuthResponse

declare global {
  interface Window {
    api: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
      }
      store: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
      }
      getVersion: () => Promise<string>
      discord: {
        auth: (opts: { action: 'login' | 'register'; inviteCode?: string }) => Promise<{ token: string }>
      }
    }
  }
}
