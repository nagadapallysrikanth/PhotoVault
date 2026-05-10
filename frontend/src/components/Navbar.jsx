/**
 * components/Navbar.jsx
 * Top navigation bar. Responsive — collapses on mobile.
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function Navbar({ onScan, scanning }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate                  = useNavigate()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [waking,   setWaking]     = useState(false)
  const [wolMsg,   setWolMsg]     = useState('')

  async function handleWake() {
    setWaking(true)
    setWolMsg('')
    try {
      const res = await api.post('/wol/wake')
      setWolMsg(res.data.message)
      setTimeout(() => setWolMsg(''), 5000)
    } catch (e) {
      setWolMsg('Wake failed — check WOL config')
      setTimeout(() => setWolMsg(''), 4000)
    } finally {
      setWaking(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 bg-void/90 backdrop-blur-md border-b border-ash safe-top">
      {/* WOL status message */}
      {wolMsg && (
        <div className="bg-amber/10 border-b border-amber/20 text-amber text-xs px-4 py-1.5 text-center animate-fade-in">
          {wolMsg}
        </div>
      )}
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
          <a href="/albums" className="btn-ghost text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            Albums
          </a>
          <a href="/upload" className="btn-ghost text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            Upload
          </a>
          <a href="/trash" className="btn-ghost text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Trash
          </a>
          {isAdmin && (
            <a href="/admin" className="btn-ghost text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin
            </a>
          )}
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
          <button
            onClick={handleWake}
            disabled={waking}
            className="btn-ghost text-sm flex items-center gap-1.5"
            title="Wake home PC"
          >
            <svg className={`w-4 h-4 ${waking ? 'animate-pulse text-amber' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
            </svg>
            {waking ? 'Waking...' : 'Wake PC'}
          </button>
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
            <a href="/trash" className="block btn-ghost text-sm py-2.5">Trash</a>
            {isAdmin && (
              <button
                onClick={() => { onScan(); setMenuOpen(false) }}
                disabled={scanning}
                className="w-full text-left btn-ghost text-sm py-2.5"
              >
                {scanning ? 'Scanning...' : 'Scan Drives'}
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
