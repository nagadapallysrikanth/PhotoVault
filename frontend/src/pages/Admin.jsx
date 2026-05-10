/**
 * pages/Admin.jsx
 * Admin dashboard — visible only to admin role.
 * Tabs: Dashboard | Users | Share Links | Invite Links
 */

import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { useAuth }             from '../contexts/AuthContext'
import api, { apiError }       from '../api/client'
import Navbar                  from '../components/Navbar'

const TABS = ['Dashboard', 'Users', 'Share Links', 'Invites']

export default function Admin() {
  const { isAdmin }       = useAuth()
  const navigate          = useNavigate()
  const [tab, setTab]     = useState('Dashboard')

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  return (
    <div className="min-h-dvh bg-void">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl text-cream">Admin Panel</h1>
          <p className="text-stone text-sm mt-1">Manage your PhotoVault</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-ink border border-ash rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-body transition-all duration-150 ${
                tab === t
                  ? 'bg-amber text-void font-medium'
                  : 'text-stone hover:text-cream'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Dashboard'   && <DashboardTab />}
        {tab === 'Users'       && <UsersTab />}
        {tab === 'Share Links' && <ShareLinksTab />}
        {tab === 'Invites'     && <InvitesTab />}
      </main>
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// Dashboard Tab
// ─────────────────────────────────────────────────────────

function DashboardTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingGrid />
  if (!data)   return <ErrorMsg msg="Could not load dashboard" />

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Photos',  value: data.photos.total.toLocaleString(), icon: '🖼️' },
          { label: 'Storage Used',  value: `${data.photos.size_gb} GB`,        icon: '💾' },
          { label: 'Family Members',value: data.users.active,                  icon: '👨‍👩‍👧' },
          { label: 'Active Links',  value: data.share_links.active,            icon: '🔗' },
        ].map(s => (
          <div key={s.label} className="bg-ink border border-ash rounded-2xl p-5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="font-display text-2xl text-cream">{s.value}</div>
            <div className="text-stone text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Drive stats */}
      <div>
        <h2 className="font-display text-xl text-cream mb-4">Storage Drives</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {data.drives.map(d => (
            <div key={d.drive} className="bg-ink border border-ash rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-cream font-medium capitalize">{d.drive}</p>
                  <p className="text-stone text-xs font-mono">{d.path}</p>
                </div>
                <span className={`tag ${d.available ? 'text-green-400' : 'text-rose'}`}>
                  {d.available ? '● online' : '● offline'}
                </span>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-amber font-display text-xl">{d.photos.toLocaleString()}</p>
                  <p className="text-stone text-xs">photos</p>
                </div>
                <div>
                  <p className="text-amber font-display text-xl">{d.size_gb}</p>
                  <p className="text-stone text-xs">GB used</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent uploads */}
      {data.recent_uploads?.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-cream mb-4">Recent Uploads</h2>
          <div className="bg-ink border border-ash rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ash">
                  {['File', 'Album', 'Drive', 'By', 'Size', 'When'].map(h => (
                    <th key={h} className="text-left text-stone text-xs uppercase tracking-wider px-4 py-3 font-body">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ash">
                {data.recent_uploads.map(p => (
                  <tr key={p.id} className="hover:bg-ash/30 transition-colors">
                    <td className="px-4 py-3 text-cream truncate max-w-[140px]">{p.filename}</td>
                    <td className="px-4 py-3 text-sand">{p.album}</td>
                    <td className="px-4 py-3"><span className="tag">{p.drive}</span></td>
                    <td className="px-4 py-3 text-sand">{p.uploaded_by}</td>
                    <td className="px-4 py-3 text-stone font-mono text-xs">{p.size_kb} KB</td>
                    <td className="px-4 py-3 text-stone text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────────────────────

function UsersTab() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const r = await api.get('/admin/users')
      setUsers(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  async function toggleUser(id) {
    try {
      const r = await api.patch(`/admin/users/${id}/toggle`)
      setMsg(r.data.message)
      loadUsers()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  if (loading) return <LoadingGrid />

  return (
    <div className="space-y-4 animate-fade-in">
      {msg && <Toast msg={msg} />}

      <div className="bg-ink border border-ash rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ash">
              {['User', 'Role', 'Photos', 'Last Login', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left text-stone text-xs uppercase tracking-wider px-4 py-3 font-body">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ash">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-ash/30 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-cream font-medium">{u.username}</p>
                    <p className="text-stone text-xs">{u.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`tag ${u.role === 'admin' ? 'text-amber' : 'text-sand'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sand">{u.photo_count}</td>
                <td className="px-4 py-3 text-stone text-xs">
                  {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <span className={`tag ${u.is_active ? 'text-green-400' : 'text-rose'}`}>
                    {u.is_active ? '● active' : '● disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => toggleUser(u.id)}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                        u.is_active
                          ? 'bg-rose/20 text-rose hover:bg-rose/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// Share Links Tab
// ─────────────────────────────────────────────────────────

function ShareLinksTab() {
  const [links,   setLinks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')

  useEffect(() => { loadLinks() }, [])

  async function loadLinks() {
    try {
      const r = await api.get('/admin/share-links')
      setLinks(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  async function deactivate(id) {
    try {
      await api.delete(`/admin/share-links/${id}`)
      setMsg('Link deactivated')
      loadLinks()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  async function copyLink(url) {
    await navigator.clipboard.writeText(url)
    setMsg('Link copied!')
    setTimeout(() => setMsg(''), 2000)
  }

  if (loading) return <LoadingGrid />

  return (
    <div className="space-y-4 animate-fade-in">
      {msg && <Toast msg={msg} />}

      {links.length === 0 ? (
        <Empty msg="No share links created yet" />
      ) : (
        <div className="space-y-3">
          {links.map(l => (
            <div key={l.id} className="bg-ink border border-ash rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-cream font-medium">{l.label}</p>
                  <span className={`tag ${l.is_active ? 'text-green-400' : 'text-stone line-through'}`}>
                    {l.is_active ? 'active' : 'inactive'}
                  </span>
                  <span className="tag">{l.permissions.replace('_', ' ')}</span>
                </div>
                <p className="text-stone text-xs mt-1">
                  Album: <span className="text-sand">{l.album}</span> ·
                  By: <span className="text-sand">{l.created_by}</span> ·
                  {l.upload_count} uploads ·
                  Expires: {l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'never'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => copyLink(l.url)} className="btn-ghost text-xs">
                  Copy link
                </button>
                {l.is_active && (
                  <button onClick={() => deactivate(l.id)} className="btn-danger text-xs">
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// Invites Tab
// ─────────────────────────────────────────────────────────

function InvitesTab() {
  const [invites,  setInvites]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [label,    setLabel]    = useState('')
  const [hours,    setHours]    = useState(48)
  const [creating, setCreating] = useState(false)
  const [newLink,  setNewLink]  = useState(null)
  const [msg,      setMsg]      = useState('')
  const [copied,   setCopied]   = useState(false)

  useEffect(() => { loadInvites() }, [])

  async function loadInvites() {
    try {
      const r = await api.get('/admin/invites')
      setInvites(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  async function createInvite() {
    if (!label) return
    setCreating(true)
    try {
      const r = await api.post('/admin/invite', { label, expires_hours: parseInt(hours) })
      setNewLink(r.data)
      setLabel('')
      loadInvites()
    } catch (e) { setMsg(apiError(e)) }
    finally { setCreating(false) }
  }

  async function copyLink(url) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <LoadingGrid />

  return (
    <div className="space-y-6 animate-fade-in">
      {msg && <Toast msg={msg} />}

      {/* Create invite form */}
      <div className="bg-ink border border-ash rounded-2xl p-6 space-y-4">
        <h3 className="text-cream font-medium">Create Family Invite</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sand text-xs uppercase tracking-wider font-medium">Label</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Mom's invite"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sand text-xs uppercase tracking-wider font-medium">Expires in</label>
            <select value={hours} onChange={e => setHours(e.target.value)} className="input">
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
            </select>
          </div>
        </div>
        <button onClick={createInvite} disabled={!label || creating} className="btn-primary">
          {creating ? 'Creating...' : 'Create Invite Link'}
        </button>
      </div>

      {/* Newly created invite */}
      {newLink && (
        <div className="bg-amber/10 border border-amber/30 rounded-xl p-4 animate-scale-in">
          <p className="text-amber font-medium mb-2">✓ Invite created — send this link:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-void text-cream text-xs rounded-lg px-3 py-2 truncate font-mono">
              {newLink.url}
            </code>
            <button onClick={() => copyLink(newLink.url)} className="btn-primary text-sm shrink-0">
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-stone text-xs mt-2">
            Expires: {new Date(newLink.expires_at).toLocaleString()} · One-time use
          </p>
        </div>
      )}

      {/* Existing invites */}
      {invites.length > 0 && (
        <div className="bg-ink border border-ash rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ash">
                {['Label', 'Expires', 'Status', 'Used By'].map(h => (
                  <th key={h} className="text-left text-stone text-xs uppercase tracking-wider px-4 py-3 font-body">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ash">
              {invites.map(i => (
                <tr key={i.id} className="hover:bg-ash/30 transition-colors">
                  <td className="px-4 py-3 text-cream">{i.label}</td>
                  <td className="px-4 py-3 text-stone text-xs">{new Date(i.expires_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`tag ${i.used ? 'text-stone' : i.is_active ? 'text-green-400' : 'text-rose'}`}>
                      {i.used ? 'used' : i.is_active ? 'active' : 'expired'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sand">{i.used_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// Shared UI helpers
// ─────────────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-ink border border-ash rounded-2xl h-28 skeleton" />
      ))}
    </div>
  )
}

function ErrorMsg({ msg }) {
  return <p className="text-rose text-sm">{msg}</p>
}

function Empty({ msg }) {
  return <p className="text-stone text-sm py-8 text-center">{msg}</p>
}

function Toast({ msg }) {
  return (
    <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3 animate-fade-in">
      {msg}
    </div>
  )
}
