/**
 * pages/Upload.jsx
 * Upload page for authenticated family members.
 * Also lets admins create and manage friend share links.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { albumApi, apiError } from '../api/client'
import api from '../api/client'
import Navbar   from '../components/Navbar'
import Uploader from '../components/Uploader'

export default function Upload() {
  const { isAdmin } = useAuth()
  const navigate    = useNavigate()

  const [albums,    setAlbums]    = useState([])
  const [drive,     setDrive]     = useState('ssd')
  const [albumName, setAlbumName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [results,   setResults]   = useState(null)

  // Share link creation (admin only)
  const [shareAlbum,  setShareAlbum]  = useState('')
  const [shareLabel,  setShareLabel]  = useState('')
  const [sharePerm,   setSharePerm]   = useState('upload_only')
  const [shareDays,   setShareDays]   = useState(7)
  const [shareLinks,  setShareLinks]  = useState([])
  const [newLink,     setNewLink]     = useState(null)
  const [creatingLink,setCreatingLink]= useState(false)
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    albumApi.list().then(setAlbums).catch(() => {})
    if (isAdmin) loadShareLinks()
  }, [isAdmin])

  async function loadShareLinks() {
    try {
      const res = await api.get('/share/links')
      setShareLinks(res.data)
    } catch {}
  }

  async function handleUpload(files) {
    setUploading(true)
    setResults(null)
    try {
      const form = new FormData()
      files.forEach(f => form.append('files', f))
      form.append('drive', drive)
      form.append('album', albumName || 'Uploads')
      const res = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResults(res.data)
      albumApi.list().then(setAlbums).catch(() => {})
    } catch (e) {
      setResults({ error: apiError(e) })
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateShareLink() {
    if (!shareAlbum || !shareLabel) return
    setCreatingLink(true)
    try {
      const res = await api.post('/share/links', {
        album_id:     parseInt(shareAlbum),
        label:        shareLabel,
        permissions:  sharePerm,
        expires_days: parseInt(shareDays),
      })
      setNewLink(res.data)
      await loadShareLinks()
    } catch (e) {
      alert(apiError(e))
    } finally {
      setCreatingLink(false)
    }
  }

  async function handleDeactivateLink(id) {
    try {
      await api.delete(`/share/links/${id}`)
      await loadShareLinks()
    } catch {}
  }

  async function copyLink(url) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-dvh bg-void">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* ── Upload section ── */}
        <section>
          <h1 className="font-display text-3xl text-cream mb-1">Upload Photos</h1>
          <p className="text-stone text-sm mb-6">Add photos to your library</p>

          {/* Drive + Album selectors */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="space-y-1.5">
              <label className="text-sand text-xs uppercase tracking-wider font-medium">Drive</label>
              <select value={drive} onChange={e => setDrive(e.target.value)} className="input">
                <option value="ssd">SSD (primary)</option>
                <option value="external">External HDD</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sand text-xs uppercase tracking-wider font-medium">Album</label>
              <input
                type="text"
                list="album-suggestions"
                className="input"
                placeholder="Album name"
                value={albumName}
                onChange={e => setAlbumName(e.target.value)}
              />
              <datalist id="album-suggestions">
                {albums.map(a => <option key={a.id} value={a.name} />)}
              </datalist>
            </div>
          </div>

          <Uploader onUpload={handleUpload} uploading={uploading} />

          {/* Upload result */}
          {results && (
            <div className={`mt-4 rounded-xl p-4 animate-fade-in ${
              results.error ? 'bg-rose/10 border border-rose/20' : 'bg-amber/10 border border-amber/20'
            }`}>
              {results.error ? (
                <p className="text-rose text-sm">{results.error}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-amber font-medium">
                    ✓ {results.total} photo{results.total !== 1 ? 's' : ''} uploaded
                  </p>
                  {results.errors?.length > 0 && (
                    <div className="text-stone text-xs space-y-0.5">
                      {results.errors.map((e, i) => (
                        <p key={i}>✗ {e.file}: {e.error}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => navigate('/')} className="text-amber text-sm hover:text-cream transition-colors">
                    View in gallery →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Share links (admin only) ── */}
        {isAdmin && (
          <section>
            <div className="border-t border-ash pt-8">
              <h2 className="font-display text-2xl text-cream mb-1">Friend Upload Links</h2>
              <p className="text-stone text-sm mb-6">
                Create links so friends can upload photos directly to an album
              </p>

              {/* Create link form */}
              <div className="bg-ink border border-ash rounded-2xl p-6 space-y-4 mb-6">
                <h3 className="text-cream font-medium">Create new link</h3>

                <div className="space-y-1.5">
                  <label className="text-sand text-xs uppercase tracking-wider font-medium">Label</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. John's BBQ July 2025"
                    value={shareLabel}
                    onChange={e => setShareLabel(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sand text-xs uppercase tracking-wider font-medium">Album</label>
                    <select value={shareAlbum} onChange={e => setShareAlbum(e.target.value)} className="input">
                      <option value="">Select album...</option>
                      {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sand text-xs uppercase tracking-wider font-medium">Expires</label>
                    <select value={shareDays} onChange={e => setShareDays(e.target.value)} className="input">
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sand text-xs uppercase tracking-wider font-medium">Permissions</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'upload_only',     label: 'Upload only',     desc: 'Friends can upload, not view' },
                      { value: 'view_and_upload',  label: 'View + Upload',   desc: 'See album and add photos' },
                    ].map(opt => (
                      <label key={opt.value}
                        className={`flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${
                          sharePerm === opt.value
                            ? 'border-amber bg-amber/10'
                            : 'border-ash hover:border-stone'
                        }`}
                      >
                        <input type="radio" name="perm" value={opt.value}
                          checked={sharePerm === opt.value}
                          onChange={() => setSharePerm(opt.value)}
                          className="hidden" />
                        <span className="text-cream text-sm font-medium">{opt.label}</span>
                        <span className="text-stone text-xs">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateShareLink}
                  disabled={!shareAlbum || !shareLabel || creatingLink}
                  className="btn-primary w-full"
                >
                  {creatingLink ? 'Creating...' : 'Create Share Link'}
                </button>
              </div>

              {/* Newly created link */}
              {newLink && (
                <div className="bg-amber/10 border border-amber/30 rounded-xl p-4 mb-6 animate-scale-in">
                  <p className="text-amber font-medium mb-2">✓ Link created — share this with your friend:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-void text-cream text-xs rounded-lg px-3 py-2 truncate font-mono">
                      {newLink.url}
                    </code>
                    <button onClick={() => copyLink(newLink.url)} className="btn-primary text-sm shrink-0">
                      {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-stone text-xs mt-2">
                    Expires: {new Date(newLink.expires_at).toLocaleDateString()} ·
                    Permissions: {newLink.permissions.replace('_', ' ')}
                  </p>
                </div>
              )}

              {/* Existing links */}
              {shareLinks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sand text-sm font-medium">Active links</h3>
                  {shareLinks.filter(l => l.is_active).map(link => (
                    <div key={link.id} className="bg-ink border border-ash rounded-xl p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-cream text-sm font-medium">{link.label}</p>
                        <p className="text-stone text-xs mt-0.5">
                          {link.upload_count} upload{link.upload_count !== 1 ? 's' : ''} ·
                          Expires {new Date(link.expires_at).toLocaleDateString()} ·
                          {link.permissions.replace('_', ' ')}
                        </p>
                        <button onClick={() => copyLink(link.url)} className="text-amber text-xs mt-1 hover:text-cream transition-colors">
                          Copy link
                        </button>
                      </div>
                      <button onClick={() => handleDeactivateLink(link.id)} className="btn-danger text-xs shrink-0">
                        Deactivate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
