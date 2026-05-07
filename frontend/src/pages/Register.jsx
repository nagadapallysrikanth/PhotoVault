/**
 * pages/Register.jsx
 * Family self-registration via invite link.
 * URL: /register?invite=TOKEN
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, apiError } from '../api/client'

export default function Register() {
  const navigate              = useNavigate()
  const [params]              = useSearchParams()
  const token                 = params.get('invite') || ''

  const [invite,   setInvite]   = useState(null)
  const [checking, setChecking] = useState(true)
  const [invalid,  setInvalid]  = useState(false)

  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)

  // Validate invite token on load
  useEffect(() => {
    if (!token) { setInvalid(true); setChecking(false); return }
    authApi.validateInvite(token)
      .then(data => { setInvite(data); setChecking(false) })
      .catch(() => { setInvalid(true); setChecking(false) })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.register(token, username.trim(), email.trim(), password)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <LoadingScreen message="Validating your invite..." />
  }

  if (invalid) {
    return (
      <CenteredCard>
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="font-display text-2xl text-cream mb-2">Invalid Link</h2>
          <p className="text-stone text-sm mb-6">
            This invite link is invalid, expired, or has already been used.
          </p>
          <a href="/login" className="btn-primary inline-block">Back to Login</a>
        </div>
      </CenteredCard>
    )
  }

  if (success) {
    return (
      <CenteredCard>
        <div className="text-center animate-scale-in">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="font-display text-2xl text-cream mb-2">Welcome!</h2>
          <p className="text-stone text-sm">Account created. Redirecting to login...</p>
        </div>
      </CenteredCard>
    )
  }

  return (
    <div className="min-h-dvh bg-void flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-cream">Join PhotoVault</h1>
          {invite?.label && (
            <p className="text-amber text-sm mt-1 font-body">{invite.label}</p>
          )}
          <p className="text-stone text-sm mt-1">Create your family account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-ink border border-ash rounded-2xl p-8 space-y-5">

          {error && (
            <div className="bg-rose/10 border border-rose/30 text-rose text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {[
            { label: 'Username', type: 'text',     value: username, set: setUsername, placeholder: 'Choose a username',  auto: 'username' },
            { label: 'Email',    type: 'email',    value: email,    set: setEmail,    placeholder: 'your@email.com',      auto: 'email' },
            { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: 'Min 8 chars + number', auto: 'new-password' },
          ].map(f => (
            <div key={f.label} className="space-y-1.5">
              <label className="text-sand text-xs font-body font-medium uppercase tracking-wider">
                {f.label}
              </label>
              <input
                type={f.type}
                className="input"
                placeholder={f.placeholder}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                autoComplete={f.auto}
                required
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-stone text-xs mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-amber hover:text-cream transition-colors">Sign in</a>
        </p>
      </div>
    </div>
  )
}

function CenteredCard({ children }) {
  return (
    <div className="min-h-dvh bg-void flex items-center justify-center px-4">
      <div className="bg-ink border border-ash rounded-2xl p-10 max-w-sm w-full animate-scale-in">
        {children}
      </div>
    </div>
  )
}

function LoadingScreen({ message }) {
  return (
    <div className="min-h-dvh bg-void flex items-center justify-center">
      <p className="text-stone font-body animate-shimmer">{message}</p>
    </div>
  )
}
