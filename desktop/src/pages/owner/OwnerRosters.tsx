import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { adminService } from '@/services/adminService'
import {
  siteService,
  type RosterBulkResult,
  type RosterLinkOption,
  type RosterMember,
  type RosterTeam,
} from '@/services/siteService'

type EditableMember = RosterMember

interface TeamDraft {
  _id: string
  name: string
  tag: string
  game: string
  region: string
  linkedRegion: string
  linkedTeamIndex: string
  players: EditableMember[]
  coaches: EditableMember[]
}

const REGION_OPTIONS = ['BR', 'EU', 'UK', 'FR', 'IT', 'ES', 'DE', 'TR', 'US', 'CL', 'LATAM']

function normalizeMember(entry: RosterMember | string | null | undefined, fallbackRole = ''): EditableMember {
  if (!entry) return { name: '', role: fallbackRole, country: '', twitter: '', vlr: '', photo: '' }
  if (typeof entry === 'string') {
    return { name: entry, role: fallbackRole, country: '', twitter: '', vlr: '', photo: '' }
  }

  return {
    name: entry.name || '',
    role: entry.role || fallbackRole,
    country: entry.country || entry.nationality || '',
    nationality: entry.nationality || entry.country || '',
    twitter: entry.twitter || '',
    vlr: entry.vlr || '',
    photo: entry.photo || '',
  }
}

function normalizedRoster(team: RosterTeam) {
  return {
    players: (team.websiteRoster?.players || []).map((entry) => normalizeMember(entry, 'Player')),
    coaches: (team.websiteRoster?.coaches || []).map((entry) => normalizeMember(entry, 'Coach')),
  }
}

function sanitizeMembers(members: EditableMember[], fallbackRole: string) {
  return members
    .map((member) => ({
      name: member.name.trim(),
      role: (member.role || fallbackRole).trim(),
      country: (member.country || member.nationality || '').trim(),
      nationality: (member.nationality || member.country || '').trim(),
      twitter: (member.twitter || '').trim(),
      vlr: (member.vlr || '').trim(),
      photo: (member.photo || '').trim(),
    }))
    .filter((member) => member.name)
}

function createEmptyMember(role: string): EditableMember {
  return { name: '', role, country: '', twitter: '', vlr: '', photo: '' }
}

function buildDraft(team: RosterTeam): TeamDraft {
  const roster = normalizedRoster(team)
  return {
    _id: team._id,
    name: team.name,
    tag: team.tag || '',
    game: team.game || 'Valorant',
    region: team.region || '',
    linkedRegion: team.lpApiTeam?.region || '',
    linkedTeamIndex: team.lpApiTeam?.teamIndex != null ? String(team.lpApiTeam.teamIndex) : '',
    players: roster.players,
    coaches: roster.coaches,
  }
}

function statusVariant(synced: boolean, linked: boolean): 'success' | 'warning' | 'muted' {
  if (synced) return 'success'
  if (linked) return 'warning'
  return 'muted'
}

function rosterLastSync(team: RosterTeam) {
  const value = team.websiteRoster?.lastSynced
  if (!value) return 'Never synced'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never synced'

  return date.toLocaleString()
}

function linkedLabel(team: RosterTeam, options: RosterLinkOption[]) {
  if (team.lpApiTeam?.region == null || team.lpApiTeam?.teamIndex == null) return 'Not linked'
  const match = options.find((option) => option.region === team.lpApiTeam?.region && option.teamIndex === team.lpApiTeam?.teamIndex)
  return match ? `${match.region.toUpperCase()} - ${match.name}` : `${team.lpApiTeam.region?.toUpperCase()} #${team.lpApiTeam.teamIndex}`
}

export default function OwnerRosters() {
  const [teams, setTeams] = useState<RosterTeam[]>([])
  const [lpTeams, setLpTeams] = useState<RosterLinkOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [logRows, setLogRows] = useState<RosterBulkResult[]>([])

  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<TeamDraft | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', tag: '', region: 'BR', game: 'Valorant' })

  async function load() {
    setLoading(true)
    setError('')
    const [teamsResult, lpTeamsResult] = await Promise.allSettled([
      siteService.getAllRosters(),
      siteService.getLpRosterTeams(),
    ])

    if (teamsResult.status === 'fulfilled') setTeams(teamsResult.value)
    if (lpTeamsResult.status === 'fulfilled') setLpTeams(lpTeamsResult.value)

    if (teamsResult.status === 'rejected' || lpTeamsResult.status === 'rejected') {
      setError('Some roster data could not be loaded.')
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return teams
    return teams.filter((team) => {
      const roster = normalizedRoster(team)
      return [
        team.name,
        team.tag,
        team.region,
        ...roster.players.map((member) => member.name),
        ...roster.coaches.map((member) => member.name),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    })
  }, [search, teams])

  const replaceTeam = (updated: RosterTeam) => {
    setTeams((current) => current.map((team) => (team._id === updated._id ? updated : team)))
  }

  const openEditor = (team: RosterTeam) => {
    setDraft(buildDraft(team))
    setEditorOpen(true)
    setError('')
    setMessage('')
  }

  const saveDraft = async () => {
    if (!draft) return
    setBusyKey(`save:${draft._id}`)
    setError('')
    setMessage('')

    try {
      const updatedMeta = await adminService.updateTeam(draft._id, {
        name: draft.name,
        tag: draft.tag,
        region: draft.region,
        game: draft.game,
      })

      await siteService.linkRosterTeam(draft._id, {
        region: draft.linkedRegion || null,
        teamIndex: draft.linkedTeamIndex === '' ? null : Number(draft.linkedTeamIndex),
      })

      const saved = await siteService.saveRosterTeam(draft._id, {
        players: sanitizeMembers(draft.players, 'Player'),
        coaches: sanitizeMembers(draft.coaches, 'Coach'),
      })

      const merged: RosterTeam = {
        ...saved,
        name: updatedMeta.name,
        tag: updatedMeta.tag,
        region: updatedMeta.region,
        game: updatedMeta.game,
        logoUrl: updatedMeta.logoUrl || saved.logoUrl,
        lpApiTeam: {
          region: draft.linkedRegion || null,
          teamIndex: draft.linkedTeamIndex === '' ? null : Number(draft.linkedTeamIndex),
        },
      }

      replaceTeam(merged)
      setDraft(buildDraft(merged))
      setMessage(`${merged.name} saved.`)
    } catch {
      setError('That roster could not be saved.')
    } finally {
      setBusyKey('')
    }
  }

  const createTeam = async () => {
    if (!createForm.name.trim() || !createForm.tag.trim() || !createForm.region.trim()) return
    setBusyKey('create')
    setError('')
    try {
      await adminService.createTeam({
        name: createForm.name.trim(),
        tag: createForm.tag.trim().toUpperCase(),
        region: createForm.region.trim().toUpperCase(),
        game: createForm.game.trim() || 'Valorant',
      })
      setCreateOpen(false)
      setCreateForm({ name: '', tag: '', region: 'BR', game: 'Valorant' })
      await load()
      setMessage('Team created.')
    } catch {
      setError('The team could not be created.')
    } finally {
      setBusyKey('')
    }
  }

  const deleteTeam = async (team: RosterTeam) => {
    if (!confirm(`Delete ${team.name}? This removes the HUB team entry.`)) return
    setBusyKey(`delete:${team._id}`)
    setError('')
    try {
      await adminService.deleteTeam(team._id)
      setTeams((current) => current.filter((item) => item._id !== team._id))
      if (draft?._id === team._id) {
        setEditorOpen(false)
        setDraft(null)
      }
      setMessage(`${team.name} deleted.`)
    } catch {
      setError('The team could not be deleted.')
    } finally {
      setBusyKey('')
    }
  }

  const syncFromHub = async (team: RosterTeam, openAfter = false) => {
    setBusyKey(`hub:${team._id}`)
    setError('')
    try {
      const updated = await siteService.syncRosterFromHub(team._id)
      replaceTeam(updated)
      if (draft?._id === team._id || openAfter) {
        setDraft(buildDraft(updated))
        if (openAfter) setEditorOpen(true)
      }
      setMessage(`${updated.name} synced from HUB members.`)
    } catch {
      setError('HUB sync failed for that team.')
    } finally {
      setBusyKey('')
    }
  }

  const pullTeam = async (team: RosterTeam) => {
    setBusyKey(`pull:${team._id}`)
    setError('')
    try {
      const updated = await siteService.pullRosterTeam(team._id)
      replaceTeam(updated)
      if (draft?._id === team._id) setDraft(buildDraft(updated))
      setMessage(`${updated.name} pulled from LP-API.`)
    } catch {
      setError('LP-API pull failed for that team.')
    } finally {
      setBusyKey('')
    }
  }

  const pushTeam = async (team: RosterTeam) => {
    setBusyKey(`push:${team._id}`)
    setError('')
    try {
      const updated = await siteService.pushRosterTeam(team._id)
      replaceTeam(updated)
      if (draft?._id === team._id) setDraft(buildDraft(updated))
      setMessage(`${updated.name} pushed to the live roster API.`)
    } catch {
      setError('Live sync failed for that team.')
    } finally {
      setBusyKey('')
    }
  }

  const runBulkAction = async (action: 'pull' | 'push') => {
    setBusyKey(action)
    setError('')
    setMessage('')
    try {
      const results = action === 'pull'
        ? await siteService.pullAllRosters()
        : await siteService.pushAllRosters()
      setLogRows(results)
      await load()
      const successCount = results.filter((row) => row.status === (action === 'pull' ? 'pulled' : 'pushed')).length
      setMessage(`${successCount} teams ${action === 'pull' ? 'pulled from' : 'pushed to'} LP-API.`)
    } catch {
      setError(`Bulk ${action} failed.`)
    } finally {
      setBusyKey('')
    }
  }

  const updateDraftMember = (type: 'players' | 'coaches', index: number, field: keyof EditableMember, value: string) => {
    setDraft((current) => {
      if (!current) return current
      const next = [...current[type]]
      next[index] = { ...next[index], [field]: value }
      return { ...current, [type]: next }
    })
  }

  const addDraftMember = (type: 'players' | 'coaches') => {
    setDraft((current) => {
      if (!current) return current
      const role = type === 'players' ? 'Player' : 'Coach'
      return { ...current, [type]: [...current[type], createEmptyMember(role)] }
    })
  }

  const removeDraftMember = (type: 'players' | 'coaches', index: number) => {
    setDraft((current) => {
      if (!current) return current
      return { ...current, [type]: current[type].filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  return (
    <PageWrapper title="Rosters">
      <div className="w-full space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
          <Card className="overflow-hidden">
            <CardBody className="relative p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent_60%)]" />
              <div className="relative flex h-full flex-col justify-between gap-5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                    <Users size={18} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">Website rosters editor</h2>
                    <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                      Edit each team that appears on `lostpuppies.org`, create or remove HUB teams when needed, and
                      sync the public roster JSON either from LP-API or from the current HUB members of each team.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-xl border border-border bg-bg-primary/60 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Search</p>
                    <div className="mt-3">
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        icon={<Search size={14} />}
                        placeholder="Search team, player or coach"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-bg-primary/60 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Visible Teams</p>
                    {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-3 text-3xl font-semibold text-text-primary">{filteredTeams.length}</p>}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Bulk tools for the public roster JSON and HUB sync.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              <Button variant="secondary" className="w-full justify-center" onClick={() => setCreateOpen(true)}>
                <Plus size={14} /> New Team
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => void runBulkAction('pull')}
                loading={busyKey === 'pull'}
              >
                <ArrowDownToLine size={14} /> Pull All
              </Button>
              <Button
                className="w-full justify-center"
                onClick={() => void runBulkAction('push')}
                loading={busyKey === 'push'}
              >
                <ArrowUpFromLine size={14} /> Push All
              </Button>
              <Button variant="ghost" className="w-full justify-center" onClick={() => void load()}>
                <RefreshCw size={14} /> Refresh
              </Button>
            </CardBody>
          </Card>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            {message}
          </div>
        )}

        {logRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Last Sync Run</CardTitle>
              <CardDescription>Most recent bulk roster operation results.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-2">
              {logRows.map((row, index) => (
                <div key={`${row.name}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-primary/60 px-4 py-3 text-sm">
                  <span className="min-w-[160px] font-medium text-text-primary">{row.name}</span>
                  <Badge variant={row.status === 'error' ? 'danger' : row.status === 'not_found' ? 'muted' : 'success'}>
                    {row.status.replace('_', ' ')}
                  </Badge>
                  {typeof row.players === 'number' && typeof row.coaches === 'number' && (
                    <span className="text-text-secondary">{row.players} players - {row.coaches} coaches</span>
                  )}
                  {row.error && <span className="text-danger">{row.error}</span>}
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-xl" />)}
          </div>
        ) : filteredTeams.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-sm text-text-secondary">
              No teams matched your search.
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredTeams.map((team) => {
              const roster = normalizedRoster(team)
              const linked = team.lpApiTeam?.region != null && team.lpApiTeam?.teamIndex != null
              const synced = Boolean(team.websiteRoster?.lastSynced)

              return (
                <Card key={team._id} className="h-full overflow-hidden">
                  <CardBody className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <Avatar src={team.logoUrl} name={team.name} size="lg" />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-text-primary">{team.name}</h3>
                            {team.tag && <Badge variant="muted">{team.tag}</Badge>}
                            <Badge variant={statusVariant(synced, linked)}>
                              {synced ? 'Synced' : linked ? 'Linked' : 'Unlinked'}
                            </Badge>
                          </div>
                          <p className="text-sm text-text-secondary">
                            {(team.region || 'No region').toUpperCase()} - {team.game || 'Valorant'}
                          </p>
                          <p className="text-xs text-text-muted">
                            LP-API: {linkedLabel(team, lpTeams)} - Last sync: {rosterLastSync(team)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEditor(team)}>
                        <Pencil size={14} /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void syncFromHub(team)}
                        loading={busyKey === `hub:${team._id}`}
                      >
                        <Wand2 size={14} /> Sync HUB
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void pullTeam(team)}
                        loading={busyKey === `pull:${team._id}`}
                        disabled={!linked}
                      >
                        <ArrowDownToLine size={14} /> Pull
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void pushTeam(team)}
                        loading={busyKey === `push:${team._id}`}
                        disabled={!linked}
                      >
                        <ArrowUpFromLine size={14} /> Push Live
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                        onClick={() => void deleteTeam(team)}
                        loading={busyKey === `delete:${team._id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      <RosterPreview title="Players" items={roster.players} compact />
                      <RosterPreview title="Coaches" items={roster.coaches} compact />
                    </div>

                    <div className="mt-auto grid gap-3 sm:grid-cols-3">
                      <SmallMetric label="Players" value={String(roster.players.length)} />
                      <SmallMetric label="Coaches" value={String(roster.coaches.length)} />
                      <SmallMetric label="LP Link" value={linked ? 'Connected' : 'Missing'} />
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={draft ? `Edit ${draft.name}` : 'Edit roster'}
        className="max-w-[min(1180px,96vw)]"
        footer={draft ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Close
            </Button>
            <Button loading={busyKey === `save:${draft._id}`} onClick={() => void saveDraft()}>
              <Save size={14} /> Save Changes
            </Button>
          </div>
        ) : undefined}
      >
        {draft && (
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Team Details</CardTitle>
                  <CardDescription>Basic HUB metadata plus the public LP-API link.</CardDescription>
                </CardHeader>
                <CardBody className="grid gap-4 md:grid-cols-2">
                  <Field label="Team name" value={draft.name} onChange={(value) => setDraft((current) => current ? { ...current, name: value } : current)} />
                  <Field label="Tag" value={draft.tag} onChange={(value) => setDraft((current) => current ? { ...current, tag: value.toUpperCase() } : current)} />
                  <SelectField
                    label="Region"
                    value={draft.region}
                    options={Array.from(new Set([draft.region, ...REGION_OPTIONS])).filter(Boolean)}
                    onChange={(value) => setDraft((current) => current ? { ...current, region: value } : current)}
                  />
                  <Field label="Game" value={draft.game} onChange={(value) => setDraft((current) => current ? { ...current, game: value } : current)} />
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      LP-API team link
                    </label>
                    <select
                      value={draft.linkedRegion && draft.linkedTeamIndex !== '' ? `${draft.linkedRegion}|${draft.linkedTeamIndex}` : ''}
                      onChange={(event) => {
                        const value = event.target.value
                        if (!value) {
                          setDraft((current) => current ? { ...current, linkedRegion: '', linkedTeamIndex: '' } : current)
                          return
                        }
                        const [region, teamIndex] = value.split('|')
                        setDraft((current) => current ? { ...current, linkedRegion: region, linkedTeamIndex: teamIndex } : current)
                      }}
                      className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                    >
                      <option value="">Not linked</option>
                      {lpTeams.map((option) => (
                        <option key={`${option.region}-${option.teamIndex}`} value={`${option.region}|${option.teamIndex}`}>
                          {option.region.toUpperCase()} - {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Sync</CardTitle>
                  <CardDescription>Use the current editor team as the source or destination.</CardDescription>
                </CardHeader>
                <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => void syncFromHub({
                      _id: draft._id,
                      name: draft.name,
                      tag: draft.tag,
                      game: draft.game,
                      region: draft.region,
                      lpApiTeam: {
                        region: draft.linkedRegion || null,
                        teamIndex: draft.linkedTeamIndex === '' ? null : Number(draft.linkedTeamIndex),
                      },
                      websiteRoster: { players: draft.players, coaches: draft.coaches, lastSynced: null },
                    }, false)}
                    loading={busyKey === `hub:${draft._id}`}
                  >
                    <Wand2 size={14} /> Replace with HUB Members
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => void pullTeam({
                      _id: draft._id,
                      name: draft.name,
                      tag: draft.tag,
                      game: draft.game,
                      region: draft.region,
                      lpApiTeam: {
                        region: draft.linkedRegion || null,
                        teamIndex: draft.linkedTeamIndex === '' ? null : Number(draft.linkedTeamIndex),
                      },
                      websiteRoster: { players: draft.players, coaches: draft.coaches, lastSynced: null },
                    })}
                    disabled={!draft.linkedRegion || draft.linkedTeamIndex === ''}
                    loading={busyKey === `pull:${draft._id}`}
                  >
                    <ArrowDownToLine size={14} /> Pull from LP-API
                  </Button>
                  <Button
                    className="w-full justify-center"
                    onClick={() => void pushTeam({
                      _id: draft._id,
                      name: draft.name,
                      tag: draft.tag,
                      game: draft.game,
                      region: draft.region,
                      lpApiTeam: {
                        region: draft.linkedRegion || null,
                        teamIndex: draft.linkedTeamIndex === '' ? null : Number(draft.linkedTeamIndex),
                      },
                      websiteRoster: { players: draft.players, coaches: draft.coaches, lastSynced: null },
                    })}
                    disabled={!draft.linkedRegion || draft.linkedTeamIndex === ''}
                    loading={busyKey === `push:${draft._id}`}
                  >
                    <ArrowUpFromLine size={14} /> Push to Live JSON
                  </Button>
                  <div className="rounded-lg border border-border bg-bg-primary/70 px-3 py-3 text-sm text-text-secondary">
                    Save updates the HUB copy first. Push Live sends the saved roster to the public LP API.
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <MemberEditorSection
                title="Players"
                items={draft.players}
                emptyLabel="No players added yet."
                addLabel="Add player"
                onAdd={() => addDraftMember('players')}
                onChange={updateDraftMember}
                onRemove={(index) => removeDraftMember('players', index)}
                type="players"
              />
              <MemberEditorSection
                title="Coaches"
                items={draft.coaches}
                emptyLabel="No coaches added yet."
                addLabel="Add coach"
                onAdd={() => addDraftMember('coaches')}
                onChange={updateDraftMember}
                onRemove={(index) => removeDraftMember('coaches', index)}
                type="coaches"
              />
            </div>

          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Team"
        className="max-w-2xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Team name" value={createForm.name} onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))} />
          <Field label="Tag" value={createForm.tag} onChange={(value) => setCreateForm((current) => ({ ...current, tag: value.toUpperCase() }))} />
          <SelectField label="Region" value={createForm.region} options={REGION_OPTIONS} onChange={(value) => setCreateForm((current) => ({ ...current, region: value }))} />
          <Field label="Game" value={createForm.game} onChange={(value) => setCreateForm((current) => ({ ...current, game: value }))} />
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={busyKey === 'create'} onClick={() => void createTeam()}>
              <Plus size={14} /> Create Team
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/60 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="mt-2 text-lg font-semibold text-text-primary">{value}</div>
    </div>
  )
}

function RosterPreview({ title, items, compact = false }: { title: string; items: EditableMember[]; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-bg-primary/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
        <Badge variant="muted">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">No entries yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.slice(0, compact ? 6 : 10).map((member, index) => (
            <span key={`${member.name}-${index}`} className="rounded-full border border-border bg-bg-tertiary px-3 py-1 text-sm text-text-primary">
              {member.name}
            </span>
          ))}
          {items.length > (compact ? 6 : 10) && (
            <span className="rounded-full border border-border bg-bg-tertiary px-3 py-1 text-sm text-text-muted">
              +{items.length - (compact ? 6 : 10)} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function MemberEditorSection({
  title,
  items,
  emptyLabel,
  addLabel,
  onAdd,
  onChange,
  onRemove,
  type,
}: {
  title: string
  items: EditableMember[]
  emptyLabel: string
  addLabel: string
  onAdd: () => void
  onChange: (type: 'players' | 'coaches', index: number, field: keyof EditableMember, value: string) => void
  onRemove: (index: number) => void
  type: 'players' | 'coaches'
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Editable entries sent to the public site JSON.</CardDescription>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus size={14} /> {addLabel}
        </Button>
      </CardHeader>
      <CardBody className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
            {emptyLabel}
          </div>
        ) : (
          items.map((member, index) => (
            <div key={`${type}-${index}`} className="rounded-xl border border-border bg-bg-primary/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {title.slice(0, -1)} {index + 1}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                <Field label="Name" value={member.name} onChange={(value) => onChange(type, index, 'name', value)} />
                <Field label="Role" value={member.role || ''} onChange={(value) => onChange(type, index, 'role', value)} />
                <Field label="Country" value={member.country || member.nationality || ''} onChange={(value) => onChange(type, index, 'country', value)} />
                <Field label="Twitter" value={member.twitter || ''} onChange={(value) => onChange(type, index, 'twitter', value)} placeholder="@user or link" />
                <Field label="VLR" value={member.vlr || ''} onChange={(value) => onChange(type, index, 'vlr', value)} placeholder="https://..." />
                <Field label="Photo URL" value={member.photo || ''} onChange={(value) => onChange(type, index, 'photo', value)} placeholder="https://..." />
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

