import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, PlusSquare, Search, Trash2, Users } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { strategyService, type StrategySummary } from '@/services/strategyService'
import { cn } from '@/lib/utils'

interface ValorantMap {
  uuid: string
  displayName: string
  listViewIcon?: string
  displayIcon?: string
}

const MAPS_CACHE_KEY = 'vapi_maps'
const MAPS_CACHE_TTL = 24 * 60 * 60 * 1000

async function loadValorantMaps() {
  try {
    const cached = localStorage.getItem(MAPS_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as { ts: number; data: ValorantMap[] }
      if (Date.now() - parsed.ts < MAPS_CACHE_TTL) return parsed.data
    }
  } catch {}

  try {
    const response = await fetch('https://valorant-api.com/v1/maps')
    const payload = (await response.json()) as { data?: ValorantMap[] }
    const maps = payload.data ?? []
    try {
      localStorage.setItem(MAPS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: maps }))
    } catch {}
    return maps
  } catch {
    return []
  }
}

function buildBoardUrl(roomCode: string, strategyId?: string) {
  const base = (import.meta.env.VITE_API_URL ?? 'https://lphub.lostpuppies.org').replace(/\/$/, '')
  const params = new URLSearchParams({ room: roomCode })
  if (strategyId) params.set('stratId', strategyId)
  return `${base}/board/strategy-board.html?${params.toString()}`
}

export default function Board() {
  const [loading, setLoading] = useState(true)
  const [strategies, setStrategies] = useState<StrategySummary[]>([])
  const [maps, setMaps] = useState<Record<string, ValorantMap>>({})
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [roomModal, setRoomModal] = useState<{ roomCode: string; url: string; title: string } | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      const [strategiesResult, mapsResult] = await Promise.allSettled([
        strategyService.list(),
        loadValorantMaps(),
      ])

      if (!active) return

      if (strategiesResult.status === 'fulfilled') {
        setStrategies(strategiesResult.value)
      } else {
        setError('Could not load saved strategies.')
      }

      if (mapsResult.status === 'fulfilled') {
        const nextMaps = Object.fromEntries(mapsResult.value.map((map) => [map.uuid, map]))
        setMaps(nextMaps)
      }

      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [])

  const strategyCountLabel = useMemo(() => {
    if (loading) return 'Loading strategies...'
    return strategies.length === 1 ? '1 saved strategy' : `${strategies.length} saved strategies`
  }, [loading, strategies.length])

  async function openRoom(strategy?: StrategySummary) {
    const key = strategy?._id ?? 'new-room'
    setBusyId(key)
    setError('')
    try {
      const { roomCode } = await strategyService.createSession()
      setRoomModal({
        roomCode,
        url: buildBoardUrl(roomCode, strategy?._id),
        title: strategy ? `Room ready for ${strategy.name}` : 'Board room ready',
      })
    } catch {
      setError('Could not create a board room right now.')
    } finally {
      setBusyId(null)
    }
  }

  async function joinRoom() {
    if (!joinCode.trim()) {
      setJoinError('Enter a room code first.')
      return
    }

    setBusyId('join-room')
    setJoinError('')
    try {
      const session = await strategyService.getSession(joinCode.trim())
      setRoomModal({
        roomCode: session.roomCode,
        url: buildBoardUrl(session.roomCode),
        title: 'Board session found',
      })
    } catch {
      setJoinError('Room not found or already expired.')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteStrategy(id: string) {
    if (!confirm('Delete this strategy?')) return
    setBusyId(`delete-${id}`)
    try {
      await strategyService.delete(id)
      setStrategies((current) => current.filter((strategy) => strategy._id !== id))
    } catch {
      setError('Could not delete this strategy.')
    } finally {
      setBusyId(null)
    }
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {}
  }

  return (
    <PageWrapper title="Board">
      <div className="flex w-full flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-accent/20 bg-gradient-to-br from-accent/10 via-bg-tertiary to-bg-tertiary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusSquare size={18} className="text-accent" />
                Strategy Board
              </CardTitle>
              <CardDescription>
                Start a fresh room, revive a saved strat, or hand off a room code while the in-app canvas is still being migrated.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => void openRoom()}
                  className="rounded-lg border border-accent/30 bg-accent px-4 py-4 text-left text-white transition-opacity hover:opacity-90"
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]">
                    <PlusSquare size={16} />
                    New Room
                  </div>
                  <p className="text-sm text-white/80">
                    Generate a fresh board session code for the team.
                  </p>
                </button>
                <div className="rounded-lg border border-border bg-bg-secondary p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-secondary">
                    <Search size={16} />
                    Join Room
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      placeholder="CORGI-394"
                      className="font-semibold uppercase tracking-[0.16em]"
                    />
                    <Button loading={busyId === 'join-room'} onClick={() => void joinRoom()}>
                      Join
                    </Button>
                  </div>
                  {joinError && <p className="mt-2 text-xs text-danger">{joinError}</p>}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-bg-secondary/80 px-4 py-3 text-sm text-text-secondary">
                Session handoff works from the app now. The full canvas editor is still the existing board implementation, so this page focuses on room management and saved strategy access first.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved Library</CardTitle>
              <CardDescription>{strategyCountLabel}</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="rounded-lg border border-border bg-bg-secondary p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">What is live now</p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <MiniMetric label="Strategies" value={String(strategies.length)} />
                  <MiniMetric label="Maps" value={String(Object.keys(maps).length || '--')} />
                  <MiniMetric label="Rooms" value="Live" />
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
                Open a saved strat to mint a room code and keep your current naming/map metadata consistent.
              </div>
            </CardBody>
          </Card>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Saved Strategies</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Reuse existing setups without losing your current desktop shell.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="h-64 animate-skeleton-pulse bg-bg-tertiary" />
              ))}
            </div>
          ) : strategies.length === 0 ? (
            <Card>
              <CardBody className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="rounded-full border border-border bg-bg-secondary p-4 text-text-muted">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-base font-semibold text-text-primary">No strategies saved yet</p>
                  <p className="mt-1 max-w-md text-sm text-text-secondary">
                    Once the team saves strats from the board workflow, they will appear here with their map and side metadata.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {strategies.map((strategy) => {
                const map = maps[strategy.map]
                const thumb = map?.listViewIcon || map?.displayIcon
                return (
                  <Card key={strategy._id} hover className="overflow-hidden">
                    <div className="h-28 bg-bg-secondary">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={map?.displayName ?? strategy.name}
                          className="h-full w-full object-cover opacity-70"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-bg-secondary to-bg-tertiary text-sm uppercase tracking-[0.18em] text-text-muted">
                          {map?.displayName ?? 'Unknown Map'}
                        </div>
                      )}
                    </div>
                    <CardBody className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-text-primary">{strategy.name}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {map?.displayName ?? 'Unknown map'}
                          </p>
                        </div>
                        <button
                          onClick={() => void deleteStrategy(strategy._id)}
                          className="rounded-md p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                          title="Delete strategy"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={strategy.side === 'atk' ? 'warning' : 'success'}>
                          {strategy.side === 'atk' ? 'Attack' : 'Defense'}
                        </Badge>
                        <span className="text-xs text-text-muted">
                          Updated {new Date(strategy.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <Button
                          variant="secondary"
                          loading={busyId === strategy._id}
                          onClick={() => void openRoom(strategy)}
                        >
                          Open Room
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void copyValue(strategy._id)}
                          className="justify-start"
                        >
                          <Copy size={14} />
                          Copy ID
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(roomModal)}
        onClose={() => setRoomModal(null)}
        title={roomModal?.title}
        className="max-w-lg"
      >
        {roomModal && (
          <div className="space-y-4">
            <div className="rounded-lg border border-accent/25 bg-accent/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Room code</p>
              <p className="mt-2 text-2xl font-semibold tracking-[0.24em] text-text-primary">
                {roomModal.roomCode}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-bg-tertiary p-4 text-sm text-text-secondary">
              Copy the code for teammates, or open the existing board surface if you want to continue inside the current web editor while the desktop-native canvas is being ported.
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => void copyValue(roomModal.roomCode)}
                className="justify-center"
              >
                <Copy size={14} />
                Copy room code
              </Button>
              <a
                href={roomModal.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover'
                )}
              >
                <ExternalLink size={14} />
                Open web board
              </a>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-tertiary px-3 py-3 text-center">
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
    </div>
  )
}
