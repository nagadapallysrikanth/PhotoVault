/**
 * pages/Trash.jsx
 * Trash bin — restore or permanently delete photos.
 * Auto-deletes after 30 days.
 */

import { useState, useEffect } from 'react'
import { useAuth }             from '../contexts/AuthContext'
import api, { tokens, apiError } from '../api/client'
import Navbar from '../components/Navbar'

export default function Trash() {
  const { isAdmin }               = useAuth()
  const [photos,   setPhotos]     = useState([])
  const [loading,  setLoading]    = useState(true)
  const [selected, setSelected]   = useState(new Set())
  const [msg,      setMsg]        = useState('')
  const [confirm,  setConfirm]    = useState(null)  // 'empty' | 'permanent'

  useEffect(() => { loadTrash() }, [])

  async function loadTrash() {
    try {
      const r = await api.get('/trash')
      setPhotos(r.data.photos)
    } catch {}
    finally { setLoading(false) }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(photos.map(p => p.id)))
  }

  async function restoreSelected() {
    if (!selected.size) return
    try {
      await api.post('/trash/restore', Array.from(selected))
      setMsg(`${selected.size} photo(s) restored`)
      setSelected(new Set())
      loadTrash()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  async function deleteForever() {
    const ids = selected.size ? Array.from(selected) : photos.map(p => p.id)
    try {
      await api.delete('/trash/permanent', { data: ids })
      setMsg(`${ids.length} photo(s) permanently deleted`)
      setSelected(new Set())
      setConfirm(null)
      loadTrash()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  async function emptyTrash() {
    try {
      await api.delete('/trash/empty')
      setMsg('Trash emptied')
      setConfirm(null)
      loadTrash()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  const daysLeft = (trashedAt) => {
    const trashed = new Date(trashedAt)
    const deletes = new Date(trashed.getTime() + 30 * 24 * 60 * 60 * 1000)
    const days    = Math.ceil((deletes - new Date()) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }

  return (
    <div className="min-h-dvh bg-void">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl text-cream">Trash</h1>
            <p className="text-stone text-sm mt-1">
              {photos.length} photos · Auto-deletes after 30 days
            </p>
          </div>
          {isAdmin && photos.length > 0 && (
            <button onClick={() => setConfirm('empty')} className="btn-danger text-sm">
              Empty Trash
            </button>
          )}
        </div>

        {msg && (
          <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3 mb-6 animate-fade-in">
            {msg}
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="bg-ink border border-ash rounded-2xl px-4 py-3 mb-6 flex items-center justify-between gap-4 animate-slide-up">
            <p className="text-cream text-sm font-medium">{selected.size} selected</p>
            <div className="flex gap-2">
              <button onClick={restoreSelected} className="btn-primary text-sm">Restore</button>
              <button onClick={() => setConfirm('permanent')} className="btn-danger text-sm">Delete Forever</button>
              <button onClick={() => setSelected(new Set())} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="skeleton rounded-xl aspect-square" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🗑️</div>
            <p className="font-display text-xl text-sand">Trash is empty</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <button onClick={selectAll} className="btn-ghost text-sm">Select all</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {photos.map(photo => {
                const isSelected = selected.has(photo.id)
                const days = photo.trashed_at ? daysLeft(photo.trashed_at) : 30
                const thumbUrl = `${photo.thumbnail_url}?token=${tokens.access}`

                return (
                  <div
                    key={photo.id}
                    onClick={() => toggleSelect(photo.id)}
                    className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-150 ${
                      isSelected ? 'ring-2 ring-amber scale-[0.97]' : 'hover:scale-[1.02]'
                    }`}
                  >
                    <img src={thumbUrl} alt={photo.filename}
                      className="w-full aspect-square object-cover" />

                    {/* Selection indicator */}
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-amber border-amber' : 'bg-black/40 border-white/50'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-void" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>

                    {/* Days left */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                      <p className="text-white/70 text-xs">{days}d left</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* Confirm permanent delete */}
      {confirm === 'permanent' && (
        <ConfirmModal
          title="Delete Forever?"
          message={`${selected.size} photo(s) will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete Forever"
          onConfirm={deleteForever}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}

      {/* Confirm empty trash */}
      {confirm === 'empty' && (
        <ConfirmModal
          title="Empty Trash?"
          message={`All ${photos.length} photos will be permanently deleted. This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={emptyTrash}
          onCancel={() => setConfirm(null)}
          danger
        />
      )}
    </div>
  )
}


function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="bg-ink border border-ash rounded-2xl p-6 w-full max-w-sm animate-scale-in">
        <h3 className="font-display text-xl text-cream mb-2">{title}</h3>
        <p className="text-sand text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  )
}
