import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Save, Plus, Pencil, Trash2, GripVertical, Check, UploadCloud, X, ImagePlus, Loader2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { siteService } from '@/services/siteService'
import { cn } from '@/lib/utils'

type SectionId = 'staff' | 'trophies' | 'history' | 'hof' | 'creators'
type UploadSection = 'staff' | 'trophies' | 'creators'

export interface StaffItem { name: string; role: string; country: string; avatar: string; twitter: string; discord: string }
export interface TrophyItem { title: string; team: string; placement: string; date: string; image: string }
export interface HistoryItem { team: string; region: string; from: string; to: string; players: string[]; coaches: string[]; notes: string }
export interface HofItem { name: string; country: string; role: string; period: string }
export interface SocialEntry { url: string; enabled: boolean }
export interface CreatorItem { name: string; country: string; avatar: string; socials: Record<string, SocialEntry> }

const CREATOR_NETWORKS = ['twitter', 'twitch', 'youtube', 'tiktok', 'instagram', 'kick'] as const

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'staff', label: 'Staff' },
  { id: 'trophies', label: 'Trophies' },
  { id: 'history', label: 'History' },
  { id: 'hof', label: 'Hall of Fame' },
  { id: 'creators', label: 'Creators' },
]

const COUNTRIES: [string, string][] = [
  ['br', 'Brazil'], ['us', 'USA'], ['gb', 'United Kingdom'], ['gb-eng', 'England'], ['gb-wls', 'Wales'],
  ['gb-sct', 'Scotland'], ['ar', 'Argentina'], ['cl', 'Chile'], ['co', 'Colombia'], ['mx', 'Mexico'],
  ['pt', 'Portugal'], ['es', 'Spain'], ['fr', 'France'], ['de', 'Germany'], ['it', 'Italy'],
  ['tr', 'Turkey'], ['kr', 'South Korea'], ['jp', 'Japan'], ['au', 'Australia'], ['ca', 'Canada'],
  ['pl', 'Poland'], ['se', 'Sweden'], ['dk', 'Denmark'], ['no', 'Norway'], ['ru', 'Russia'],
  ['cn', 'China'], ['il', 'Israel'], ['sa', 'Saudi Arabia'],
]

const empty = {
  staff: (): StaffItem => ({ name: '', role: '', country: 'br', avatar: '', twitter: '', discord: '' }),
  trophies: (): TrophyItem => ({ title: '', team: '', placement: '', date: '', image: '' }),
  history: (): HistoryItem => ({ team: '', region: '', from: '', to: '', players: [], coaches: [], notes: '' }),
  hof: (): HofItem => ({ name: '', country: 'br', role: '', period: '' }),
  creators: (): CreatorItem => ({
    name: '',
    country: 'br',
    avatar: '',
    socials: Object.fromEntries(CREATOR_NETWORKS.map((network) => [network, { url: '', enabled: false }])) as Record<string, SocialEntry>,
  }),
}

export default function OwnerSiteContent() {
  const [activeTab, setActiveTab] = useState<SectionId>('staff')

  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [trophyList, setTrophyList] = useState<TrophyItem[]>([])
  const [historyList, setHistoryList] = useState<HistoryItem[]>([])
  const [hofList, setHofList] = useState<HofItem[]>([])
  const [creatorList, setCreatorList] = useState<CreatorItem[]>([])

  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState<Partial<Record<SectionId, boolean>>>({})
  const [saving, setSaving] = useState<Partial<Record<SectionId, boolean>>>({})
  const [saved, setSaved] = useState<Partial<Record<SectionId, boolean>>>({})

  const [modal, setModal] = useState<{ tab: SectionId; idx: number } | null>(null)
  const [formData, setFormData] = useState<unknown>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [r1, r2, r3, r4, r5] = await Promise.allSettled([
      siteService.getStaff(),
      siteService.getTrophies(),
      siteService.getHistory(),
      siteService.getHallOfFame(),
      siteService.getCreators(),
    ])
    if (r1.status === 'fulfilled') setStaffList(r1.value as StaffItem[])
    if (r2.status === 'fulfilled') setTrophyList(r2.value as TrophyItem[])
    if (r3.status === 'fulfilled') setHistoryList(r3.value as HistoryItem[])
    if (r4.status === 'fulfilled') setHofList(r4.value as HofItem[])
    if (r5.status === 'fulfilled') setCreatorList(r5.value as CreatorItem[])
    setDirty({})
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markDirty = (tab: SectionId) => setDirty((prev) => ({ ...prev, [tab]: true }))

  const saveSection = async (tab: SectionId) => {
    const map: Record<SectionId, unknown[]> = {
      staff: staffList,
      trophies: trophyList,
      history: historyList,
      hof: hofList,
      creators: creatorList,
    }

    const savers: Record<SectionId, (data: unknown[]) => Promise<void>> = {
      staff: siteService.saveStaff.bind(siteService),
      trophies: siteService.saveTrophies.bind(siteService),
      history: siteService.saveHistory.bind(siteService),
      hof: siteService.saveHallOfFame.bind(siteService),
      creators: siteService.saveCreators.bind(siteService),
    }

    setSaving((prev) => ({ ...prev, [tab]: true }))
    try {
      await savers[tab](map[tab])
      setDirty((prev) => ({ ...prev, [tab]: false }))
      setSaved((prev) => ({ ...prev, [tab]: true }))
      setTimeout(() => setSaved((prev) => ({ ...prev, [tab]: false })), 2000)
    } finally {
      setSaving((prev) => ({ ...prev, [tab]: false }))
    }
  }

  const openAdd = (tab: SectionId) => {
    setFormData(empty[tab]())
    setModal({ tab, idx: -1 })
  }

  const openEdit = (tab: SectionId, idx: number) => {
    const lists: Record<SectionId, unknown[]> = {
      staff: staffList,
      trophies: trophyList,
      history: historyList,
      hof: hofList,
      creators: creatorList,
    }
    setFormData(JSON.parse(JSON.stringify(lists[tab][idx])))
    setModal({ tab, idx })
  }

  const saveEntry = () => {
    if (!modal) return

    const { tab, idx } = modal
    const update = <T,>(list: T[], setter: (next: T[]) => void) => {
      const next = [...list]
      if (idx === -1) next.push(formData as T)
      else next[idx] = formData as T
      setter(next)
      markDirty(tab)
      setModal(null)
    }

    if (tab === 'staff') update(staffList, setStaffList)
    if (tab === 'trophies') update(trophyList, setTrophyList)
    if (tab === 'history') update(historyList, setHistoryList)
    if (tab === 'hof') update(hofList, setHofList)
    if (tab === 'creators') update(creatorList, setCreatorList)
  }

  const removeEntry = (tab: SectionId, idx: number) => {
    if (!confirm('Remove this entry?')) return
    if (tab === 'staff') {
      setStaffList((prev) => prev.filter((_, index) => index !== idx))
      markDirty(tab)
    }
    if (tab === 'trophies') {
      setTrophyList((prev) => prev.filter((_, index) => index !== idx))
      markDirty(tab)
    }
    if (tab === 'history') {
      setHistoryList((prev) => prev.filter((_, index) => index !== idx))
      markDirty(tab)
    }
    if (tab === 'hof') {
      setHofList((prev) => prev.filter((_, index) => index !== idx))
      markDirty(tab)
    }
    if (tab === 'creators') {
      setCreatorList((prev) => prev.filter((_, index) => index !== idx))
      markDirty(tab)
    }
  }

  const counts: Record<SectionId, number> = {
    staff: staffList.length,
    trophies: trophyList.length,
    history: historyList.length,
    hof: hofList.length,
    creators: creatorList.length,
  }

  const addLabels: Record<SectionId, string> = {
    staff: 'Add Staff',
    trophies: 'Add Trophy',
    history: 'Add Entry',
    hof: 'Add Member',
    creators: 'Add Creator',
  }

  return (
    <PageWrapper title="Website Content">
      <div className="w-full space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 rounded-lg border border-border bg-bg-tertiary p-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === section.id ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-primary'
                )}
              >
                {section.label}
                {!loading && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                      activeTab === section.id ? 'bg-white/20' : 'bg-bg-primary text-text-muted'
                    )}
                  >
                    {counts[section.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {saved[activeTab] && (
              <span className="flex items-center gap-1 text-xs text-success"><Check size={12} /> Saved</span>
            )}
            {dirty[activeTab] && (
              <Button size="sm" onClick={() => saveSection(activeTab)} loading={!!saving[activeTab]}>
                <Save size={13} /> Save and Publish
              </Button>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <Button size="sm" variant="secondary" onClick={() => openAdd(activeTab)}>
              <Plus size={13} /> {addLabels[activeTab]}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'staff' && <StaffList items={staffList} onEdit={(index) => openEdit('staff', index)} onRemove={(index) => removeEntry('staff', index)} onReorder={(next) => { setStaffList(next); markDirty('staff') }} />}
            {activeTab === 'trophies' && <TrophiesList items={trophyList} onEdit={(index) => openEdit('trophies', index)} onRemove={(index) => removeEntry('trophies', index)} onReorder={(next) => { setTrophyList(next); markDirty('trophies') }} />}
            {activeTab === 'history' && <HistoryList items={historyList} onEdit={(index) => openEdit('history', index)} onRemove={(index) => removeEntry('history', index)} onReorder={(next) => { setHistoryList(next); markDirty('history') }} />}
            {activeTab === 'hof' && <HofList items={hofList} onEdit={(index) => openEdit('hof', index)} onRemove={(index) => removeEntry('hof', index)} onReorder={(next) => { setHofList(next); markDirty('hof') }} />}
            {activeTab === 'creators' && <CreatorsList items={creatorList} onEdit={(index) => openEdit('creators', index)} onRemove={(index) => removeEntry('creators', index)} onReorder={(next) => { setCreatorList(next); markDirty('creators') }} />}
          </>
        )}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? (modal.idx === -1 ? addLabels[modal.tab] : `Edit ${SECTIONS.find((section) => section.id === modal.tab)?.label}`) : ''}
        className="max-w-2xl"
      >
        {modal?.tab === 'staff' && <StaffForm data={formData as StaffItem} onChange={setFormData} onSave={saveEntry} onCancel={() => setModal(null)} />}
        {modal?.tab === 'trophies' && <TrophyForm data={formData as TrophyItem} onChange={setFormData} onSave={saveEntry} onCancel={() => setModal(null)} />}
        {modal?.tab === 'history' && <HistoryForm data={formData as HistoryItem} onChange={setFormData} onSave={saveEntry} onCancel={() => setModal(null)} />}
        {modal?.tab === 'hof' && <HofForm data={formData as HofItem} onChange={setFormData} onSave={saveEntry} onCancel={() => setModal(null)} />}
        {modal?.tab === 'creators' && <CreatorForm data={formData as CreatorItem} onChange={setFormData} onSave={saveEntry} onCancel={() => setModal(null)} />}
      </Modal>
    </PageWrapper>
  )
}

function useDragSort<T>(items: T[], onReorder: (next: T[]) => void) {
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const onDragStart = (index: number) => (event: React.DragEvent) => {
    dragIdx.current = index
    event.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (index: number) => (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setOverIdx(index)
  }

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const from = dragIdx.current
    if (from !== null && overIdx !== null && from !== overIdx) {
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(overIdx, 0, moved)
      onReorder(next)
    }
    dragIdx.current = null
    setOverIdx(null)
  }

  const onDragEnd = () => {
    dragIdx.current = null
    setOverIdx(null)
  }

  return { overIdx, onDragStart, onDragOver, onDrop, onDragEnd }
}

interface EntryCardProps {
  children: React.ReactNode
  onEdit: () => void
  onRemove: () => void
  draggable?: boolean
  isOver?: boolean
  onDragStart?: (event: React.DragEvent) => void
  onDragOver?: (event: React.DragEvent) => void
  onDrop?: (event: React.DragEvent) => void
  onDragEnd?: (event: React.DragEvent) => void
}

function EntryCard({ children, onEdit, onRemove, draggable, isOver, onDragStart, onDragOver, onDrop, onDragEnd }: EntryCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex select-none items-center gap-3 rounded-lg border bg-bg-tertiary px-3 py-2.5 transition-colors',
        isOver ? 'border-accent' : 'border-border hover:border-border/80'
      )}
    >
      <GripVertical size={14} className="shrink-0 text-text-muted/40" />
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onEdit} className="rounded p-1.5 text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"><Pencil size={13} /></button>
        <button onClick={onRemove} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-text-muted">No {label} yet.</p>
}

function StaffList({ items, onEdit, onRemove, onReorder }: { items: StaffItem[]; onEdit: (index: number) => void; onRemove: (index: number) => void; onReorder: (next: StaffItem[]) => void }) {
  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort(items, onReorder)
  if (!items.length) return <EmptyState label="staff members" />

  return (
    <div className="space-y-1.5">
      {items.map((staff, index) => (
        <EntryCard
          key={index}
          draggable
          isOver={overIdx === index}
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver(index)}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onEdit={() => onEdit(index)}
          onRemove={() => onRemove(index)}
        >
          <div className="flex items-center gap-3">
            <Avatar src={staff.avatar} name={staff.name} size="sm" className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{staff.name || '-'}</p>
              <p className="truncate text-xs text-text-muted">{[staff.role, staff.country].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </EntryCard>
      ))}
    </div>
  )
}

function TrophiesList({ items, onEdit, onRemove, onReorder }: { items: TrophyItem[]; onEdit: (index: number) => void; onRemove: (index: number) => void; onReorder: (next: TrophyItem[]) => void }) {
  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort(items, onReorder)
  if (!items.length) return <EmptyState label="trophies" />

  return (
    <div className="space-y-1.5">
      {items.map((trophy, index) => (
        <EntryCard
          key={index}
          draggable
          isOver={overIdx === index}
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver(index)}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onEdit={() => onEdit(index)}
          onRemove={() => onRemove(index)}
        >
          <div className="flex items-center gap-3">
            {trophy.image ? (
              <img src={trophy.image} alt="" className="h-12 w-16 shrink-0 rounded-lg border border-border object-cover" />
            ) : (
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-bg-primary text-text-muted">
                <ImagePlus size={14} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{trophy.title || '-'}</p>
              <p className="truncate text-xs text-text-muted">{[trophy.team, trophy.placement, trophy.date].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </EntryCard>
      ))}
    </div>
  )
}

function HistoryList({ items, onEdit, onRemove, onReorder }: { items: HistoryItem[]; onEdit: (index: number) => void; onRemove: (index: number) => void; onReorder: (next: HistoryItem[]) => void }) {
  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort(items, onReorder)
  if (!items.length) return <EmptyState label="history entries" />

  return (
    <div className="space-y-1.5">
      {items.map((entry, index) => (
        <EntryCard
          key={index}
          draggable
          isOver={overIdx === index}
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver(index)}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onEdit={() => onEdit(index)}
          onRemove={() => onRemove(index)}
        >
          <p className="text-sm font-medium text-text-primary">
            {entry.team || '-'}
            {entry.region && <span className="ml-1.5 text-xs font-normal text-text-muted">({entry.region})</span>}
          </p>
          <p className="text-xs text-text-muted">
            {[
              entry.from && entry.to ? `${entry.from} -> ${entry.to}` : (entry.from || entry.to),
              (entry.players || []).join(', '),
            ].filter(Boolean).join(' · ')}
          </p>
        </EntryCard>
      ))}
    </div>
  )
}

function HofList({ items, onEdit, onRemove, onReorder }: { items: HofItem[]; onEdit: (index: number) => void; onRemove: (index: number) => void; onReorder: (next: HofItem[]) => void }) {
  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort(items, onReorder)
  if (!items.length) return <EmptyState label="Hall of Fame members" />

  return (
    <div className="space-y-1.5">
      {items.map((member, index) => (
        <EntryCard
          key={index}
          draggable
          isOver={overIdx === index}
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver(index)}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onEdit={() => onEdit(index)}
          onRemove={() => onRemove(index)}
        >
          <p className="text-sm font-medium text-text-primary">{member.name || '-'}</p>
          <p className="text-xs text-text-muted">{[member.role, member.period, member.country].filter(Boolean).join(' · ')}</p>
        </EntryCard>
      ))}
    </div>
  )
}

function CreatorsList({ items, onEdit, onRemove, onReorder }: { items: CreatorItem[]; onEdit: (index: number) => void; onRemove: (index: number) => void; onReorder: (next: CreatorItem[]) => void }) {
  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort(items, onReorder)
  if (!items.length) return <EmptyState label="creators" />

  return (
    <div className="space-y-1.5">
      {items.map((creator, index) => {
        const activeSocials = CREATOR_NETWORKS.filter((network) => creator.socials?.[network]?.enabled).join(', ')
        return (
          <EntryCard
            key={index}
            draggable
            isOver={overIdx === index}
            onDragStart={onDragStart(index)}
            onDragOver={onDragOver(index)}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onEdit={() => onEdit(index)}
            onRemove={() => onRemove(index)}
          >
            <div className="flex items-center gap-3">
              <Avatar src={creator.avatar} name={creator.name} size="sm" className="shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{creator.name || '-'}</p>
                <p className="truncate text-xs text-text-muted">{[creator.country, activeSocials].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </EntryCard>
        )
      })}
    </div>
  )
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      />
    </div>
  )
}

function CountrySelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      >
        {COUNTRIES.map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    </div>
  )
}

function FormActions({ onSave, onCancel, disabled = false, note }: { onSave: () => void; onCancel: () => void; disabled?: boolean; note?: string }) {
  return (
    <div className="space-y-2 pt-2">
      {note && <p className="text-xs text-text-muted">{note}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={disabled}>Save</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const maybeError = error as { response?: { status?: number; data?: { error?: string } }; message?: string }
    if (maybeError.response?.status === 404) {
      return 'The upload endpoint could not be reached. Check that the desktop app is connected to the LP Hub API.'
    }
    return maybeError.response?.data?.error || maybeError.message || 'Upload failed.'
  }
  return 'Upload failed.'
}

function ImageUploadField({
  label,
  section,
  value,
  onChange,
  shape = 'avatar',
  onUploadingChange,
}: {
  label: string
  section: UploadSection
  value: string
  onChange: (value: string) => void
  shape?: 'avatar' | 'banner'
  onUploadingChange?: (uploading: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const invalidUrlMessage = 'This image URL returned 404 or is no longer public. Discord attachment links often expire. Upload the file directly or use a stable CDN URL.'

  const preview = localPreview || value

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const clearLocalPreview = () => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    clearLocalPreview()
    setError('')

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)
    onUploadingChange?.(true)

    try {
      const uploaded = await siteService.uploadWebsiteContentImage(section, file)
      clearLocalPreview()
      onChange(uploaded.url)
    } catch (uploadError) {
      setError(getErrorMessage(uploadError))
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }

  const handleManualUrlChange = (next: string) => {
    clearLocalPreview()
    setError('')
    onChange(next)
  }

  const clearImage = () => {
    clearLocalPreview()
    setError('')
    onChange('')
  }

  const handlePreviewError = () => {
    if (!localPreview && value) setError(invalidUrlMessage)
  }

  const handlePreviewLoad = () => {
    if (error === invalidUrlMessage) setError('')
  }

  return (
    <div className="space-y-2">
      <label className="block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <div className="rounded-xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(232,144,24,0.12),transparent_38%),linear-gradient(180deg,rgba(28,24,21,0.98),rgba(21,18,16,0.98))] p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div
            className={cn(
              'shrink-0 overflow-hidden border border-border/80 bg-bg-primary/70 shadow-inner',
              shape === 'avatar' ? 'h-24 w-24 rounded-2xl' : 'h-28 w-full rounded-xl sm:w-44'
            )}
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" onError={handlePreviewError} onLoad={handlePreviewLoad} />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-muted">
                <ImagePlus size={18} />
                <span className="text-[11px] uppercase tracking-[0.22em]">Cloudinary</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">{preview ? 'Image ready for this entry' : 'Upload from your device'}</p>
              <p className="text-xs leading-5 text-text-muted">
                Accepts WEBP, PNG, JPG and JPEG. The file is sent to Cloudinary and the returned CDN URL is saved here automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
                <UploadCloud size={14} />
                {value ? 'Replace image' : 'Upload image'}
              </Button>
              {(preview || value) && (
                <Button type="button" size="sm" variant="ghost" onClick={clearImage} disabled={uploading}>
                  <X size={14} />
                  Clear
                </Button>
              )}
              {uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-accent">
                  <Loader2 size={12} className="animate-spin" />
                  Uploading to Cloudinary...
                </span>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/webp,image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      <Field label="CDN / External URL" value={value} onChange={handleManualUrlChange} placeholder="https://res.cloudinary.com/..." />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

function StaffForm({ data, onChange, onSave, onCancel }: { data: StaffItem; onChange: (data: unknown) => void; onSave: () => void; onCancel: () => void }) {
  const [uploading, setUploading] = useState(false)
  const set = (key: keyof StaffItem) => (value: string) => onChange({ ...data, [key]: value })

  return (
    <div className="space-y-4">
      <FormRow>
        <Field label="Name *" value={data.name} onChange={set('name')} placeholder="Username" />
        <Field label="Role / Title" value={data.role} onChange={set('role')} placeholder="Head Coach, CEO..." />
      </FormRow>

      <ImageUploadField
        label="Avatar"
        section="staff"
        value={data.avatar}
        onChange={set('avatar')}
        shape="avatar"
        onUploadingChange={setUploading}
      />

      <FormRow>
        <CountrySelect label="Country" value={data.country} onChange={set('country')} />
        <Field label="Discord Handle" value={data.discord} onChange={set('discord')} placeholder="user#0000" />
      </FormRow>

      <Field label="Twitter / X URL" value={data.twitter} onChange={set('twitter')} placeholder="https://x.com/..." />

      <FormActions onSave={onSave} onCancel={onCancel} disabled={uploading} note={uploading ? 'Wait for the upload to finish before saving this entry.' : undefined} />
    </div>
  )
}

function TrophyForm({ data, onChange, onSave, onCancel }: { data: TrophyItem; onChange: (data: unknown) => void; onSave: () => void; onCancel: () => void }) {
  const [uploading, setUploading] = useState(false)
  const set = (key: keyof TrophyItem) => (value: string) => onChange({ ...data, [key]: value })

  return (
    <div className="space-y-4">
      <Field label="Title *" value={data.title} onChange={set('title')} placeholder="Regional Champions 2025" />

      <FormRow>
        <Field label="Team" value={data.team} onChange={set('team')} placeholder="LP Tau" />
        <Field label="Placement" value={data.placement} onChange={set('placement')} placeholder="1st, Top 4..." />
      </FormRow>

      <FormRow>
        <Field label="Date" value={data.date} onChange={set('date')} type="date" />
        <div className="rounded-xl border border-border bg-bg-tertiary/70 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-text-muted">Display</p>
          <p className="mt-1 text-sm text-text-primary">Use a wide image here so the public site cards stay clean.</p>
        </div>
      </FormRow>

      <ImageUploadField
        label="Trophy Image"
        section="trophies"
        value={data.image}
        onChange={set('image')}
        shape="banner"
        onUploadingChange={setUploading}
      />

      <FormActions onSave={onSave} onCancel={onCancel} disabled={uploading} note={uploading ? 'Wait for the upload to finish before saving this trophy.' : undefined} />
    </div>
  )
}

function HistoryForm({ data, onChange, onSave, onCancel }: { data: HistoryItem; onChange: (data: unknown) => void; onSave: () => void; onCancel: () => void }) {
  const set = (key: keyof HistoryItem) => (value: string) => onChange({ ...data, [key]: value })
  const setArr = (key: 'players' | 'coaches') => (value: string) => onChange({ ...data, [key]: value.split('\n').map((entry) => entry.trim()).filter(Boolean) })

  return (
    <div className="space-y-3">
      <FormRow>
        <Field label="Team Name *" value={data.team} onChange={set('team')} placeholder="LP Tau" />
        <Field label="Region" value={data.region} onChange={set('region')} placeholder="br, eu..." />
      </FormRow>

      <FormRow>
        <Field label="From (Month)" value={data.from} onChange={set('from')} type="month" />
        <Field label="To (Month)" value={data.to} onChange={set('to')} type="month" />
      </FormRow>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Players <span className="normal-case tracking-normal text-text-muted/60">(one per line)</span></label>
        <textarea
          value={(data.players || []).join('\n')}
          onChange={(event) => setArr('players')(event.target.value)}
          rows={4}
          placeholder={'Blastz\nLeeoLoos\nh1perZ'}
          className="w-full resize-none rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Coaches <span className="normal-case tracking-normal text-text-muted/60">(one per line)</span></label>
        <textarea
          value={(data.coaches || []).join('\n')}
          onChange={(event) => setArr('coaches')(event.target.value)}
          rows={2}
          placeholder="jarvixx"
          className="w-full resize-none rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        />
      </div>

      <Field label="Notes" value={data.notes} onChange={set('notes')} placeholder="Split 1 roster, Qualifier run..." />

      <FormActions onSave={onSave} onCancel={onCancel} />
    </div>
  )
}

function HofForm({ data, onChange, onSave, onCancel }: { data: HofItem; onChange: (data: unknown) => void; onSave: () => void; onCancel: () => void }) {
  const set = (key: keyof HofItem) => (value: string) => onChange({ ...data, [key]: value })

  return (
    <div className="space-y-3">
      <FormRow>
        <Field label="Name *" value={data.name} onChange={set('name')} placeholder="PlayerName" />
        <CountrySelect label="Country" value={data.country} onChange={set('country')} />
      </FormRow>

      <FormRow>
        <Field label="Role" value={data.role} onChange={set('role')} placeholder="Player, Coach..." />
        <Field label="Period" value={data.period} onChange={set('period')} placeholder="2023-2024" />
      </FormRow>

      <FormActions onSave={onSave} onCancel={onCancel} />
    </div>
  )
}

function CreatorForm({ data, onChange, onSave, onCancel }: { data: CreatorItem; onChange: (data: unknown) => void; onSave: () => void; onCancel: () => void }) {
  const [uploading, setUploading] = useState(false)
  const set = (key: keyof CreatorItem) => (value: string) => onChange({ ...data, [key]: value })

  const toggleNet = (network: string) => {
    const current = data.socials?.[network] || { url: '', enabled: false }
    onChange({ ...data, socials: { ...data.socials, [network]: { ...current, enabled: !current.enabled } } })
  }

  const setNetUrl = (network: string, url: string) => {
    const current = data.socials?.[network] || { url: '', enabled: false }
    onChange({ ...data, socials: { ...data.socials, [network]: { ...current, url } } })
  }

  return (
    <div className="space-y-4">
      <FormRow>
        <Field label="Name *" value={data.name} onChange={set('name')} />
        <CountrySelect label="Country" value={data.country} onChange={set('country')} />
      </FormRow>

      <ImageUploadField
        label="Avatar"
        section="creators"
        value={data.avatar}
        onChange={set('avatar')}
        shape="avatar"
        onUploadingChange={setUploading}
      />

      <div className="rounded-xl border border-border bg-bg-tertiary/70 p-3">
        <p className="mb-3 text-[10px] uppercase tracking-widest text-text-muted">Social Networks</p>
        <div className="space-y-2">
          {CREATOR_NETWORKS.map((network) => {
            const social = data.socials?.[network] || { url: '', enabled: false }
            return (
              <div key={network} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleNet(network)}
                  className={cn(
                    'w-14 shrink-0 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors',
                    social.enabled ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'
                  )}
                >
                  {social.enabled ? 'ON' : 'OFF'}
                </button>
                <span className="w-16 shrink-0 text-xs font-semibold uppercase text-text-muted">{network}</span>
                <input
                  type="text"
                  value={social.url}
                  onChange={(event) => setNetUrl(network, event.target.value)}
                  placeholder="https://..."
                  disabled={!social.enabled}
                  className="flex-1 rounded-md border border-border bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary outline-none transition-colors focus:border-accent disabled:opacity-40"
                />
              </div>
            )
          })}
        </div>
      </div>

      <FormActions onSave={onSave} onCancel={onCancel} disabled={uploading} note={uploading ? 'Wait for the upload to finish before saving this creator.' : undefined} />
    </div>
  )
}
