import { useEffect, useMemo, useState } from 'react'
import { FileUp, Pencil, Trash2 } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useWorkspaceArea } from '@/hooks/useWorkspaceArea'
import { workspaceService, type WorkspacePraccMatchSummary } from '@/services/workspaceService'

export default function PraccHistory() {
  const { canLeadWorkspace, canManageWorkspace } = useWorkspaceArea()
  const canImport = canLeadWorkspace
  const canDelete = canManageWorkspace
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [matches, setMatches] = useState<WorkspacePraccMatchSummary[]>([])
  const [maps, setMaps] = useState<string[]>([])
  const [busyId, setBusyId] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [editMatch, setEditMatch] = useState<WorkspacePraccMatchSummary | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importForm, setImportForm] = useState({ opponent: '', mapName: '' })
  const [editForm, setEditForm] = useState({ opponent: '', mapName: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  const wins = useMemo(() => matches.filter((match) => match.result === 'W').length, [matches])
  const losses = useMemo(() => matches.filter((match) => match.result === 'L').length, [matches])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await workspaceService.getPraccMatches({ page: 1, limit: 50 })
      setMatches(data.matches)
      setMaps(data.maps)
    } catch {
      setError('Pracc history could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function importMatch() {
    if (!file) return
    setSaving(true)
    try {
      const result = await workspaceService.importPraccMatch(file, importForm)
      setMatches((current) => [result.match, ...current])
      setImportOpen(false)
      setFile(null)
      setImportForm({ opponent: '', mapName: '' })
    } catch {
      setError('That match file could not be imported.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(match: WorkspacePraccMatchSummary) {
    setEditMatch(match)
    setEditForm({ opponent: match.opponent || '', mapName: match.mapName || '' })
  }

  async function saveEdit() {
    if (!editMatch) return
    setSaving(true)
    try {
      const result = await workspaceService.updatePraccMatch(editMatch._id, editForm)
      setMatches((current) => current.map((match) => match._id === editMatch._id ? { ...match, ...result.match } : match))
      setEditMatch(null)
    } catch {
      setError('The match could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function removeMatch(id: string) {
    if (!confirm('Delete this imported pracc match?')) return
    setBusyId(id)
    try {
      await workspaceService.deletePraccMatch(id)
      setMatches((current) => current.filter((match) => match._id !== id))
    } catch {
      setError('The match could not be deleted.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <PageWrapper title="Pracc History">
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Pracc Archive</h2>
            <p className="mt-1 text-sm text-text-secondary">Imported scrim history and editable metadata.</p>
          </div>
          {canImport && (
            <Button onClick={() => setImportOpen(true)}>
              <FileUp size={14} /> Import match JSON
            </Button>
          )}
        </div>

        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Matches" value={String(matches.length)} />
          <StatCard label="Wins" value={String(wins)} />
          <StatCard label="Losses" value={String(losses)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
            <CardDescription>{maps.length > 0 ? `${maps.length} maps represented` : 'Latest imports for this team.'}</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-skeleton-pulse rounded-lg bg-bg-secondary" />)
            ) : matches.length === 0 ? (
              <EmptyState message="No pracc matches imported yet." />
            ) : (
              matches.map((match) => (
                <div key={match._id} className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text-primary">{match.opponent || 'Unnamed opponent'}</p>
                        <Badge variant={match.result === 'W' ? 'success' : match.result === 'L' ? 'danger' : 'muted'}>{match.result || 'N/A'}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{match.mapName || 'Unknown map'} | {match.scoreUs ?? '-'} - {match.scoreThem ?? '-'}</p>
                      <p className="mt-1 text-xs text-text-muted">{match.date ? new Date(match.date).toLocaleString() : 'No date saved'}</p>
                    </div>
                    {(canImport || canDelete) && (
                      <div className="flex shrink-0 items-center gap-1">
                        {canImport && <button onClick={() => openEdit(match)} className="rounded p-1.5 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary"><Pencil size={14} /></button>}
                        {canDelete && <button onClick={() => void removeMatch(match._id)} disabled={busyId === match._id} className="rounded p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 size={14} /></button>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import pracc match" className="max-w-xl">
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-bg-tertiary px-4 py-5 text-sm text-text-secondary">
            Upload a ScrimSense JSON export to add a match to this team's history.
          </div>
          <input type="file" accept=".json,application/json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary" />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Opponent" value={importForm.opponent} onChange={(value) => setImportForm((current) => ({ ...current, opponent: value }))} />
            <Field label="Map Name" value={importForm.mapName} onChange={(value) => setImportForm((current) => ({ ...current, mapName: value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void importMatch()} disabled={!file}>Import</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editMatch} onClose={() => setEditMatch(null)} title="Edit pracc match" className="max-w-xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Opponent" value={editForm.opponent} onChange={(value) => setEditForm((current) => ({ ...current, opponent: value }))} />
            <Field label="Map Name" value={editForm.mapName} onChange={(value) => setEditForm((current) => ({ ...current, mapName: value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditMatch(null)}>Cancel</Button>
            <Button loading={saving} onClick={() => void saveEdit()}>Save</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-2xl font-semibold text-text-primary">{value}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
      </CardBody>
    </Card>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">{message}</div>
}
