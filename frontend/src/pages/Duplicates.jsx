/**
 * pages/Duplicates.jsx
 * Review duplicate photo groups and decide what to keep.
 */

import { useState, useEffect } from 'react'
import { useAuth }             from '../contexts/AuthContext'
import { useNavigate }         from 'react-router-dom'
import api, { tokens, apiError } from '../api/client'
import Navbar from '../components/Navbar'

export default function Duplicates() {
  const { isAdmin } = useAuth()
  const navigate    = useNavigate()
  const [status,   setStatus]   = useState(null)
  const [results,  setResults]  = useState(null)
  const [scanning, setScanning] = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
    checkStatus()
  }, [isAdmin, navigate])

  async function checkStatus() {
    try {
      const r = await api.get('/duplicates/status')
      setStatus(r.data)
      if (r.data.has_results) loadResults()
    } catch {}
  }

  async function loadResults() {
    try {
      const r = await api.get('/duplicates/results')
      setResults(r.data)
    } catch {}
  }

  async function startScan() {
    setScanning(true)
    try {
      await api.post('/duplicates/scan')
      setMsg('Scan started — this may take a few minutes...')
      // Poll for completion
      const interval = setInterval(async () => {
        const r = await api.get('/duplicates/status')
        setStatus(r.data)
        if (!r.data.running && r.data.has_results) {
          clearInterval(interval)
          setScanning(false)
          setMsg('')
          loadResults()
        }
      }, 3000)
    } catch (e) {
      setMsg(apiError(e))
      setScanning(false)
    }
  }

  async function resolve(keepIds, deleteIds) {
    try {
      await api.post('/duplicates/resolve', { keep_ids: keepIds, delete_ids: deleteIds })
      setMsg(`✓ Kept ${keepIds.length}, moved ${deleteIds.length} to trash`)
      loadResults()
      setTimeout(() => setMsg(''), 4000)
    } catch (e) { setMsg(apiError(e)) }
  }

  return (
    <div className="min-h-dvh bg-void">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-cream">Duplicate Photos</h1>
            <p className="text-stone text-sm mt-1">Find and resolve similar photos in your library</p>
          </div>
          <button onClick={startScan} disabled={scanning} className="btn-primary flex items-center gap-2">
            {scanning ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Scanning...
              </>
            ) : 'Scan for Duplicates'}
          </button>
        </div>

        {msg && (
          <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3 mb-6 animate-fade-in">
            {msg}
          </div>
        )}

        {/* Stats */}
        {results && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Groups',   value: results.total_groups },
              { label: 'Exact Dupes',    value: results.exact    },
              { label: 'Near Dupes',     value: results.near     },
              { label: 'Similar Photos', value: results.similar  },
            ].map(s => (
              <div key={s.label} className="bg-ink border border-ash rounded-2xl p-4">
                <p className="font-display text-2xl text-amber">{s.value}</p>
                <p className="text-stone text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Duplicate groups */}
        {results?.groups?.length > 0 ? (
          <div className="space-y-6">
            {results.groups.map((group, i) => (
              <DuplicateGroup key={i} group={group} onResolve={resolve} />
            ))}
          </div>
        ) : results ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <p className="font-display text-xl text-sand">No duplicates found!</p>
            <p className="text-stone text-sm mt-1">Your library is clean</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-stone text-sm">Click "Scan for Duplicates" to get started</p>
          </div>
        )}
      </main>
    </div>
  )
}


function DuplicateGroup({ group, onResolve }) {
  const [selected, setSelected] = useState(new Set([group.photos[0]?.id]))
  const [resolved, setResolved] = useState(false)

  if (resolved) return null

  const typeColors = {
    exact:   'text-rose',
    near:    'text-amber',
    similar: 'text-blue-400',
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleResolve() {
    const keepIds   = Array.from(selected)
    const deleteIds = group.photos.map(p => p.id).filter(id => !selected.has(id))
    await onResolve(keepIds, deleteIds)
    setResolved(true)
  }

  return (
    <div className="bg-ink border border-ash rounded-2xl p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${typeColors[group.type]}`}>
              {group.similarity}% match
            </span>
            <span className="tag">{group.type}</span>
          </div>
          <p className="text-stone text-xs mt-0.5">{group.label}</p>
        </div>
        <p className="text-stone text-xs">{group.photos.length} photos</p>
      </div>

      {/* Photo comparison */}
      <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
        {group.photos.map(photo => {
          const isKept = selected.has(photo.id)
          return (
            <div
              key={photo.id}
              onClick={() => toggle(photo.id)}
              className={`shrink-0 cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                isKept ? 'border-amber scale-[1.02]' : 'border-ash opacity-60 hover:opacity-80'
              }`}
            >
              <img
                src={`${photo.thumbnail_url}?token=${tokens.access}`}
                alt={photo.filename}
                className="w-36 h-36 object-cover"
              />
              <div className="px-2 py-1.5 bg-void/80">
                <p className="text-xs text-sand truncate">{photo.filename}</p>
                <p className="text-xs text-stone">{photo.size_kb} KB · {photo.drive}</p>
                {isKept && <p className="text-amber text-xs font-medium">✓ Keep</p>}
                {!isKept && <p className="text-rose text-xs">→ Trash</p>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-stone text-xs mb-3">
        Click photos to select which to keep. Unselected go to trash (recoverable).
      </p>

      <div className="flex gap-3">
        <button
          onClick={handleResolve}
          disabled={!selected.size}
          className="btn-primary text-sm"
        >
          Keep {selected.size} · Trash {group.photos.length - selected.size}
        </button>
        <button
          onClick={() => setResolved(true)}
          className="btn-ghost text-sm"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
