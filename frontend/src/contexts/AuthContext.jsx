/**
 * contexts/AuthContext.jsx
 * Global authentication state.
 * Wrap the app in <AuthProvider> and use useAuth() anywhere.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi, tokens, apiError } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)  // true on first load

  // Check if already logged in on mount
  useEffect(() => {
    if (tokens.access) {
      authApi.me()
        .then(setUser)
        .catch(() => tokens.clear())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    tokens.set(data.access_token, data.refresh_token)
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    tokens.clear()
    setUser(null)
  }, [])

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin:  user?.role === 'admin',
    isFamily: user?.role === 'family' || user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
