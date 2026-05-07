/**
 * components/Navbar.jsx
 * Top navigation bar. Responsive — collapses on mobile.
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Navbar({ onScan, scanning }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate                  = useNavigate()
  const [menuOpen, setMenuOpen]   = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 bg-void/90 backdrop-blur-md border-b border-ash safe-top">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 shrink-0">
          <svg className="w-6 h-6 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 9a.75.75 0 110-1.5.75.75 0 010 1.5zm10.5-1.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
          <span className="font-display text-lg text-cream tracking-wide">PhotoVault</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={onScan}
              disabled={scanning}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <svg className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {scanning ? 'Scanning...' : 'Scan Drives'}
            </button>
          )}
          <div className="w-px h-5 bg-ash mx-1" />
          <div className="flex items-center gap-2 pl-1">
            <div className="w-7 h-7 rounded-full bg-ash flex items-center justify-center">
              <span className="text-amber font-body font-medium text-xs uppercase">
                {user?.username?.[0]}
              </span>
            </div>
            <span className="text-sand text-sm">{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="btn-ghost text-sm ml-1">
            Sign out
          </button>
        </nav>

        {/* Mobile menu button */}
        <button
          className="sm:hidden btn-ghost p-2"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-ash bg-ink animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 py-2 border-b border-ash mb-2">
              <div className="w-8 h-8 rounded-full bg-ash flex items-center justify-center">
                <span className="text-amber font-medium text-sm uppercase">{user?.username?.[0]}</span>
              </div>
              <div>
                <p className="text-cream text-sm font-medium">{user?.username}</p>
                <p className="text-stone text-xs capitalize">{user?.role}</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => { onScan(); setMenuOpen(false) }}
                disabled={scanning}
                className="w-full text-left btn-ghost text-sm py-2.5"
              >
                {scanning ? '🔄 Scanning...' : '🔍 Scan Drives'}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left btn-ghost text-sm py-2.5 text-rose"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
