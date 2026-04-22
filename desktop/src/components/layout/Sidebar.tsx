import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Film,
  Globe,
  History,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  LogOut,
  Map,
  Megaphone,
  Settings,
  Shield,
  Star,
  Trophy,
  Users,
  Gamepad2,
  Newspaper,
  List,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { areaForRole, areaFromPath, areaLabel, type HubArea } from '@/lib/roleRoutes'
import { useAuthStore } from '@/stores/authStore'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface NavSection {
  title: string
  items: NavItem[]
}

const SOCIAL_SECTIONS: NavSection[] = [
  {
    title: 'Content',
    items: [
      { label: 'Social', path: '/social', icon: <Globe size={17} /> },
    ],
  },
]

const OWNER_SECTIONS: NavSection[] = [
  {
    title: 'Hub',
    items: [
      { label: 'Dashboard', path: '/owner', icon: <LayoutDashboard size={17} /> },
      { label: 'Teams', path: '/owner/teams', icon: <Users size={17} /> },
      { label: 'Managers', path: '/owner/managers', icon: <Star size={17} /> },
      { label: 'Team Stats', path: '/owner/stats', icon: <BarChart3 size={17} /> },
    ],
  },
  {
    title: 'Website Content',
    items: [
      { label: 'News', path: '/owner/news', icon: <Newspaper size={17} /> },
      { label: 'Assets & Gallery', path: '/owner/gallery', icon: <Image size={17} /> },
      { label: 'Website Content', path: '/owner/staff', icon: <LayoutTemplate size={17} /> },
      { label: 'Rosters', path: '/owner/rosters', icon: <List size={17} /> },
      { label: 'Clips / Fanbase', path: '/owner/clips', icon: <Film size={17} /> },
      { label: 'Next Matches', path: '/owner/matches', icon: <CalendarDays size={17} /> },
      { label: 'Cobblemon', path: '/owner/cobblemon', icon: <Gamepad2 size={17} /> },
    ],
  },
  {
    title: 'Access',
    items: [
      { label: 'Invites', path: '/owner/invites', icon: <Link2 size={17} /> },
    ],
  },
]

function workspaceSections(area: HubArea): NavSection[] {
  const prefix = `/${area}`
  const sections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: `${prefix}/dashboard`, icon: <LayoutDashboard size={17} /> },
      ],
    },
    {
      title: 'Team',
      items: [
        { label: 'Announcements', path: `${prefix}/announcements`, icon: <Megaphone size={17} /> },
        { label: 'Tasks', path: `${prefix}/tasks`, icon: <ClipboardList size={17} /> },
        { label: 'Schedule', path: `${prefix}/schedule`, icon: <CalendarDays size={17} /> },
      ],
    },
    {
      title: 'Competitive',
      items: [
        { label: 'Pracc History', path: `${prefix}/pracc-history`, icon: <History size={17} /> },
        { label: 'Pracc Stats', path: `${prefix}/pracc-stats`, icon: <BarChart3 size={17} /> },
        { label: 'Strategy Board', path: `${prefix}/board`, icon: <Map size={17} /> },
        { label: 'Individual', path: `${prefix}/individual`, icon: <Shield size={17} /> },
      ],
    },
    {
      title: 'Media',
      items: [
        { label: 'Gallery', path: `${prefix}/gallery`, icon: <Image size={17} /> },
      ],
    },
  ]

  if (area === 'manager') {
    sections.push({
      title: 'Management',
      items: [
        { label: 'Players', path: `${prefix}/players`, icon: <Users size={17} /> },
        { label: 'Invite Codes', path: `${prefix}/invites`, icon: <Link2 size={17} /> },
        { label: 'Team Settings', path: `${prefix}/team-settings`, icon: <Trophy size={17} /> },
      ],
    })
  }

  return sections
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, hub, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const isOwner = user?.role === 'owner'
  const isSocial = user?.role === 'social'
  const activeArea = areaFromPath(location.pathname) ?? areaForRole(user?.role) ?? 'player'

  const sections = useMemo(() => {
    if (isOwner) return OWNER_SECTIONS
    if (isSocial) return SOCIAL_SECTIONS
    return workspaceSections(activeArea)
  }, [activeArea, isOwner, isSocial])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-2 py-2 text-sm font-medium transition-[background-color,color] duration-200',
      isActive ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
    )

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 228 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-bg-secondary"
    >
      <div className="flex h-14 items-center border-b border-border px-3 shrink-0">
        <div className={cn('flex w-full items-center overflow-hidden', collapsed ? 'justify-center' : 'gap-3')}>
          {!isOwner && !isSocial && (
            <div className="shrink-0">
              <Avatar src={hub?.teamLogo ?? undefined} name={hub?.teamName} size="sm" className="shrink-0" />
            </div>
          )}
          <motion.div
            animate={{ width: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="min-w-0 overflow-hidden"
          >
            <p className="truncate whitespace-nowrap text-sm font-semibold leading-tight text-text-primary">
              {isOwner || isSocial ? 'Lost Puppies HUB' : (hub?.teamName ?? 'LP-Hub')}
            </p>
            <p className="text-xs text-text-muted whitespace-nowrap">
              {isOwner || isSocial ? user?.role : `${areaLabel(activeArea)} area`}
            </p>
          </motion.div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.title || '__default'}>
            <motion.div
              animate={{
                height: collapsed || !section.title ? 0 : 'auto',
                opacity: collapsed || !section.title ? 0 : 1,
                marginBottom: collapsed || !section.title ? 0 : 4,
              }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <p className="px-2.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted whitespace-nowrap">
                {section.title}
              </p>
            </motion.div>

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink key={item.path} to={item.path} end className={navLinkClass}>
                  <SidebarItemInner collapsed={collapsed} icon={item.icon} label={item.label} />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-border px-2 py-3">
        <NavLink to="/settings" className={navLinkClass}>
          <SidebarItemInner collapsed={collapsed} icon={<Settings size={17} />} label="Settings" />
        </NavLink>

        <button
          onClick={() => { logout(); navigate('/login') }}
          className={cn(
            'w-full rounded-md px-2 py-2 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-danger/15 hover:text-danger'
          )}
        >
          <SidebarItemInner collapsed={collapsed} icon={<LogOut size={17} />} label="Logout" />
        </button>

        <button
          onClick={() => setCollapsed((value) => !value)}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-transparent py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-border hover:bg-bg-tertiary hover:text-text-primary"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} className="block">
            <ChevronLeft size={14} />
          </motion.span>
          <motion.span
            animate={{ width: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden whitespace-nowrap"
          >
            Collapse
          </motion.span>
        </button>
      </div>
    </motion.aside>
  )
}

function SidebarItemInner({
  collapsed,
  icon,
  label,
}: {
  collapsed: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <motion.div
      animate={{
        width: collapsed ? 20 : '100%',
        gridTemplateColumns: collapsed ? '20px 0fr' : '20px minmax(0, 1fr)',
      }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn('grid items-center overflow-hidden', collapsed ? 'mx-auto' : 'w-full')}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      <motion.span
        animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -6 : 0, paddingLeft: collapsed ? 0 : 12 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden whitespace-nowrap"
      >
        {label}
      </motion.span>
    </motion.div>
  )
}
