import { useEffect, useMemo, useState } from 'react'
import { KeyRound, MonitorSmartphone, RefreshCw, Save, Shield, Trash2, Upload, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { workspaceService, type ProfileMe } from '@/services/workspaceService'

export default function Settings() {
  const navigate = useNavigate()
  const { user, hub, impersonating, logout, stopImpersonation, setUser } = useAuthStore()
  const [version, setVersion] = useState<string>('desktop')
  const [loadingProfile, setLoadingProfile] = useState(true)
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

  const showCompetitiveSettings = useMemo(
    () => user?.role === 'player' || user?.role === 'captain' || user?.role === 'manager',
    [user?.role]
  )

  useEffect(() => {
    let active = true
    window.api?.getVersion()
      .then((value) => {
        if (active) setVersion(value)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [])

  async function loadProfile() {
    setLoadingProfile(true)
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
      setLoadingProfile(false)
    }
  }

  function clearHubSelection() {
    if (window.api) {
      void window.api.store.delete('hub')
    } else {
      localStorage.removeItem('lphub_hub')
    }
    navigate('/hub-select')
  }

  function resetSession() {
    logout()
    navigate('/login')
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
    <PageWrapper title="Settings">
      <div className="flex w-full flex-col gap-6">
        {error && <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div>}
        {success && <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{success}</div>}

        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound size={18} className="text-accent" />
                Identity
              </CardTitle>
              <CardDescription>Profile, avatar and role details used across the app.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg-secondary p-5 text-center">
                <Avatar src={profile?.discordAvatar || profile?.profilePhotoUrl} name={profile?.username || user?.username} size="xl" />
                <div>
                  <p className="font-medium text-text-primary">{profile?.username || user?.username || 'Profile'}</p>
                  <div className="mt-2 flex justify-center">
                    {user?.role && (
                      <Badge variant={user.role === 'owner' ? 'warning' : user.role === 'social' ? 'default' : 'muted'}>
                        {user.role}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              />
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => void uploadPhoto()}
                  loading={savingPhoto}
                  disabled={!photoFile || loadingProfile}
                >
                  <Upload size={14} /> Upload photo
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account details</CardTitle>
              <CardDescription>Basic information for your account and session identity.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Username" value={accountForm.username} onChange={(value) => setAccountForm((current) => ({ ...current, username: value }))} />
                <Field label="Email" value={accountForm.email} onChange={(value) => setAccountForm((current) => ({ ...current, email: value }))} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void saveAccount()} loading={savingAccount} disabled={loadingProfile}>
                  <Save size={14} /> Save account
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone size={18} className="text-accent" />
                Desktop App
              </CardTitle>
              <CardDescription>Current runtime and connection details for this desktop build.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <SettingRow label="Version" value={version} />
              <SettingRow label="API" value={import.meta.env.VITE_API_URL ?? 'http://localhost:3000'} mono />
              <SettingRow label="Discord auth" value={window.api?.discord ? 'Available' : 'Unavailable'} />
              <SettingRow label="Window controls" value={window.api?.window ? 'Native Electron' : 'Browser fallback'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield size={18} className="text-accent" />
                Session
              </CardTitle>
              <CardDescription>Inspect the active account, hub and app state from one place.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="rounded-lg border border-border bg-bg-secondary p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-medium text-text-primary">{user?.username || 'Unknown user'}</p>
                  {user?.role && (
                    <Badge variant={user.role === 'owner' ? 'warning' : user.role === 'social' ? 'default' : 'muted'}>
                      {user.role}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {user?.email || 'No email exposed for this session.'}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {hub ? `${hub.teamName} - ${hub.teamTag} - ${hub.teamRegion}` : 'No hub selected'}
                </p>
              </div>

              {impersonating && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                  <p className="text-sm font-medium text-warning">Impersonation active</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    You can leave the current view and restore the owner session from here.
                  </p>
                  <Button variant="secondary" className="mt-3" onClick={stopImpersonation}>
                    Exit impersonation
                  </Button>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                {hub && (
                  <Button variant="secondary" onClick={clearHubSelection}>
                    <RefreshCw size={14} />
                    Change hub
                  </Button>
                )}
                <Button variant="danger" onClick={resetSession}>
                  <Trash2 size={14} />
                  Reset session
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>

        {showCompetitiveSettings && (
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
              <div className="flex justify-end xl:col-span-2">
                <Button onClick={() => void saveRiot()} loading={savingRiot} disabled={loadingProfile}>
                  <Save size={14} /> Save Riot IDs
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={18} className="text-accent" />
              Password
            </CardTitle>
            <CardDescription>Change your account password without leaving the desktop app.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Current password" type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} />
            <Field label="New password" type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} />
            <div className="flex justify-end md:col-span-2">
              <Button
                variant="secondary"
                onClick={() => void savePassword()}
                loading={savingPassword}
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword}
              >
                <Save size={14} /> Change password
              </Button>
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
          <select
            value={region}
            onChange={(event) => onRegionChange(event.target.value)}
            className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
          >
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

function SettingRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={mono ? 'mt-1 break-all font-mono text-sm text-text-primary' : 'mt-1 text-sm text-text-primary'}>
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      />
    </div>
  )
}
