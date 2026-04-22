import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// Inject JWT on every request
api.interceptors.request.use(async (config) => {
  const token = window.api
    ? await window.api.store.get('token')
    : localStorage.getItem('lphub_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      if (window.api) {
        await window.api.store.delete('token')
        await window.api.store.delete('user')
        await window.api.store.delete('hub')
        await window.api.store.delete('impersonating')
      } else {
        localStorage.removeItem('lphub_token')
        localStorage.removeItem('lphub_user')
        localStorage.removeItem('lphub_hub')
        localStorage.removeItem('lphub_impersonating')
      }
      window.location.hash = '#/login'
    }
    return Promise.reject(error)
  }
)
