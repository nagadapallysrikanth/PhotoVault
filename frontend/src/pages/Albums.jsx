/**
 * pages/Albums.jsx
 * Browse all albums as cards.
 * Create, rename, delete albums.
 */

import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import api, { tokens, apiError } from '../api/client'
import Navbar from '../components/Navbar'

export default function Albums() {
  const navigate              = useNavigate()
  const [albums,   setAlbums] = useState([])
  const [loading,  setLoading]= useState(true)
  const [showForm, setShowForm]= useState(false)
  const [msg,      setMsg]    = useState('')

  // Create form
  const [name,  setName]  = useState('')
  const [drive, setDrive] = useState('ssd')
  const [desc,  setDesc]  = useState('')
  const [saving,setSaving]= useState(false)

  // Rename
  const [renaming,   setRenaming]   = useState(null)
  const [renameName, setRenameName] = useState('')

  // Delete
  const [deleting,       setDeleting]       = useState(null)
  const [deleteAction,   setDeleteAction]   = useState('')
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  useEffect(() => { loadAlbums() }, [])

  async function loadAlbums() {
    try {
      const r = await api.get('/albums')
      setAlbums(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  async function createAlbum() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post(`/albums?name=${encodeURIComponent(name)}&drive=${drive}&description=${encodeURIComponent(desc)}`)
      setMsg('Album created!')
      setShowForm(false)
      setName(''); setDesc('')
      loadAlbums()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
    finally { setSaving(false) }
  }

  async function renameAlbum() {
    if (!renameName.trim()) return
    try {
      await api.patch(`/albums/${renaming.id}?name=${encodeURIComponent(renameName)}`)
      setRenaming(null)
      setMsg('Album renamed!')
      loadAlbums()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  async function deleteAlbum() {
    if (!deleteAction) return
    try {
      await api.delete(`/albums/${deleting.id}?photos_action=${deleteAction}`)
      setDeleting(null)
      setConfirmDelete(false)
      setMsg('Album deleted')
      loadAlbums()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  return (
    <div className="min-h-dvh bg-void">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-cream">Albums</h1>
            <p className="text-stone text-sm mt-1">{albums.length} albums</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Album
          </button>
        </div>

        {msg && <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3 mb-6 animate-fade-in">{msg}</div>}

        {/* Create album form */}
        {showForm && (
          <div className="bg-ink border border-amber/30 rounded-2xl p-6 mb-8 animate-scale-in">
            <h3 className="text-cream font-medium mb-4">Create New Album</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-sand text-xs uppercase tracking-wider font-medium">Album Name</label>
                <input type="text" className="input" placeholder="e.g. Christmas 2025"
                  value={name} onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sand text-xs uppercase tracking-wider font-medium">Drive</label>
                <select className="input" value={drive} onChange={e => setDrive(e.target.value)}>
                  <option value="ssd">SSD (primary)</option>
                  <option value="external">External HDD</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5 mb-4">
              <label className="text-sand text-xs uppercase tracking-wider font-medium">Description (optional)</label>
              <input type="text" className="input" placeholder="Add a description..."
                value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={createAlbum} disabled={!name || saving} className="btn-primary">
                {saving ? 'Creating...' : 'Create Album'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {/* Albums grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton rounded-2xl aspect-square" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-display text-xl text-sand">No albums yet</p>
            <p className="text-stone text-sm mt-1">Create your first album to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {albums.map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={() => navigate(`/?album_id=${album.id}`)}
                onRename={() => { setRenaming(album); setRenameName(album.name) }}
                onDelete={() => { setDeleting(album); setConfirmDelete(true) }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Rename modal */}
      {renaming && (
        <Modal onClose={() => setRenaming(null)} title="Rename Album">
          <input type="text" className="input mb-4" value={renameName}
            onChange={e => setRenameName(e.target.value)} autoFocus />
          <div className="flex gap-3">
            <button onClick={renameAlbum} className="btn-primary">Rename</button>
            <button onClick={() => setRenaming(null)} className="btn-ghost">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Delete modal */}
      {confirmDelete && deleting && (
        <Modal onClose={() => { setConfirmDelete(false); setDeleting(null) }} title={`Delete "${deleting.name}"?`}>
          {deleting.photo_count > 0 ? (
            <>
              <p className="text-sand text-sm mb-4">
                This album has <span className="text-cream font-medium">{deleting.photo_count} photos</span>. What should happen to them?
              </p>
              <div className="space-y-2 mb-6">
                {[
                  { value: 'trash',         label: 'Move photos to Trash',         desc: 'Recoverable for 30 days' },
                  { value: 'uncategorized', label: 'Move to Uncategorized album',   desc: 'Photos stay in library' },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    deleteAction === opt.value ? 'border-amber bg-amber/10' : 'border-ash hover:border-stone'
                  }`}>
                    <input type="radio" name="deleteAction" value={opt.value}
                      checked={deleteAction === opt.value}
                      onChange={() => setDeleteAction(opt.value)} className="mt-0.5" />
                    <div>
                      <p className="text-cream text-sm font-medium">{opt.label}</p>
                      <p className="text-stone text-xs">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={deleteAlbum} disabled={!deleteAction} className="btn-danger">Delete Album</button>
                <button onClick={() => { setConfirmDelete(false); setDeleting(null) }} className="btn-ghost">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sand text-sm mb-6">This album is empty. It will be permanently removed.</p>
              <div className="flex gap-3">
                <button onClick={() => { setDeleteAction('trash'); deleteAlbum() }} className="btn-danger">Delete</button>
                <button onClick={() => { setConfirmDelete(false); setDeleting(null) }} className="btn-ghost">Cancel</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}


function AlbumCard({ album, onClick, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { tokens: t } = { tokens }
  const coverUrl = album.cover_url
    ? `${album.cover_url}?token=${tokens.access}`
    : null

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-ink border border-ash cursor-pointer animate-fade-in">
      {/* Cover */}
      <div className="aspect-square" onClick={onClick}>
        {coverUrl ? (
          <img src={coverUrl} alt={album.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-ash" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18" />
            </svg>
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
          <p className="text-white font-medium text-sm truncate">{album.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-white/60 text-xs">{album.photo_count} photos</p>
            <span className="tag text-white/40 text-xs">{album.drive}</span>
          </div>
        </div>
      </div>

      {/* Menu button */}
      <button
        onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute top-10 right-2 bg-ink border border-ash rounded-xl shadow-lg z-10 py-1 w-36 animate-scale-in">
          <button onClick={() => { setMenuOpen(false); onRename() }}
            className="w-full text-left px-4 py-2 text-sand text-sm hover:text-cream hover:bg-ash transition-colors">
            Rename
          </button>
          <button onClick={() => { setMenuOpen(false); onDelete() }}
            className="w-full text-left px-4 py-2 text-rose text-sm hover:bg-ash transition-colors">
            Delete
          </button>
        </div>
      )}
    </div>
  )
}


function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-ink border border-ash rounded-2xl p-6 w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-cream">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
