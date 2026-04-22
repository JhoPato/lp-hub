import { useLocation } from 'react-router-dom'
import { areaForRole, areaFromPath, type HubArea } from '@/lib/roleRoutes'
import { useAuthStore } from '@/stores/authStore'

export function useWorkspaceArea() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)

  const area = (areaFromPath(location.pathname) ?? areaForRole(user?.role)) as HubArea | null

  return {
    area,
    areaRole: area,
    isPlayerArea: area === 'player',
    isCaptainArea: area === 'captain',
    isManagerArea: area === 'manager',
    canManageWorkspace: area === 'manager',
    canLeadWorkspace: area === 'manager' || area === 'captain',
  }
}
