import { create } from 'zustand'
import type { User, ActiveHub } from '@/types'

interface OriginalAuth {
  token: string
  user: User
  hub: ActiveHub | null
}

interface AuthState {
  token: string | null
  user: User | null
  hub: ActiveHub | null
  isLoading: boolean
  impersonating: OriginalAuth | null
  setToken: (token: string) => void
  setUser: (user: User) => void
  setHub: (hub: ActiveHub) => void
  logout: () => void
  hydrate: () => Promise<void>
  startImpersonation: (token: string, user: User, hub: ActiveHub) => void
  stopImpersonation: () => void
}

async function storeSet(key: string, value: unknown) {
  if (window.api) await window.api.store.set(key, value)
  else localStorage.setItem(`lphub_${key}`, JSON.stringify(value))
}

async function storeGet(key: string): Promise<unknown> {
  if (window.api) return window.api.store.get(key)
  const raw = localStorage.getItem(`lphub_${key}`)
  return raw ? JSON.parse(raw) : null
}

async function storeDel(key: string) {
  if (window.api) await window.api.store.delete(key)
  else localStorage.removeItem(`lphub_${key}`)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hub: null,
  isLoading: true,
  impersonating: null,

  setToken: (token) => { set({ token }); storeSet('token', token) },
  setUser: (user) => { set({ user }); storeSet('user', user) },
  setHub: (hub) => { set({ hub }); storeSet('hub', hub) },

  logout: () => {
    set({ token: null, user: null, hub: null, impersonating: null })
    storeDel('token'); storeDel('user'); storeDel('hub'); storeDel('impersonating')
  },

  hydrate: async () => {
    try {
      const token = (await storeGet('token')) as string | null
      const user = (await storeGet('user')) as User | null
      const hub = (await storeGet('hub')) as ActiveHub | null
      const impersonating = (await storeGet('impersonating')) as OriginalAuth | null
      set({ token, user, hub, impersonating })
    } finally {
      set({ isLoading: false })
    }
  },

  startImpersonation: (token, user, hub) => {
    const { token: origToken, user: origUser, hub: origHub } = get()
    if (!origToken || !origUser) return
    const original = { token: origToken, user: origUser, hub: origHub }
    set({ impersonating: original, token, user, hub })
    storeSet('impersonating', original)
    storeSet('token', token)
    storeSet('user', user)
    storeSet('hub', hub)
  },

  stopImpersonation: () => {
    const orig = get().impersonating
    if (!orig) return
    set({ token: orig.token, user: orig.user, hub: orig.hub, impersonating: null })
    storeSet('token', orig.token)
    storeSet('user', orig.user)
    storeSet('hub', orig.hub)
    storeDel('impersonating')
  },
}))
