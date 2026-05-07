/**
 * pages/Login.jsx
 * Login page — shown to unauthenticated users.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiError } from '../api/client'

export default function Login() {
  const { login }          = useAuth()
  const navigate           = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-void flex flex-col items-center justify-center px-4 safe-bottom">

      {/* Background grain texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                    backgroundSize: '200px' }} />

      <div className="w-full max-w-sm animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink border border-ash mb-5">
            <svg className="w-8 h-8 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 9a.75.75 0 110-1.5.75.75 0 010 1.5zm10.5-1.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-cream">PhotoVault</h1>
          <p className="text-stone text-sm mt-1 font-body">Your private family library</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-ink border border-ash rounded-2xl p-8 space-y-5">

          {error && (
            <div className="bg-rose/10 border border-rose/30 text-rose text-sm rounded-lg px-4 py-3 animate-fade-in">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sand text-xs font-body font-medium uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              className="input"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sand text-xs font-body font-medium uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-stone text-xs mt-6 font-body">
          New family member?{' '}
          <a href="/register" className="text-amber hover:text-cream transition-colors">
            Use your invite link
          </a>
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}
