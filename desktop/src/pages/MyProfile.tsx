import { useEffect, useState } from 'react'
import { KeyRound, Save, Upload, UserRound } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { workspaceService, type ProfileMe } from '@/services/workspaceService'

export default function MyProfile() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profile, setProfile] = useState<ProfileMe | null>(null)
  const [accountForm, setAccountForm] = useState({ username: '', email: '' })
  const [riotForm, setRiotForm] = useState({
    riotGameName: '',
    riotTagLine: '',
    riotRegion: 'br',
    riotGameName2: '',
    riotTagLine2: '',
    riotRegion2: 'br',
  })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  const [savingRiot, setSavingRiot] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await workspaceService.getProfile()
      setProfile(data)
      setAccountForm({ username: data.username, email: data.email })
      setRiotForm({
        riotGameName: data.riotGameName ?? '',
        riotTagLine: data.riotTagLine ?? '',
        riotRegion: data.riotRegion ?? 'br',
        riotGameName2: data.riotGameName2 ?? '',
        riotTagLine2: data.riotTagLine2 ?? '',
        riotRegion2: data.riotRegion2 ?? 'br',
      })
    } catch {
      setError('Your profile could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function saveAccount() {
    setSavingAccount(true)
    setError('')
    setSuccess('')
    try {
      const updated = await workspaceService.updateProfile(accountForm)
      setProfile((current) => current ? { ...current, ...updated } : current)
      if (user) {
        setUser({ ...user, username: updated.username, email: updated.email })
      }
      setSuccess('Profile details updated.')
    } catch {
      setError('Your profile details could not be saved.')
    } finally {
      setSavingAccount(false)
    }
  }

  async function saveRiot() {
    setSavingRiot(true)
    setError('')
    setSuccess('')
    try {
      const updated = await workspaceService.updateRiot(riotForm)
      setProfile((current) => current ? { ...current, ...updated } : current)
      setSuccess('Riot IDs updated.')
    } catch {
      setError('The Riot IDs could not be saved.')
    } finally {
      setSavingRiot(false)
    }
  }

  async function savePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) return
    setSavingPassword(true)
    setError('')
    setSuccess('')
    try {
      await workspaceService.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordForm({ currentPassword: '', newPassword: '' })
      setSuccess('Password updated successfully.')
    } catch {
      setError('The password could not be changed.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function uploadPhoto() {
    if (!photoFile) return
    setSavingPhoto(true)
    setError('')
    setSuccess('')
    try {
      const result = await workspaceService.uploadProfilePhoto(photoFile)
      setProfile((current) => current ? { ...current, profilePhotoUrl: result.profilePhotoUrl } : current)
      if (user) {
        setUser({ ...user, profilePhotoUrl: result.profilePhotoUrl })
      }
      setPhotoFile(null)
      setSuccess('Profile photo updated.')
    } catch {
      setError('The profile photo could not be uploaded.')
    } finally {
      setSavingPhoto(false)
    }
  }

  return (
    <PageWrapper title="My Profile">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}
        {success && <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{success}</div>}

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRound size={18} className="text-accent" />Identity</CardTitle>
              <CardDescription>Keep your account card and avatar current.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg-secondary p-5 text-center">
                <Avatar src={profile?.discordAvatar || profile?.profilePhotoUrl} name={profile?.username} size="xl" />
                <div>
                  <p className="font-medium text-text-primary">{profile?.username || 'Profile'}</p>
                  <p className="mt-1 text-sm text-text-secondary capitalize">{profile?.role || user?.role}</p>
                </div>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary" />
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => void uploadPhoto()} loading={savingPhoto} disabled={!photoFile || loading}><Upload size={14} /> Upload photo</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account details</CardTitle>
              <CardDescription>Basic profile information used across the app.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Username" value={accountForm.username} onChange={(value) => setAccountForm((current) => ({ ...current, username: value }))} />
                <Field label="Email" value={accountForm.email} onChange={(value) => setAccountForm((current) => ({ ...current, email: value }))} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void saveAccount()} loading={savingAccount} disabled={loading}><Save size={14} /> Save account</Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Riot IDs</CardTitle>
            <CardDescription>Primary and optional secondary account for Henrik and training tracking.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-6 xl:grid-cols-2">
            <RiotAccount
              title="Primary account"
              gameName={riotForm.riotGameName}
              tagLine={riotForm.riotTagLine}
              region={riotForm.riotRegion}
              onGameNameChange={(value) => setRiotForm((current) => ({ ...current, riotGameName: value }))}
              onTagLineChange={(value) => setRiotForm((current) => ({ ...current, riotTagLine: value }))}
              onRegionChange={(value) => setRiotForm((current) => ({ ...current, riotRegion: value }))}
            />
            <RiotAccount
              title="Secondary account"
              gameName={riotForm.riotGameName2}
              tagLine={riotForm.riotTagLine2}
              region={riotForm.riotRegion2}
              onGameNameChange={(value) => setRiotForm((current) => ({ ...current, riotGameName2: value }))}
              onTagLineChange={(value) => setRiotForm((current) => ({ ...current, riotTagLine2: value }))}
              onRegionChange={(value) => setRiotForm((current) => ({ ...current, riotRegion2: value }))}
            />
            <div className="xl:col-span-2 flex justify-end">
              <Button onClick={() => void saveRiot()} loading={savingRiot} disabled={loading}><Save size={14} /> Save Riot IDs</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound size={18} className="text-accent" />Password</CardTitle>
            <CardDescription>Change your account password without leaving the desktop app.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Current password" type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} />
            <Field label="New password" type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} />
            <div className="md:col-span-2 flex justify-end">
              <Button variant="secondary" onClick={() => void savePassword()} loading={savingPassword} disabled={!passwordForm.currentPassword || !passwordForm.newPassword}><Save size={14} /> Change password</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}

function RiotAccount({
  title,
  gameName,
  tagLine,
  region,
  onGameNameChange,
  onTagLineChange,
  onRegionChange,
}: {
  title: string
  gameName: string
  tagLine: string
  region: string
  onGameNameChange: (value: string) => void
  onTagLineChange: (value: string) => void
  onRegionChange: (value: string) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Game name" value={gameName} onChange={onGameNameChange} />
        <Field label="Tag line" value={tagLine} onChange={onTagLineChange} />
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">Region</label>
          <select value={region} onChange={(event) => onRegionChange(event.target.value)} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
            <option value="br">BR</option>
            <option value="na">NA</option>
            <option value="eu">EU</option>
            <option value="latam">LATAM</option>
            <option value="ap">AP</option>
            <option value="kr">KR</option>
          </select>
        </div>
      </div>
    </div>
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
