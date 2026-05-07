/**
 * api/client.js
 * Central API layer. All backend calls go through here.
 * Handles JWT storage, auto-refresh on 401, and error normalization.
 * To change the backend URL: edit BASE_URL only.
 */

import axios from 'axios'

const BASE_URL = '/api/v1'   // proxied to http://localhost:5000 in dev

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

// ── Token helpers ────────────────────────────────────────

const TOKEN_KEY   = 'pv_access'
const REFRESH_KEY = 'pv_refresh'

export const tokens = {
  get access()  { return localStorage.getItem(TOKEN_KEY) },
  get refresh() { return localStorage.getItem(REFRESH_KEY) },
  set(access, refresh) {
    localStorage.setItem(TOKEN_KEY,   access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// ── Request interceptor: attach access token ─────────────

api.interceptors.request.use(config => {
  const token = tokens.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: auto-refresh on 401 ────────────

let isRefreshing = false
let refreshQueue = []

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then(() => api(original))
      }

      isRefreshing = true

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: tokens.refresh,
        })
        tokens.set(data.access_token, data.refresh_token)
        refreshQueue.forEach(q => q.resolve())
        refreshQueue = []
        return api(original)
      } catch {
        tokens.clear()
        refreshQueue.forEach(q => q.reject())
        refreshQueue = []
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ── Error helper ─────────────────────────────────────────

export const apiError = err =>
  err.response?.data?.detail || err.message || 'Something went wrong'


// ── Auth endpoints ───────────────────────────────────────

export const authApi = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then(r => r.data),

  logout: () =>
    api.post('/auth/logout').then(r => r.data),

  me: () =>
    api.get('/auth/me').then(r => r.data),

  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password }).then(r => r.data),

  createInvite: (label, expires_hours = 48) =>
    api.post('/auth/invite', { label, expires_hours }).then(r => r.data),

  validateInvite: (token) =>
    api.get(`/auth/invite/${token}`).then(r => r.data),

  register: (token, username, email, password) =>
    api.post('/auth/register', { token, username, email, password }).then(r => r.data),
}


// ── Photo endpoints ──────────────────────────────────────

export const photoApi = {
  list: (params = {}) =>
    api.get('/photos', { params }).then(r => r.data),

  thumbnail: (id) => {
    const token = tokens.access
    return `${BASE_URL}/photos/${id}/thumbnail${token ? `?token=${token}` : ''}`
  },

  original: (id) => `${BASE_URL}/photos/${id}/original`,

  stats: () =>
    api.get('/stats').then(r => r.data),

  scan: (drive) =>
    api.post('/scan', null, { params: drive ? { drive } : {} }).then(r => r.data),
}


// ── Album endpoints ──────────────────────────────────────

export const albumApi = {
  list: (params = {}) =>
    api.get('/albums', { params }).then(r => r.data),

  get: (id) =>
    api.get(`/albums/${id}`).then(r => r.data),
}

export default api
