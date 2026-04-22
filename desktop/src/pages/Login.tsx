import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import type { TeamInfo } from '@/types'
import TeamSelectModal from '@/components/auth/TeamSelectModal'

const schema = z.object({
  email: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pendingTeams, setPendingTeams] = useState<TeamInfo[] | null>(null)
  const [tempToken, setTempToken] = useState('')
  const [discordLoading, setDiscordLoading] = useState(false)
  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  function saveAndGo(token: string, user: Parameters<typeof setUser>[0]) {
    setToken(token)
    setUser(user)
    navigate(
      user.role === 'owner'
        ? '/owner'
        : user.role === 'social'
          ? '/social'
          : '/hub-select'
    )
  }

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      const res = await authService.login(data.email, data.password)
      if ('requiresTeamSelect' in res) {
        setTempToken(res.tempToken)
        setPendingTeams(res.teams)
      } else {
        saveAndGo(res.token, res.user)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setServerError(e?.response?.data?.error ?? 'Login failed')
    }
  }

  const handleTeamSelected = async (teamId: string) => {
    try {
      const res = await authService.selectTeam(tempToken, teamId)
      saveAndGo(res.token, res.user)
    } catch {
      setServerError('Failed to select team')
      setPendingTeams(null)
    }
  }

  const handleDiscordLogin = async () => {
    if (!window.api?.discord) {
      setServerError('Discord login only available in desktop app')
      return
    }
    setDiscordLoading(true)
    setServerError('')
    try {
      const { token } = await window.api.discord.auth({ action: 'login' })
      const res = await authService.loginWithDiscordToken(token)
      saveAndGo(res.token, res.user)
    } catch (err: unknown) {
      const msg = (err as Error).message
      if (msg !== 'closed') setServerError(msg === 'no_account' ? 'No account linked to this Discord' : 'Discord login failed')
    } finally {
      setDiscordLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-primary p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">LP-Hub</h1>
          <p className="mt-1 text-sm text-text-muted">Sign in to your account</p>
        </div>

        {/* Discord login */}
        <Button
          variant="secondary"
          size="lg"
          className="w-full mb-4"
          loading={discordLoading}
          onClick={handleDiscordLogin}
        >
          <DiscordIcon />
          Continue with Discord
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-bg-primary px-3 text-text-muted">or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            placeholder="Email or username"
            id="email"
            icon={<Mail size={16} />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            icon={<Lock size={16} />}
            iconRight={
              <button type="button" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {serverError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} size="lg">
            Sign in
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-text-muted">
          No account?{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover transition-colors">
            Create one
          </Link>
        </p>
      </motion.div>

      {pendingTeams && (
        <TeamSelectModal
          teams={pendingTeams}
          onSelect={handleTeamSelected}
          onCancel={() => setPendingTeams(null)}
        />
      )}
    </div>
  )
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
