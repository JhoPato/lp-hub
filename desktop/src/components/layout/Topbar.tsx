import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/stores/authStore'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { user, hub, logout, impersonating, stopImpersonation } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleExitImpersonation = () => {
    stopImpersonation()
    navigate('/owner/teams')
  }

  return (
    <header className="flex flex-col border-b border-border bg-bg-secondary shrink-0">
      {impersonating && (
        <div className="flex items-center justify-between bg-warning/10 border-b border-warning/30 px-5 py-1.5">
          <span className="text-xs text-warning font-medium">
            Viewing as <span className="font-bold capitalize">{hub?.role}</span> — {hub?.teamName}
          </span>
          <button
            onClick={handleExitImpersonation}
            className="flex items-center gap-1.5 text-xs text-warning hover:text-warning/80 transition-colors"
          >
            <LogOut size={12} />
            Exit view
          </button>
        </div>
      )}
      <div className="flex h-14 items-center justify-between px-5">
      <h1 className="text-base font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications placeholder */}
        <button className="relative rounded-md p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors">
          <Bell size={18} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-tertiary transition-colors"
          >
            <Avatar src={user?.discordAvatar ?? user?.profilePhotoUrl} name={user?.username} size="sm" />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-text-primary leading-none">{user?.username}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{hub?.teamName}</p>
            </div>
            <ChevronDown size={14} className="text-text-muted" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-border bg-bg-secondary shadow-2xl py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium text-text-primary">{user?.username}</p>
                  <p className="text-xs text-text-muted">{user?.email}</p>
                  <Badge variant={hub?.role as 'owner' | 'manager' | 'player' | 'viewer'} className="mt-1">
                    {hub?.role}
                  </Badge>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/hub-select') }}
                  className="flex w-full items-center px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                >
                  Switch Hub
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout() }}
                  className="flex w-full items-center px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </header>
  )
}
