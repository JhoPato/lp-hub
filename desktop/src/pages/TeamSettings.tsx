import { useEffect, useState } from 'react'
import { KeyRound, Save, Shield, Upload } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { workspaceService, type WorkspaceTeam } from '@/services/workspaceService'

export default function TeamSettings() {
  const hub = useAuthStore((state) => state.hub)
  const setHub = useAuthStore((state) => state.setHub)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [team, setTeam] = useState<WorkspaceTeam | null>(null)
  const [form, setForm] = useState({ name: '', tag: '', region: '' })
  const [henrikKey, setHenrikKey] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await workspaceService.getTeam()
      setTeam(data)
      setForm({ name: data.name, tag: data.tag, region: data.region })
    } catch {
      setError('Team settings could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function saveTeam() {
    setSavingProfile(true)
    setError('')
    try {
      const updated = await workspaceService.updateTeam(form)
      setTeam(updated)
      if (hub) {
        setHub({
          ...hub,
          teamName: updated.name,
          teamTag: updated.tag,
          teamRegion: updated.region,
          teamLogo: updated.logoUrl || hub.teamLogo,
        })
      }
    } catch {
      setError('Team details could not be saved.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveHenrikKey() {
    setSavingKey(true)
    setError('')
    try {
      const result = await workspaceService.updateHenrikKey(henrikKey)
      setTeam((current) => current ? { ...current, hasHenrikKey: result.hasKey } : current)
      setHenrikKey('')
    } catch {
      setError('The Henrik API key could not be saved.')
    } finally {
      setSavingKey(false)
    }
  }

  async function saveLogo() {
    if (!logoFile) return
    setSavingLogo(true)
    setError('')
    try {
      const updated = await workspaceService.uploadTeamLogo(logoFile)
      setTeam(updated)
      setLogoFile(null)
      if (hub) {
        setHub({ ...hub, teamLogo: updated.logoUrl || hub.teamLogo })
      }
    } catch {
      setError('The team logo could not be uploaded.')
    } finally {
      setSavingLogo(false)
    }
  }

  return (
    <PageWrapper title="Team Settings">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}

        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield size={18} className="text-accent" />Team identity</CardTitle>
              <CardDescription>Main hub metadata used across the desktop app.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Team name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                <Field label="Tag" value={form.tag} onChange={(value) => setForm((current) => ({ ...current, tag: value }))} />
                <Field label="Region" value={form.region} onChange={(value) => setForm((current) => ({ ...current, region: value }))} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void saveTeam()} loading={savingProfile} disabled={loading}><Save size={14} /> Save team</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current logo</CardTitle>
              <CardDescription>Update the main team mark used in the sidebar and app shell.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex justify-center rounded-xl border border-border bg-bg-secondary p-6">
                {team?.logoUrl ? <img src={team.logoUrl} alt={team.name} className="h-28 w-28 rounded-xl object-cover" /> : <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-bg-tertiary text-sm text-text-muted">No logo</div>}
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary" />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => void saveLogo()} loading={savingLogo} disabled={!logoFile}><Upload size={14} /> Upload logo</Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound size={18} className="text-accent" />Henrik integration</CardTitle>
            <CardDescription>
              {team?.hasHenrikKey ? 'An API key is already configured for this team.' : 'No Henrik API key has been configured yet.'}
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Henrik API key" type="password" value={henrikKey} onChange={setHenrikKey} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => void saveHenrikKey()} loading={savingKey}><Save size={14} /> Save key</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent" />
    </div>
  )
}
