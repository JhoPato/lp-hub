import { useEffect, useMemo, useState } from 'react'
import {
  Crown,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  siteService,
  type CobblemonLeague,
  type CobblemonLeagueStatus,
  type CobblemonMatch,
  type CobblemonRegistrationRecord,
  type CobblemonRegistrationStatus,
  type CobblemonRegistrationWindowStatus,
  type CobblemonRound,
  type CobblemonRule,
  type CobblemonStanding,
  type CobblemonVip,
  type VipTier,
} from '@/services/siteService'
import { cn } from '@/lib/utils'

type Tab = 'league' | 'bracket' | 'standings' | 'vip'

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'league', label: 'League', description: 'Season, registration window and rules' },
  { id: 'bracket', label: 'Bracket', description: 'Rounds, matches and pairing flow' },
  { id: 'standings', label: 'Standings', description: 'Leaderboard plus live registrations' },
  { id: 'vip', label: 'VIP', description: 'Cobblemon supporter tiers and perks' },
]

const LEAGUE_STATUS_OPTIONS: { value: CobblemonLeagueStatus; label: string }[] = [
  { value: 'em_breve', label: 'Coming Soon' },
  { value: 'open', label: 'Open Registration' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'closed', label: 'Closed' },
]

const REGISTRATION_STATUS_OPTIONS: { value: CobblemonRegistrationWindowStatus; label: string }[] = [
  { value: 'coming_soon', label: 'Coming Soon' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
]

const REGISTRANT_STATUS_OPTIONS: { value: CobblemonRegistrationStatus; label: string }[] = [
  { value: 'registered', label: 'Registered' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'disqualified', label: 'Disqualified' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

function emptyRule(): CobblemonRule {
  return { id: '', icon: '!', title: '', content: '' }
}

function emptyTier(index = 0): VipTier {
  return {
    id: `tier-${Date.now()}-${index}`,
    name: '',
    color: '#888888',
    price: '',
    period: '/ month',
    stripeLink: '',
    badge: 'STAR',
    badgeImg: '',
    featured: false,
    perks: [],
  }
}

function createStanding(player = '', rank = 1): CobblemonStanding {
  return { rank, player, wins: 0, losses: 0, pts: 0, buchholz: 0 }
}

function createMatch(id: string, player1 = '', player2 = ''): CobblemonMatch {
  const isBye = normalizeName(player2) === 'bye'
  return {
    id,
    player1: { name: player1, score: isBye ? 2 : null },
    player2: { name: player2, score: isBye ? 0 : null },
    winner: isBye ? 1 : null,
  }
}

function createRound(roundNumber: number): CobblemonRound {
  return { round: roundNumber, label: `Round ${roundNumber}`, matches: [] }
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function displayRegistrationName(registration: CobblemonRegistrationRecord) {
  return registration.minecraftUsername?.trim() || registration.discordUsername?.trim() || registration.discordId
}

function pairKey(a: string, b: string) {
  return [normalizeName(a), normalizeName(b)].sort().join('::')
}

function formatRegisteredAt(value?: string) {
  if (!value) return 'Unknown date'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function sortStandings(standings: CobblemonStanding[]) {
  return standings
    .map((standing) => ({
      ...standing,
      player: standing.player.trim(),
      wins: Number(standing.wins) || 0,
      losses: Number(standing.losses) || 0,
      pts: Number(standing.pts) || 0,
      buchholz: Number(standing.buchholz) || 0,
    }))
    .sort((a, b) =>
      (b.pts - a.pts) ||
      (b.buchholz - a.buchholz) ||
      (b.wins - a.wins) ||
      a.player.localeCompare(b.player)
    )
    .map((standing, index) => ({ ...standing, rank: index + 1 }))
}

function mergeStandingsFromRegistrations(
  standings: CobblemonStanding[],
  registrations: CobblemonRegistrationRecord[]
) {
  const merged = [...standings]
  const known = new Set(merged.map((standing) => normalizeName(standing.player)).filter(Boolean))

  registrations
    .filter((registration) => registration.status === 'registered' || registration.status === 'confirmed')
    .forEach((registration) => {
      const player = displayRegistrationName(registration)
      const key = normalizeName(player)
      if (!key || known.has(key)) return
      merged.push(createStanding(player, merged.length + 1))
      known.add(key)
    })

  return sortStandings(merged)
}

function calculateStandingsFromRounds(
  currentStandings: CobblemonStanding[],
  rounds: CobblemonRound[]
) {
  const stats = new Map<string, {
    player: string
    wins: number
    losses: number
    pts: number
    opponents: string[]
  }>()

  function ensurePlayer(name: string) {
    const key = normalizeName(name)
    if (!key || key === 'bye') return null
    if (!stats.has(key)) {
      stats.set(key, { player: name.trim(), wins: 0, losses: 0, pts: 0, opponents: [] })
    }
    return key
  }

  currentStandings.forEach((standing) => {
    ensurePlayer(standing.player)
  })

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      const p1Name = match.player1.name.trim()
      const p2Name = match.player2.name.trim()
      const p1Key = ensurePlayer(p1Name)
      const p2Key = ensurePlayer(p2Name)

      const p1Bye = normalizeName(p1Name) === 'bye'
      const p2Bye = normalizeName(p2Name) === 'bye'

      if (p1Key && p2Key) {
        stats.get(p1Key)!.opponents.push(p2Key)
        stats.get(p2Key)!.opponents.push(p1Key)
      }

      let winner = match.winner
      if (!winner) {
        if (p2Bye && p1Key) winner = 1
        if (p1Bye && p2Key) winner = 2
      }

      if (winner === 1 && p1Key) {
        const p1 = stats.get(p1Key)!
        p1.wins += 1
        p1.pts += 3
        if (p2Key) stats.get(p2Key)!.losses += 1
      }

      if (winner === 2 && p2Key) {
        const p2 = stats.get(p2Key)!
        p2.wins += 1
        p2.pts += 3
        if (p1Key) stats.get(p1Key)!.losses += 1
      }
    })
  })

  const standings = Array.from(stats.values()).map((stat) => ({
    rank: 0,
    player: stat.player,
    wins: stat.wins,
    losses: stat.losses,
    pts: stat.pts,
    buchholz: stat.opponents.reduce((sum, opponentKey) => sum + (stats.get(opponentKey)?.wins || 0), 0),
  }))

  return sortStandings(standings)
}

function buildPlayedPairs(rounds: CobblemonRound[]) {
  const pairs = new Set<string>()

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      const p1 = match.player1.name.trim()
      const p2 = match.player2.name.trim()
      if (!p1 || !p2) return
      if (normalizeName(p1) === 'bye' || normalizeName(p2) === 'bye') return
      pairs.add(pairKey(p1, p2))
    })
  })

  return pairs
}

function autoPairLeague(league: CobblemonLeague) {
  const standings = sortStandings(league.standings).filter((standing) => standing.player.trim())
  if (standings.length < 2) {
    return { error: 'Add at least 2 players in standings before generating a round.' }
  }

  const grouped = new Map<number, CobblemonStanding[]>()
  standings
    .sort((a, b) => (b.wins - a.wins) || (b.pts - a.pts) || (b.buchholz - a.buchholz))
    .forEach((standing) => {
      const wins = standing.wins || 0
      if (!grouped.has(wins)) grouped.set(wins, [])
      grouped.get(wins)!.push(standing)
    })

  const playedPairs = buildPlayedPairs(league.rounds)
  const winGroups = Array.from(grouped.keys()).sort((a, b) => b - a)
  const pairs: Array<[CobblemonStanding, CobblemonStanding | { player: string }]> = []
  let carry: CobblemonStanding | null = null

  winGroups.forEach((wins) => {
    const pool = carry ? [carry, ...grouped.get(wins)!] : [...grouped.get(wins)!]
    carry = null

    while (pool.length > 1) {
      const first = pool.shift()!
      let opponentIndex = pool.findIndex((candidate) => !playedPairs.has(pairKey(first.player, candidate.player)))
      if (opponentIndex === -1) opponentIndex = 0
      const second = pool.splice(opponentIndex, 1)[0]
      pairs.push([first, second])
      playedPairs.add(pairKey(first.player, second.player))
    }

    if (pool.length === 1) {
      carry = pool[0]
    }
  })

  if (carry) {
    pairs.push([carry, { player: 'BYE' }])
  }

  const nextRoundNumber = league.rounds.length + 1
  const round: CobblemonRound = {
    round: nextRoundNumber,
    label: `Round ${nextRoundNumber}`,
    matches: pairs.map((pair, index) => createMatch(`r${nextRoundNumber}m${index + 1}`, pair[0].player, pair[1].player)),
  }

  return {
    round,
    message: carry
      ? `Round ${nextRoundNumber} generated. One player received a BYE.`
      : `Round ${nextRoundNumber} generated from current standings.`,
  }
}

function statusVariant(status: string): 'default' | 'warning' | 'success' | 'danger' | 'muted' {
  if (status === 'open' || status === 'ongoing' || status === 'confirmed') return 'success'
  if (status === 'registered') return 'warning'
  if (status === 'closed' || status === 'withdrawn' || status === 'disqualified') return 'danger'
  return 'muted'
}

export default function OwnerCobblemon() {
  const [tab, setTab] = useState<Tab>('league')
  const [league, setLeague] = useState<CobblemonLeague | null>(null)
  const [vip, setVip] = useState<CobblemonVip | null>(null)
  const [registrations, setRegistrations] = useState<CobblemonRegistrationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [registrationsLoading, setRegistrationsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [registrationBusyId, setRegistrationBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleDraft, setRuleDraft] = useState<CobblemonRule>(emptyRule())
  const [ruleEditIndex, setRuleEditIndex] = useState<number | null>(null)

  const [tierModalOpen, setTierModalOpen] = useState(false)
  const [tierDraft, setTierDraft] = useState<VipTier>(emptyTier())
  const [tierEditIndex, setTierEditIndex] = useState<number | null>(null)

  async function loadRegistrations(season: number) {
    setRegistrationsLoading(true)
    try {
      const data = await siteService.getCobblemonRegistrations(season)
      setRegistrations(data.registrations)
    } catch {
      setRegistrations([])
    } finally {
      setRegistrationsLoading(false)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    setMessage('')

    const [leagueResult, vipResult] = await Promise.allSettled([
      siteService.getCobblemonLeague(),
      siteService.getCobblemonVip(),
    ])

    if (leagueResult.status === 'fulfilled') {
      setLeague(leagueResult.value)
      await loadRegistrations(leagueResult.value.season)
    } else {
      setLeague(null)
      setRegistrations([])
    }

    if (vipResult.status === 'fulfilled') {
      setVip(vipResult.value)
    } else {
      setVip(null)
    }

    if (leagueResult.status === 'rejected' || vipResult.status === 'rejected') {
      setError('Some Cobblemon content could not be loaded. The app will keep the sections that did respond.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const updateLeague = (updater: (current: CobblemonLeague) => CobblemonLeague) => {
    setLeague((current) => current ? updater(current) : current)
  }

  const updateVip = (updater: (current: CobblemonVip) => CobblemonVip) => {
    setVip((current) => current ? updater(current) : current)
  }

  const saveCurrentTab = async () => {
    if ((tab === 'league' || tab === 'bracket' || tab === 'standings') && league) {
      setSaving(true)
      setError('')
      setMessage('')
      try {
        const saved = await siteService.saveCobblemonLeague(league)
        setLeague(saved)
        await loadRegistrations(saved.season)
        setMessage(tab === 'league' ? 'League content saved.' : tab === 'bracket' ? 'Bracket saved.' : 'Standings saved.')
      } catch {
        setError('Failed to save Cobblemon league data.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (tab === 'vip' && vip) {
      setSaving(true)
      setError('')
      setMessage('')
      try {
        const saved = await siteService.saveCobblemonVip(vip)
        setVip(saved)
        setMessage('VIP tiers saved.')
      } catch {
        setError('Failed to save VIP tiers.')
      } finally {
        setSaving(false)
      }
    }
  }

  const registrationStats = useMemo(() => ({
    active: registrations.filter((registration) => registration.status !== 'withdrawn').length,
    confirmed: registrations.filter((registration) => registration.status === 'confirmed').length,
    pending: registrations.filter((registration) => registration.status === 'registered').length,
  }), [registrations])

  const bracketStats = useMemo(() => {
    const rounds = league?.rounds || []
    const matches = rounds.flatMap((round) => round.matches)
    const completed = matches.filter((match) => match.winner === 1 || match.winner === 2).length

    return {
      rounds: rounds.length,
      matches: matches.length,
      completed,
    }
  }, [league])

  const vipStats = useMemo(() => ({
    tiers: vip?.tiers.length || 0,
    featured: vip?.tiers.filter((tier) => tier.featured).length || 0,
    illustrated: vip?.tiers.filter((tier) => Boolean(tier.badgeImg)).length || 0,
  }), [vip])

  const standingsCount = league?.standings.filter((standing) => standing.player.trim()).length || 0

  const saveLabel = tab === 'league'
    ? 'Save League'
    : tab === 'bracket'
      ? 'Save Bracket'
      : tab === 'standings'
        ? 'Save Standings'
        : 'Save VIP'

  const openNewRule = () => {
    setRuleEditIndex(null)
    setRuleDraft(emptyRule())
    setRuleModalOpen(true)
  }

  const openExistingRule = (index: number) => {
    if (!league) return
    setRuleEditIndex(index)
    setRuleDraft(league.rules[index])
    setRuleModalOpen(true)
  }

  const saveRule = () => {
    if (!league) return
    if (!ruleDraft.title.trim()) return

    updateLeague((current) => {
      const rules = [...current.rules]
      const nextRule = {
        id: ruleDraft.id.trim() || `rule-${Date.now()}`,
        icon: ruleDraft.icon.trim() || '!',
        title: ruleDraft.title.trim(),
        content: ruleDraft.content.trim(),
      }

      if (ruleEditIndex === null) rules.push(nextRule)
      else rules[ruleEditIndex] = nextRule

      return { ...current, rules }
    })

    setRuleModalOpen(false)
  }

  const deleteRule = (index: number) => {
    if (!league) return
    if (!confirm('Delete this rule?')) return

    updateLeague((current) => ({
      ...current,
      rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
    }))
  }

  const openNewTier = () => {
    setTierEditIndex(null)
    setTierDraft(emptyTier())
    setTierModalOpen(true)
  }

  const openExistingTier = (index: number) => {
    if (!vip) return
    setTierEditIndex(index)
    setTierDraft(vip.tiers[index])
    setTierModalOpen(true)
  }

  const saveTier = () => {
    if (!vip) return
    if (!tierDraft.name.trim()) return

    updateVip((current) => {
      const tiers = [...current.tiers]
      const nextTier = {
        ...tierDraft,
        id: tierDraft.id.trim() || `tier-${Date.now()}`,
        name: tierDraft.name.trim(),
        color: tierDraft.color.trim() || '#888888',
        price: tierDraft.price.trim(),
        period: tierDraft.period.trim() || '/ month',
        stripeLink: tierDraft.stripeLink.trim(),
        badge: tierDraft.badge.trim() || 'STAR',
        badgeImg: tierDraft.badgeImg?.trim() || '',
        perks: tierDraft.perks.filter((perk) => perk.trim()).map((perk) => perk.trim()),
      }

      if (tierEditIndex === null) tiers.push(nextTier)
      else tiers[tierEditIndex] = nextTier

      return { ...current, tiers }
    })

    setTierModalOpen(false)
  }

  const deleteTier = (index: number) => {
    if (!vip) return
    if (!confirm('Delete this VIP tier?')) return

    updateVip((current) => ({
      ...current,
      tiers: current.tiers.filter((_, tierIndex) => tierIndex !== index),
    }))
  }

  const addRound = () => {
    if (!league) return
    updateLeague((current) => ({
      ...current,
      rounds: [...current.rounds, createRound(current.rounds.length + 1)],
    }))
  }

  const deleteRound = (roundIndex: number) => {
    if (!league) return
    if (!confirm('Delete this round and every match inside it?')) return

    updateLeague((current) => ({
      ...current,
      rounds: current.rounds
        .filter((_, index) => index !== roundIndex)
        .map((round, index) => ({ ...round, round: index + 1, label: round.label || `Round ${index + 1}` })),
    }))
  }

  const addMatch = (roundIndex: number) => {
    if (!league) return
    updateLeague((current) => ({
      ...current,
      rounds: current.rounds.map((round, index) => {
        if (index !== roundIndex) return round
        const nextMatch = createMatch(`r${round.round}m${round.matches.length + 1}`)
        return { ...round, matches: [...round.matches, nextMatch] }
      }),
    }))
  }

  const deleteMatch = (roundIndex: number, matchIndex: number) => {
    if (!league) return
    updateLeague((current) => ({
      ...current,
      rounds: current.rounds.map((round, index) => {
        if (index !== roundIndex) return round
        return {
          ...round,
          matches: round.matches
            .filter((_, innerIndex) => innerIndex !== matchIndex)
            .map((match, innerIndex) => ({ ...match, id: `r${round.round}m${innerIndex + 1}` })),
        }
      }),
    }))
  }

  const updateRoundLabel = (roundIndex: number, label: string) => {
    updateLeague((current) => ({
      ...current,
      rounds: current.rounds.map((round, index) => index === roundIndex ? { ...round, label } : round),
    }))
  }

  const updateMatchPlayer = (
    roundIndex: number,
    matchIndex: number,
    slot: 'player1' | 'player2',
    field: 'name' | 'score',
    value: string
  ) => {
    updateLeague((current) => ({
      ...current,
      rounds: current.rounds.map((round, index) => {
        if (index !== roundIndex) return round
        return {
          ...round,
          matches: round.matches.map((match, innerIndex) => {
            if (innerIndex !== matchIndex) return match

            const nextValue = field === 'score'
              ? value === '' ? null : Number(value)
              : value

            const nextMatch = {
              ...match,
              [slot]: {
                ...match[slot],
                [field]: nextValue,
              },
            }

            const p1Bye = normalizeName(nextMatch.player1.name) === 'bye'
            const p2Bye = normalizeName(nextMatch.player2.name) === 'bye'

            if (p2Bye && !p1Bye) {
              nextMatch.player1.score = nextMatch.player1.score ?? 2
              nextMatch.player2.score = nextMatch.player2.score ?? 0
              nextMatch.winner = 1
            }

            if (p1Bye && !p2Bye) {
              nextMatch.player1.score = nextMatch.player1.score ?? 0
              nextMatch.player2.score = nextMatch.player2.score ?? 2
              nextMatch.winner = 2
            }

            return nextMatch
          }),
        }
      }),
    }))
  }

  const setWinner = (roundIndex: number, matchIndex: number, winner: 1 | 2) => {
    updateLeague((current) => ({
      ...current,
      rounds: current.rounds.map((round, index) => {
        if (index !== roundIndex) return round
        return {
          ...round,
          matches: round.matches.map((match, innerIndex) => {
            if (innerIndex !== matchIndex) return match
            return { ...match, winner: match.winner === winner ? null : winner }
          }),
        }
      }),
    }))
  }

  const autoPairNextRound = () => {
    if (!league) return

    const result = autoPairLeague(league)
    if ('error' in result) {
      setError(result.error || 'Failed to build the next round.')
      setMessage('')
      return
    }

    updateLeague((current) => ({
      ...current,
      rounds: [...current.rounds, result.round],
    }))

    setError('')
    setMessage(result.message)
    setTab('bracket')
  }

  const recalculateStandings = () => {
    if (!league) return
    updateLeague((current) => ({
      ...current,
      standings: calculateStandingsFromRounds(current.standings, current.rounds),
    }))
    setError('')
    setMessage('Standings recalculated from bracket results.')
  }

  const addStanding = () => {
    updateLeague((current) => ({
      ...current,
      standings: [...current.standings, createStanding('', current.standings.length + 1)],
    }))
  }

  const updateStanding = (index: number, field: keyof CobblemonStanding, value: string) => {
    updateLeague((current) => ({
      ...current,
      standings: current.standings.map((standing, standingIndex) => {
        if (standingIndex !== index) return standing
        return {
          ...standing,
          [field]: field === 'player' ? value : Number(value) || 0,
        }
      }),
    }))
  }

  const removeStanding = (index: number) => {
    updateLeague((current) => ({
      ...current,
      standings: current.standings
        .filter((_, standingIndex) => standingIndex !== index)
        .map((standing, standingIndex) => ({ ...standing, rank: standingIndex + 1 })),
    }))
  }

  const sortStandingRows = () => {
    updateLeague((current) => ({
      ...current,
      standings: sortStandings(current.standings),
    }))
  }

  const mergeRegistrationsIntoStandings = () => {
    if (!league) return
    updateLeague((current) => ({
      ...current,
      standings: mergeStandingsFromRegistrations(current.standings, registrations),
    }))
    setError('')
    setMessage('Eligible registrations were merged into standings.')
  }

  const updateRegistrationStatus = async (registration: CobblemonRegistrationRecord, status: CobblemonRegistrationStatus) => {
    setRegistrationBusyId(registration.discordId)
    setError('')
    setMessage('')

    try {
      const response = await siteService.updateCobblemonRegistrationStatus(registration.discordId, status)
      setRegistrations((current) => current.map((entry) => (
        entry.discordId === registration.discordId ? response.registration : entry
      )))
      updateLeague((current) => ({
        ...current,
        registration: {
          ...current.registration,
          currentParticipants: response.currentParticipants,
        },
        currentParticipants: response.currentParticipants,
      }))
      setMessage(`Registration updated for ${displayRegistrationName(response.registration)}.`)
    } catch {
      setError('Failed to update registration status.')
    } finally {
      setRegistrationBusyId('')
    }
  }

  return (
    <PageWrapper title="Cobblemon">
      <div className="w-full space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
          <Card className="overflow-hidden">
            <CardBody className="relative p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_60%)]" />
              <div className="relative space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                    <Sparkles size={18} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">Cobblemon control panel</h2>
                    <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                      This app now manages the Cobblemon site with the same structure as the real panel: league,
                      bracket, standings and VIP. Bracket and standings are stored inside the league payload, while VIP
                      remains its own config.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)
                  ) : (
                    <>
                      <MetricCard label="Season" value={String(league?.season || 1)} icon={<ShieldCheck size={14} />} />
                      <MetricCard label="Tracked Players" value={String(standingsCount)} icon={<Users size={14} />} />
                      <MetricCard label="Rounds Built" value={String(bracketStats.rounds)} icon={<Swords size={14} />} />
                    </>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                League, bracket and standings save to the Cobblemon league endpoint. VIP saves separately.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              <Button variant="secondary" className="w-full justify-center" onClick={load}>
                <RefreshCw size={14} /> Refresh Cobblemon
              </Button>
              <Button className="w-full justify-center" loading={saving} onClick={saveCurrentTab} disabled={loading}>
                <Save size={14} /> {saveLabel}
              </Button>
              {league && (
                <div className="rounded-lg border border-border bg-bg-primary/70 px-3 py-2 text-sm text-text-secondary">
                  Registration window: <span className="text-text-primary">{league.registration.status.replace('_', ' ')}</span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-bg-tertiary p-1.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-lg px-4 py-2 text-left transition-colors',
                tab === item.id
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-bg-primary hover:text-text-primary'
              )}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className={cn('text-[11px] leading-5', tab === item.id ? 'text-white/80' : 'text-text-muted')}>
                {item.description}
              </div>
            </button>
          ))}
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

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : !league || !vip ? (
          <Card>
            <CardBody className="py-12 text-center text-text-secondary">
              Cobblemon data is unavailable right now.
            </CardBody>
          </Card>
        ) : (
          <>
            {tab === 'league' && (
              <LeagueTab
                league={league}
                onLeagueChange={updateLeague}
                onAddRule={openNewRule}
                onEditRule={openExistingRule}
                onDeleteRule={deleteRule}
                registrationStats={registrationStats}
              />
            )}

            {tab === 'bracket' && (
              <BracketTab
                league={league}
                onAddRound={addRound}
                onDeleteRound={deleteRound}
                onAddMatch={addMatch}
                onDeleteMatch={deleteMatch}
                onUpdateRoundLabel={updateRoundLabel}
                onUpdateMatchPlayer={updateMatchPlayer}
                onSetWinner={setWinner}
                onAutoPair={autoPairNextRound}
                onRecalculateStandings={recalculateStandings}
                stats={bracketStats}
              />
            )}

            {tab === 'standings' && (
              <StandingsTab
                league={league}
                registrations={registrations}
                registrationsLoading={registrationsLoading}
                registrationBusyId={registrationBusyId}
                onAddStanding={addStanding}
                onUpdateStanding={updateStanding}
                onRemoveStanding={removeStanding}
                onSortStandings={sortStandingRows}
                onMergeRegistrations={mergeRegistrationsIntoStandings}
                onRecalculateStandings={recalculateStandings}
                onUpdateRegistrationStatus={updateRegistrationStatus}
              />
            )}

            {tab === 'vip' && (
              <VipTab
                vip={vip}
                stats={vipStats}
                onAddTier={openNewTier}
                onEditTier={openExistingTier}
                onDeleteTier={deleteTier}
              />
            )}
          </>
        )}
      </div>

      <Modal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={ruleEditIndex === null ? 'Add Rule' : 'Edit Rule'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Rule ID"
              value={ruleDraft.id}
              onChange={(value) => setRuleDraft((current) => ({ ...current, id: value }))}
              placeholder="banlist"
            />
            <Field
              label="Icon"
              value={ruleDraft.icon}
              onChange={(value) => setRuleDraft((current) => ({ ...current, icon: value }))}
              placeholder="!"
            />
          </div>
          <Field
            label="Title"
            value={ruleDraft.title}
            onChange={(value) => setRuleDraft((current) => ({ ...current, title: value }))}
            placeholder="Format"
          />
          <TextAreaField
            label="Content"
            value={ruleDraft.content}
            onChange={(value) => setRuleDraft((current) => ({ ...current, content: value }))}
            placeholder="Describe the rule"
            rows={5}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRuleModalOpen(false)}>Cancel</Button>
            <Button onClick={saveRule}>Save Rule</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={tierModalOpen}
        onClose={() => setTierModalOpen(false)}
        title={tierEditIndex === null ? 'Add Tier' : 'Edit Tier'}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Tier ID"
              value={tierDraft.id}
              onChange={(value) => setTierDraft((current) => ({ ...current, id: value }))}
              placeholder="gold"
            />
            <Field
              label="Tier Name"
              value={tierDraft.name}
              onChange={(value) => setTierDraft((current) => ({ ...current, name: value }))}
              placeholder="Gold"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Price"
              value={tierDraft.price}
              onChange={(value) => setTierDraft((current) => ({ ...current, price: value }))}
              placeholder="EUR 5.00"
            />
            <Field
              label="Period"
              value={tierDraft.period}
              onChange={(value) => setTierDraft((current) => ({ ...current, period: value }))}
              placeholder="/ month"
            />
            <Field
              label="Color"
              value={tierDraft.color}
              onChange={(value) => setTierDraft((current) => ({ ...current, color: value }))}
              placeholder="#ffaa00"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Badge Text"
              value={tierDraft.badge}
              onChange={(value) => setTierDraft((current) => ({ ...current, badge: value }))}
              placeholder="STAR"
            />
            <Field
              label="Badge Image URL"
              value={tierDraft.badgeImg || ''}
              onChange={(value) => setTierDraft((current) => ({ ...current, badgeImg: value }))}
              placeholder="https://..."
            />
          </div>
          <Field
            label="Stripe Link"
            value={tierDraft.stripeLink}
            onChange={(value) => setTierDraft((current) => ({ ...current, stripeLink: value }))}
            placeholder="https://..."
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={tierDraft.featured}
              onChange={(event) => setTierDraft((current) => ({ ...current, featured: event.target.checked }))}
              className="h-4 w-4 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
            />
            Mark as featured tier
          </label>
          <TextAreaField
            label="Perks"
            value={tierDraft.perks.join('\n')}
            onChange={(value) => setTierDraft((current) => ({ ...current, perks: value.split('\n') }))}
            placeholder="One perk per line"
            rows={6}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTierModalOpen(false)}>Cancel</Button>
            <Button onClick={saveTier}>Save Tier</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}

function LeagueTab({
  league,
  onLeagueChange,
  onAddRule,
  onEditRule,
  onDeleteRule,
  registrationStats,
}: {
  league: CobblemonLeague
  onLeagueChange: (updater: (current: CobblemonLeague) => CobblemonLeague) => void
  onAddRule: () => void
  onEditRule: (index: number) => void
  onDeleteRule: (index: number) => void
  registrationStats: { active: number; confirmed: number; pending: number }
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Season" value={String(league.season)} icon={<ShieldCheck size={14} />} />
        <MetricCard label="Active Registrations" value={String(registrationStats.active)} icon={<Users size={14} />} />
        <MetricCard label="Confirmed Players" value={String(registrationStats.confirmed)} icon={<Trophy size={14} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>League Profile</CardTitle>
            <CardDescription>Main content for the Cobblemon league landing page.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field
              label="League Name"
              value={league.name}
              onChange={(value) => onLeagueChange((current) => ({ ...current, name: value }))}
            />
            <Field
              label="Season"
              type="number"
              value={String(league.season)}
              onChange={(value) => onLeagueChange((current) => ({ ...current, season: Number(value) || 1 }))}
            />
            <SelectField
              label="League Status"
              value={league.status}
              onChange={(value) => onLeagueChange((current) => ({ ...current, status: value as CobblemonLeagueStatus }))}
              options={LEAGUE_STATUS_OPTIONS}
            />
            <Field
              label="Status Label"
              value={league.statusLabel}
              onChange={(value) => onLeagueChange((current) => ({ ...current, statusLabel: value }))}
            />
            <Field
              label="Start Date"
              value={league.startDate}
              onChange={(value) => onLeagueChange((current) => ({ ...current, startDate: value }))}
            />
            <Field
              label="Format"
              value={league.format}
              onChange={(value) => onLeagueChange((current) => ({ ...current, format: value }))}
            />
            <div className="md:col-span-2">
              <Field
                label="Logo URL"
                value={league.logo}
                onChange={(value) => onLeagueChange((current) => ({ ...current, logo: value }))}
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-2">
              <TextAreaField
                label="Description"
                value={league.description}
                onChange={(value) => onLeagueChange((current) => ({ ...current, description: value }))}
                rows={5}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registration Window</CardTitle>
            <CardDescription>Controls how the Cobblemon site handles signups for the current season.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Registration Status"
              value={league.registration.status}
              onChange={(value) => onLeagueChange((current) => ({
                ...current,
                registration: { ...current.registration, status: value as CobblemonRegistrationWindowStatus },
              }))}
              options={REGISTRATION_STATUS_OPTIONS}
            />
            <Field
              label="Current Participants"
              type="number"
              value={String(league.registration.currentParticipants)}
              onChange={(value) => onLeagueChange((current) => ({
                ...current,
                registration: { ...current.registration, currentParticipants: Number(value) || 0 },
                currentParticipants: Number(value) || 0,
              }))}
            />
            <Field
              label="Max Participants"
              type="number"
              value={String(league.registration.maxParticipants)}
              onChange={(value) => onLeagueChange((current) => ({
                ...current,
                registration: { ...current.registration, maxParticipants: Number(value) || 0 },
                maxParticipants: Number(value) || 0,
              }))}
            />
            <div className="rounded-lg border border-border bg-bg-primary/70 px-3 py-3 text-sm text-text-secondary">
              Pending registrations: <span className="font-semibold text-text-primary">{registrationStats.pending}</span>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Discord Link"
                value={league.registration.discordLink}
                onChange={(value) => onLeagueChange((current) => ({
                  ...current,
                  registration: { ...current.registration, discordLink: value },
                  discordLink: value,
                }))}
                placeholder="https://discord.gg/..."
              />
            </div>
            <div className="md:col-span-2">
              <Field
                label="Form Link"
                value={league.registration.formLink}
                onChange={(value) => onLeagueChange((current) => ({
                  ...current,
                  registration: { ...current.registration, formLink: value },
                  formLink: value,
                }))}
                placeholder="https://..."
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Structured rules shown on the public Cobblemon site.</CardDescription>
          </div>
          <Button size="sm" onClick={onAddRule}>
            <Plus size={14} /> Add Rule
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {league.rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
              No rules added yet.
            </div>
          ) : (
            league.rules.map((rule, index) => (
              <div key={rule.id || index} className="flex gap-4 rounded-xl border border-border bg-bg-primary/60 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-bg-tertiary text-lg text-text-primary">
                  {rule.icon || '!'}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{rule.title || 'Untitled rule'}</h3>
                    <Badge variant="muted">{rule.id}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">{rule.content}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEditRule(index)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => onDeleteRule(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function BracketTab({
  league,
  onAddRound,
  onDeleteRound,
  onAddMatch,
  onDeleteMatch,
  onUpdateRoundLabel,
  onUpdateMatchPlayer,
  onSetWinner,
  onAutoPair,
  onRecalculateStandings,
  stats,
}: {
  league: CobblemonLeague
  onAddRound: () => void
  onDeleteRound: (roundIndex: number) => void
  onAddMatch: (roundIndex: number) => void
  onDeleteMatch: (roundIndex: number, matchIndex: number) => void
  onUpdateRoundLabel: (roundIndex: number, label: string) => void
  onUpdateMatchPlayer: (roundIndex: number, matchIndex: number, slot: 'player1' | 'player2', field: 'name' | 'score', value: string) => void
  onSetWinner: (roundIndex: number, matchIndex: number, winner: 1 | 2) => void
  onAutoPair: () => void
  onRecalculateStandings: () => void
  stats: { rounds: number; matches: number; completed: number }
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Rounds" value={String(stats.rounds)} icon={<Swords size={14} />} />
        <MetricCard label="Matches" value={String(stats.matches)} icon={<Users size={14} />} />
        <MetricCard label="Completed" value={String(stats.completed)} icon={<Trophy size={14} />} />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2 p-4">
          <Button size="sm" variant="secondary" onClick={onAddRound}>
            <Plus size={14} /> Empty Round
          </Button>
          <Button size="sm" onClick={onAutoPair}>
            <Swords size={14} /> Auto-pair Next Round
          </Button>
          <Button size="sm" variant="ghost" onClick={onRecalculateStandings}>
            <RefreshCw size={14} /> Recalculate Standings
          </Button>
          <div className="ml-auto text-xs leading-6 text-text-secondary">
            Auto-pair uses current standings and tries to avoid repeat matchups when possible.
          </div>
        </CardBody>
      </Card>

      {league.rounds.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-text-secondary">
            No rounds yet. Create an empty round or generate the next round from standings.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {league.rounds.map((round, roundIndex) => (
            <Card key={`${round.round}-${round.label}`} className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border bg-bg-primary/40 pb-5">
                <div className="flex items-center gap-3">
                  <Badge variant="default">R{round.round}</Badge>
                  <div className="min-w-[220px]">
                    <Field
                      label="Round Label"
                      value={round.label}
                      onChange={(value) => onUpdateRoundLabel(roundIndex, value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onAddMatch(roundIndex)}>
                    <Plus size={14} /> Match
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => onDeleteRound(roundIndex)}
                  >
                    <Trash2 size={14} /> Delete Round
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {round.matches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
                    This round has no matches yet.
                  </div>
                ) : (
                  round.matches.map((match, matchIndex) => {
                    const player1Winner = match.winner === 1
                    const player2Winner = match.winner === 2

                    return (
                      <div key={match.id} className="rounded-xl border border-border bg-bg-primary/60 p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                            Match {matchIndex + 1}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger/10 hover:text-danger"
                            onClick={() => onDeleteMatch(roundIndex, matchIndex)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <MatchRow
                            active={player1Winner}
                            faded={player2Winner}
                            player={match.player1.name}
                            score={match.player1.score}
                            onPlayerChange={(value) => onUpdateMatchPlayer(roundIndex, matchIndex, 'player1', 'name', value)}
                            onScoreChange={(value) => onUpdateMatchPlayer(roundIndex, matchIndex, 'player1', 'score', value)}
                            onWinner={() => onSetWinner(roundIndex, matchIndex, 1)}
                            label="Player 1"
                          />
                          <div className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                            VS
                          </div>
                          <MatchRow
                            active={player2Winner}
                            faded={player1Winner}
                            player={match.player2.name}
                            score={match.player2.score}
                            onPlayerChange={(value) => onUpdateMatchPlayer(roundIndex, matchIndex, 'player2', 'name', value)}
                            onScoreChange={(value) => onUpdateMatchPlayer(roundIndex, matchIndex, 'player2', 'score', value)}
                            onWinner={() => onSetWinner(roundIndex, matchIndex, 2)}
                            label="Player 2"
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StandingsTab({
  league,
  registrations,
  registrationsLoading,
  registrationBusyId,
  onAddStanding,
  onUpdateStanding,
  onRemoveStanding,
  onSortStandings,
  onMergeRegistrations,
  onRecalculateStandings,
  onUpdateRegistrationStatus,
}: {
  league: CobblemonLeague
  registrations: CobblemonRegistrationRecord[]
  registrationsLoading: boolean
  registrationBusyId: string
  onAddStanding: () => void
  onUpdateStanding: (index: number, field: keyof CobblemonStanding, value: string) => void
  onRemoveStanding: (index: number) => void
  onSortStandings: () => void
  onMergeRegistrations: () => void
  onRecalculateStandings: () => void
  onUpdateRegistrationStatus: (registration: CobblemonRegistrationRecord, status: CobblemonRegistrationStatus) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Standings Rows" value={String(league.standings.length)} icon={<Trophy size={14} />} />
        <MetricCard label="Registrations" value={String(registrations.length)} icon={<Users size={14} />} />
        <MetricCard label="Current Participants" value={String(league.registration.currentParticipants)} icon={<ShieldCheck size={14} />} />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-2 p-4">
          <Button size="sm" onClick={onAddStanding}>
            <Plus size={14} /> Add Player
          </Button>
          <Button size="sm" variant="secondary" onClick={onMergeRegistrations}>
            <Users size={14} /> Merge Registrations
          </Button>
          <Button size="sm" variant="ghost" onClick={onRecalculateStandings}>
            <RefreshCw size={14} /> Use Bracket Results
          </Button>
          <Button size="sm" variant="ghost" onClick={onSortStandings}>
            <Trophy size={14} /> Sort by Points
          </Button>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Player Standings</CardTitle>
            <CardDescription>Editable leaderboard used for pairings and public presentation.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {league.standings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
                No standings rows yet.
              </div>
            ) : (
              league.standings.map((standing, index) => (
                <div key={`${standing.player}-${index}`} className="grid gap-3 rounded-xl border border-border bg-bg-primary/60 p-4 md:grid-cols-[56px_minmax(0,1fr)_88px_88px_88px_110px_48px]">
                  <div className="flex items-center justify-center rounded-lg border border-border bg-bg-tertiary text-sm font-semibold text-text-primary">
                    #{index + 1}
                  </div>
                  <Field
                    label="Player"
                    value={standing.player}
                    onChange={(value) => onUpdateStanding(index, 'player', value)}
                  />
                  <Field
                    label="Wins"
                    type="number"
                    value={String(standing.wins)}
                    onChange={(value) => onUpdateStanding(index, 'wins', value)}
                  />
                  <Field
                    label="Losses"
                    type="number"
                    value={String(standing.losses)}
                    onChange={(value) => onUpdateStanding(index, 'losses', value)}
                  />
                  <Field
                    label="Points"
                    type="number"
                    value={String(standing.pts)}
                    onChange={(value) => onUpdateStanding(index, 'pts', value)}
                  />
                  <Field
                    label="Buchholz"
                    type="number"
                    value={String(standing.buchholz)}
                    onChange={(value) => onUpdateStanding(index, 'buchholz', value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="self-end text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => onRemoveStanding(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Season Registrations</CardTitle>
            <CardDescription>
              Live registrations from the Cobblemon auth flow for season {league.season}.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            {registrationsLoading ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
            ) : registrations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
                No registrations found for this season.
              </div>
            ) : (
              registrations.map((registration) => (
                <div key={registration.discordId} className="rounded-xl border border-border bg-bg-primary/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-text-primary">
                        {displayRegistrationName(registration)}
                      </div>
                      <div className="text-xs text-text-muted">
                        {registration.discordUsername || registration.discordId}
                      </div>
                      <div className="text-xs text-text-muted">
                        Registered {formatRegisteredAt(registration.registeredAt)}
                      </div>
                    </div>
                    <Badge variant={statusVariant(registration.status)}>
                      {registration.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <select
                      value={registration.status}
                      onChange={(event) => onUpdateRegistrationStatus(registration, event.target.value as CobblemonRegistrationStatus)}
                      disabled={registrationBusyId === registration.discordId}
                      className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                    >
                      {REGISTRANT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function VipTab({
  vip,
  stats,
  onAddTier,
  onEditTier,
  onDeleteTier,
}: {
  vip: CobblemonVip
  stats: { tiers: number; featured: number; illustrated: number }
  onAddTier: () => void
  onEditTier: (index: number) => void
  onDeleteTier: (index: number) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="VIP Tiers" value={String(stats.tiers)} icon={<Sparkles size={14} />} />
        <MetricCard label="Featured" value={String(stats.featured)} icon={<Crown size={14} />} />
        <MetricCard label="With Art Badge" value={String(stats.illustrated)} icon={<ShieldCheck size={14} />} />
      </div>

      <Card>
        <CardBody className="flex items-center justify-between p-4">
          <div className="text-sm text-text-secondary">
            Manage supporter packages shown on the Cobblemon site.
          </div>
          <Button size="sm" onClick={onAddTier}>
            <Plus size={14} /> Add Tier
          </Button>
        </CardBody>
      </Card>

      {vip.tiers.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-text-secondary">
            No VIP tiers configured yet.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {vip.tiers.map((tier, index) => (
            <Card key={tier.id} className="overflow-hidden">
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-primary text-sm font-semibold text-text-primary"
                      style={{ color: tier.color }}
                    >
                      {tier.badgeImg ? (
                        <img src={tier.badgeImg} alt={tier.name} className="h-full w-full object-contain p-2" />
                      ) : (
                        tier.badge
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-text-primary">{tier.name}</h3>
                        {tier.featured && <Badge variant="default">Featured</Badge>}
                      </div>
                      <div className="text-sm text-accent">{tier.price} <span className="text-text-muted">{tier.period}</span></div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEditTier(index)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger hover:bg-danger/10 hover:text-danger"
                      onClick={() => onDeleteTier(index)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="muted">ID: {tier.id}</Badge>
                  {tier.badgeImg && <Badge variant="muted">Custom badge art</Badge>}
                </div>

                <div className="space-y-2 text-sm text-text-secondary">
                  {tier.perks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
                      No perks listed yet.
                    </div>
                  ) : (
                    tier.perks.map((perk, perkIndex) => (
                      <div key={`${tier.id}-${perkIndex}`} className="rounded-lg border border-border bg-bg-primary/70 px-3 py-2">
                        {perk}
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchRow({
  active,
  faded,
  player,
  score,
  onPlayerChange,
  onScoreChange,
  onWinner,
  label,
}: {
  active: boolean
  faded: boolean
  player: string
  score: number | null
  onPlayerChange: (value: string) => void
  onScoreChange: (value: string) => void
  onWinner: () => void
  label: string
}) {
  return (
    <div className={cn(
      'grid gap-3 rounded-xl border border-border bg-bg-tertiary/70 p-3 md:grid-cols-[52px_minmax(0,1fr)_92px]',
      active && 'border-success/35 bg-success/10',
      faded && 'opacity-65'
    )}>
      <button
        type="button"
        onClick={onWinner}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg border text-text-muted transition-colors',
          active ? 'border-success bg-success/15 text-success' : 'border-border bg-bg-primary hover:border-accent hover:text-accent'
        )}
        title={`Set ${label} as winner`}
      >
        <Crown size={16} />
      </button>

      <Field label={label} value={player} onChange={onPlayerChange} placeholder="Player name" />

      <Field
        label="Score"
        type="number"
        value={score === null ? '' : String(score)}
        onChange={onScoreChange}
        placeholder="-"
      />
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          {icon}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-text-primary">{value}</div>
        </div>
      </CardBody>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
      />
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows || 4}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
      />
    </div>
  )
}

function SelectField<TValue extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: TValue
  onChange: (value: TValue) => void
  options: { value: TValue; label: string }[]
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}
