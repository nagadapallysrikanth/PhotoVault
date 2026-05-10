/**
 * pages/GuestUpload.jsx
 * Public upload page for friends — no account needed.
 * URL: /upload/:token
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api, { apiError } from '../api/client'
import Uploader from '../components/Uploader'

export default function GuestUpload() {
  const { token }             = useParams()
  const [info,     setInfo]   = useState(null)
  const [invalid,  setInvalid]= useState(false)
  const [checking, setChecking] = useState(true)
  const [uploading,setUploading]= useState(false)
  const [results,  setResults]  = useState(null)

  useEffect(() => {
    api.get(`/share/guest/${token}`)
      .then(r => { setInfo(r.data); setChecking(false) })
      .catch(() => { setInvalid(true); setChecking(false) })
  }, [token])

  async function handleUpload(files) {
    setUploading(true)
    setResults(null)
    try {
      const form = new FormData()
      files.forEach(f => form.append('files', f))
      const res = await api.post(`/share/guest/${token}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResults(res.data)
      // Refresh info to update uploads_left
      api.get(`/share/guest/${token}`).then(r => setInfo(r.data)).catch(() => {})
    } catch (e) {
      setResults({ error: apiError(e) })
    } finally {
      setUploading(false)
    }
  }

  if (checking) return <Screen><p className="text-stone animate-shimmer">Loading...</p></Screen>

  if (invalid) return (
    <Screen>
      <div className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="font-display text-2xl text-cream mb-2">Invalid Link</h2>
        <p className="text-stone text-sm">This link is invalid, expired, or has already reached its upload limit.</p>
      </div>
    </Screen>
  )

  return (
    <div className="min-h-dvh bg-void flex flex-col">

      {/* Header */}
      <header className="border-b border-ash px-4 py-4 flex items-center gap-3 safe-top">
        <svg className="w-6 h-6 text-amber shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 9a.75.75 0 110-1.5.75.75 0 010 1.5zm10.5-1.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
        <div>
          <h1 className="font-display text-lg text-cream leading-tight">PhotoVault</h1>
          <p className="text-stone text-xs">Shared upload</p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 safe-bottom">

        {/* Event info */}
        <div className="mb-8">
          <h2 className="font-display text-2xl text-cream">{info.label}</h2>
          <p className="text-sand text-sm mt-1">
            Uploading to: <span className="text-amber">{info.album_name}</span>
          </p>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-stone font-mono">
            {info.expires_at && (
              <span>⏱ Expires {new Date(info.expires_at).toLocaleDateString()}</span>
            )}
            {info.uploads_left !== null && (
              <span>📤 {info.uploads_left} upload{info.uploads_left !== 1 ? 's' : ''} remaining</span>
            )}
            <span className="tag">{info.permissions.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Uploader */}
        <Uploader
          onUpload={handleUpload}
          uploading={uploading}
          disabled={info.uploads_left === 0}
        />

        {/* Result */}
        {results && (
          <div className={`mt-4 rounded-xl p-4 animate-fade-in ${
            results.error ? 'bg-rose/10 border border-rose/20' : 'bg-amber/10 border border-amber/20'
          }`}>
            {results.error ? (
              <p className="text-rose text-sm">{results.error}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-amber font-medium">
                  ✓ {results.total} photo{results.total !== 1 ? 's' : ''} uploaded — thank you!
                </p>
                {results.errors?.length > 0 && (
                  <div className="text-stone text-xs space-y-0.5 mt-2">
                    {results.errors.map((e, i) => (
                      <p key={i}>✗ {e.file}: {e.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-stone text-xs text-center mt-8">
          Your photos will be saved to a private family library · Powered by PhotoVault
        </p>
      </main>
    </div>
  )
}

function Screen({ children }) {
  return (
    <div className="min-h-dvh bg-void flex items-center justify-center px-4">
      <div className="bg-ink border border-ash rounded-2xl p-10 max-w-sm w-full text-center animate-scale-in">
        {children}
      </div>
    </div>
  )
}
