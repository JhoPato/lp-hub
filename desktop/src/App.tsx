import { useEffect, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { Titlebar } from '@/components/layout/Titlebar'
import { Skeleton } from '@/components/ui/Skeleton'
import { boardRouteForRole, homeRouteForRole } from '@/lib/roleRoutes'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const HubSelect = lazy(() => import('@/pages/HubSelect'))
const Board = lazy(() => import('@/pages/Board'))
const Manager = lazy(() => import('@/pages/Manager'))
const Player = lazy(() => import('@/pages/Player'))
const Captain = lazy(() => import('@/pages/Captain'))
const Announcements = lazy(() => import('@/pages/Announcements'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const SchedulePage = lazy(() => import('@/pages/SchedulePage'))
const PraccHistory = lazy(() => import('@/pages/PraccHistory'))
const PraccStats = lazy(() => import('@/pages/PraccStats'))
const Individual = lazy(() => import('@/pages/Individual'))
const Gallery = lazy(() => import('@/pages/Gallery'))
const Players = lazy(() => import('@/pages/Players'))
const InviteCodes = lazy(() => import('@/pages/InviteCodes'))
const TeamSettings = lazy(() => import('@/pages/TeamSettings'))
const Social = lazy(() => import('@/pages/Social'))
const Owner = lazy(() => import('@/pages/Owner'))
const OwnerTeams = lazy(() => import('@/pages/owner/OwnerTeams'))
const OwnerManagers = lazy(() => import('@/pages/owner/OwnerManagers'))
const OwnerTeamStats = lazy(() => import('@/pages/owner/OwnerTeamStats'))
const OwnerInvites = lazy(() => import('@/pages/owner/OwnerInvites'))
const OwnerNews = lazy(() => import('@/pages/owner/OwnerNews'))
const OwnerGallery = lazy(() => import('@/pages/owner/OwnerGallery'))
const OwnerStaff = lazy(() => import('@/pages/owner/OwnerStaff'))
const OwnerRosters = lazy(() => import('@/pages/owner/OwnerRosters'))
const OwnerClips = lazy(() => import('@/pages/owner/OwnerClips'))
const OwnerMatches = lazy(() => import('@/pages/owner/OwnerMatches'))
const OwnerCobblemon = lazy(() => import('@/pages/owner/OwnerCobblemon'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageFallback() {
  return (
    <div className="flex w-full flex-col gap-4 p-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function RequireAuth() {
  const { token, hub, user, isLoading } = useAuthStore()
  if (isLoading) return <PageFallback />
  if (!token) return <Navigate to="/login" replace />
  const teamless = user?.role === 'owner' || user?.role === 'social'
  if (!hub && !teamless) return <Navigate to="/hub-select" replace />
  return <Outlet />
}

function RequireToken() {
  const { token, isLoading } = useAuthStore()
  if (isLoading) return <PageFallback />
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireRole({ roles }: { roles: User['role'][] }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageFallback />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) {
    return <Navigate to={homeRouteForRole(user.role)} replace />
  }
  return <Outlet />
}

function FullPageOutlet() {
  return (
    <div className="flex w-full flex-1 overflow-hidden">
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </div>
  )
}

function AppLayout() {
  return (
    <div className="flex w-full flex-1 overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Suspense fallback={<PageFallback />}>
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </Suspense>
      </div>
    </div>
  )
}

function HomeRedirect() {
  const { token, user, hub, isLoading } = useAuthStore()
  if (isLoading) return <PageFallback />
  if (!token) return <Navigate to="/login" replace />
  if (user?.role === 'owner') return <Navigate to="/owner" replace />
  if (user?.role === 'social') return <Navigate to="/social" replace />
  if (!hub) return <Navigate to="/hub-select" replace />
  return <Navigate to={homeRouteForRole(user?.role)} replace />
}

function LegacyBoardRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={boardRouteForRole(user?.role)} replace />
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-primary font-sans text-text-primary">
      <Titlebar />
      <HashRouter>
        <div className="flex flex-1 overflow-hidden">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route element={<FullPageOutlet />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              <Route element={<RequireToken />}>
                <Route element={<FullPageOutlet />}>
                  <Route path="/hub-select" element={<HubSelect />} />
                </Route>
              </Route>

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/settings" element={<Settings />} />

                  <Route element={<RequireRole roles={['player']} />}>
                    <Route path="/player" element={<Navigate to="/player/dashboard" replace />} />
                    <Route path="/player/dashboard" element={<Player />} />
                    <Route path="/player/announcements" element={<Announcements />} />
                    <Route path="/player/tasks" element={<Tasks />} />
                    <Route path="/player/schedule" element={<SchedulePage />} />
                    <Route path="/player/pracc-history" element={<PraccHistory />} />
                    <Route path="/player/pracc-stats" element={<PraccStats />} />
                    <Route path="/player/board" element={<Board />} />
                    <Route path="/player/individual" element={<Individual />} />
                    <Route path="/player/gallery" element={<Gallery />} />
                    <Route path="/player/profile" element={<Navigate to="/settings" replace />} />
                  </Route>

                  <Route element={<RequireRole roles={['captain']} />}>
                    <Route path="/captain" element={<Navigate to="/captain/dashboard" replace />} />
                    <Route path="/captain/dashboard" element={<Captain />} />
                    <Route path="/captain/announcements" element={<Announcements />} />
                    <Route path="/captain/tasks" element={<Tasks />} />
                    <Route path="/captain/schedule" element={<SchedulePage />} />
                    <Route path="/captain/pracc-history" element={<PraccHistory />} />
                    <Route path="/captain/pracc-stats" element={<PraccStats />} />
                    <Route path="/captain/board" element={<Board />} />
                    <Route path="/captain/individual" element={<Individual />} />
                    <Route path="/captain/gallery" element={<Gallery />} />
                    <Route path="/captain/profile" element={<Navigate to="/settings" replace />} />
                  </Route>

                  <Route element={<RequireRole roles={['manager']} />}>
                    <Route path="/manager" element={<Navigate to="/manager/dashboard" replace />} />
                    <Route path="/manager/dashboard" element={<Manager />} />
                    <Route path="/manager/announcements" element={<Announcements />} />
                    <Route path="/manager/tasks" element={<Tasks />} />
                    <Route path="/manager/schedule" element={<SchedulePage />} />
                    <Route path="/manager/pracc-history" element={<PraccHistory />} />
                    <Route path="/manager/pracc-stats" element={<PraccStats />} />
                    <Route path="/manager/board" element={<Board />} />
                    <Route path="/manager/individual" element={<Individual />} />
                    <Route path="/manager/gallery" element={<Gallery />} />
                    <Route path="/manager/players" element={<Players />} />
                    <Route path="/manager/invites" element={<InviteCodes />} />
                    <Route path="/manager/team-settings" element={<TeamSettings />} />
                    <Route path="/manager/profile" element={<Navigate to="/settings" replace />} />
                  </Route>

                  <Route element={<RequireRole roles={['manager', 'captain', 'player']} />}>
                    <Route path="/board" element={<LegacyBoardRedirect />} />
                  </Route>

                  <Route element={<RequireRole roles={['social', 'owner']} />}>
                    <Route path="/social" element={<Social />} />
                  </Route>

                  <Route element={<RequireRole roles={['owner']} />}>
                    <Route path="/owner" element={<Owner />} />
                    <Route path="/owner/teams" element={<OwnerTeams />} />
                    <Route path="/owner/managers" element={<OwnerManagers />} />
                    <Route path="/owner/stats" element={<OwnerTeamStats />} />
                    <Route path="/owner/invites" element={<OwnerInvites />} />
                    <Route path="/owner/news" element={<OwnerNews />} />
                    <Route path="/owner/gallery" element={<OwnerGallery />} />
                    <Route path="/owner/staff" element={<OwnerStaff />} />
                    <Route path="/owner/rosters" element={<OwnerRosters />} />
                    <Route path="/owner/clips" element={<OwnerClips />} />
                    <Route path="/owner/matches" element={<OwnerMatches />} />
                    <Route path="/owner/cobblemon" element={<OwnerCobblemon />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </Suspense>
        </div>
      </HashRouter>
    </div>
  )
}
