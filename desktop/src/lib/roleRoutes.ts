import type { User } from '@/types'

export type HubArea = 'player' | 'captain' | 'manager'

export function areaForRole(role?: User['role'] | null): HubArea | null {
  if (role === 'manager') return 'manager'
  if (role === 'captain') return 'captain'
  if (role === 'player') return 'player'
  return null
}

export function homeRouteForRole(role?: User['role'] | null) {
  if (role === 'manager') return '/manager/dashboard'
  if (role === 'captain') return '/captain/dashboard'
  if (role === 'player') return '/player/dashboard'
  if (role === 'social') return '/social'
  if (role === 'owner') return '/owner'
  return '/login'
}

export function boardRouteForRole(role?: User['role'] | null) {
  if (role === 'manager') return '/manager/board'
  if (role === 'captain') return '/captain/board'
  if (role === 'player') return '/player/board'
  return homeRouteForRole(role)
}

export function areaFromPath(pathname: string): HubArea | null {
  if (pathname.startsWith('/manager')) return 'manager'
  if (pathname.startsWith('/captain')) return 'captain'
  if (pathname.startsWith('/player')) return 'player'
  return null
}

export function areaLabel(area: HubArea) {
  if (area === 'manager') return 'Manager'
  if (area === 'captain') return 'Captain'
  return 'Player'
}

export function routeForArea(area: HubArea, slug = 'dashboard') {
  return `/${area}/${slug}`
}
