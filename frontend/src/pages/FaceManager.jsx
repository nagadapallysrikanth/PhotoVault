/**
 * pages/FaceManager.jsx
 * Train family faces, trigger scans, name unknown faces.
 * Admin only.
 */

import { useState, useEffect } from 'react'
import { useAuth }             from '../contexts/AuthContext'
import { useNavigate }         from 'react-router-dom'
import api, { tokens, apiError } from '../api/client'
import Navbar from '../components/Navbar'

const TABS = ['People', 'Scan Library', 'Unknown Faces']

export default function FaceManager() {
  const { isAdmin } = useAuth()
  const navigate    = useNavigate()
  const [tab, setTab] = useState('People')

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  return (
    <div className="min-h-dvh bg-void">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-cream">Face Manager</h1>
          <p className="text-stone text-sm mt-1">Train, scan and identify family members</p>
        </div>

        <div className="flex gap-1 mb-8 bg-ink border border-ash rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-body transition-all ${
                tab === t ? 'bg-amber text-void font-medium' : 'text-stone hover:text-cream'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'People'        && <PeopleTab />}
        {tab === 'Scan Library'  && <ScanTab />}
        {tab === 'Unknown Faces' && <UnknownFacesTab />}
      </main>
    </div>
  )
}


// ─── People Tab ─────────────────────────────────────────

function PeopleTab() {
  const [people,  setPeople]  = useState([])
  const [loading, setLoading] = useState(true)
  const [name,    setName]    = useState('')
  const [files,   setFiles]   = useState([])
  const [training,setTraining]= useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => { loadPeople() }, [])

  async function loadPeople() {
    try {
      const r = await api.get('/faces/people')
      setPeople(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  async function handleTrain() {
    if (!name || !files.length) return
    setTraining(true)
    try {
      const form = new FormData()
      form.append('name', name)
      files.forEach(f => form.append('files', f))
      const r = await api.post('/faces/people/train', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMsg(`✓ Trained "${name}" with ${r.data.learned} photos`)
      setName('')
      setFiles([])
      loadPeople()
      setTimeout(() => setMsg(''), 4000)
    } catch (e) { setMsg(apiError(e)) }
    finally { setTraining(false) }
  }

  async function deletePerson(name) {
    try {
      await api.delete(`/faces/people/${encodeURIComponent(name)}`)
      setMsg(`Removed "${name}"`)
      loadPeople()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {msg && <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3">{msg}</div>}

      {/* Train new person */}
      <div className="bg-ink border border-ash rounded-2xl p-6 space-y-4">
        <h3 className="text-cream font-medium">Add New Person</h3>
        <p className="text-stone text-sm">Upload 5-10 clear photos of the person for best accuracy</p>

        <div className="space-y-1.5">
          <label className="text-sand text-xs uppercase tracking-wider font-medium">Name</label>
          <input type="text" className="input" placeholder="e.g. Radha, Reshmitha, Max"
            value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sand text-xs uppercase tracking-wider font-medium">
            Training Photos ({files.length} selected)
          </label>
          <input type="file" multiple accept="image/*" className="input py-2 text-sm cursor-pointer"
            onChange={e => setFiles(Array.from(e.target.files))} />
          <p className="text-stone text-xs">Different angles, lighting and ages = better accuracy</p>
        </div>

        <button onClick={handleTrain} disabled={!name || !files.length || training} className="btn-primary">
          {training ? 'Training...' : `Train "${name || 'Person'}"`}
        </button>
      </div>

      {/* People list */}
      {loading ? (
        <div className="skeleton rounded-2xl h-32" />
      ) : people.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-stone text-sm">No people trained yet</p>
          <p className="text-stone text-xs mt-1">Add family members above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-cream font-medium">Trained People ({people.length})</h3>
          {people.map(p => (
            <div key={p.name} className="bg-ink border border-ash rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ash flex items-center justify-center">
                  <span className="text-amber font-display text-lg">{p.name[0]}</span>
                </div>
                <div>
                  <p className="text-cream font-medium">{p.name}</p>
                  <p className="text-stone text-xs">{p.face_count} training samples</p>
                </div>
              </div>
              <button onClick={() => deletePerson(p.name)} className="btn-danger text-xs">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── Scan Tab ────────────────────────────────────────────

function ScanTab() {
  const [progress, setProgress] = useState({ running: false, done: 0, total: 0 })
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await api.get('/faces/scan/progress')
        setProgress(r.data)
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  async function startScan() {
    try {
      const r = await api.post('/faces/scan')
      setMsg(r.data.message)
      setTimeout(() => setMsg(''), 4000)
    } catch (e) { setMsg(apiError(e)) }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {msg && <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3">{msg}</div>}

      <div className="bg-ink border border-ash rounded-2xl p-6 space-y-4">
        <h3 className="text-cream font-medium">Scan Library for Faces</h3>
        <p className="text-stone text-sm">
          Scans all photos to detect and identify trained family members.
          This runs in the background and may take several hours for large libraries.
        </p>

        <div className="bg-ash/30 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-sand">⚡ Train people first before scanning</p>
          <p className="text-sand">🌙 Best to run overnight for large libraries</p>
          <p className="text-sand">🔒 Runs 100% locally — no internet needed</p>
        </div>

        {progress.running ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-sand">Scanning...</span>
              <span className="text-amber font-mono">{progress.done} / {progress.total}</span>
            </div>
            <div className="h-2 bg-ash rounded-full overflow-hidden">
              <div className="h-full bg-amber rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }} />
            </div>
            <p className="text-stone text-xs text-center">{pct}% complete</p>
          </div>
        ) : (
          <button onClick={startScan} className="btn-primary">
            Start Face Scan
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Unknown Faces Tab ───────────────────────────────────

function UnknownFacesTab() {
  const [faces,   setFaces]   = useState([])
  const [loading, setLoading] = useState(true)
  const [naming,  setNaming]  = useState(null)
  const [name,    setName]    = useState('')
  const [msg,     setMsg]     = useState('')

  useEffect(() => { loadUnknown() }, [])

  async function loadUnknown() {
    try {
      const r = await api.get('/faces/unknown')
      setFaces(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  async function nameFace(faceId) {
    if (!name.trim()) return
    try {
      await api.post(`/faces/unknown/${faceId}/name?name=${encodeURIComponent(name)}`)
      setMsg(`✓ Face identified as "${name}"`)
      setNaming(null)
      setName('')
      loadUnknown()
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(apiError(e)) }
  }

  if (loading) return <div className="skeleton rounded-2xl h-48" />

  return (
    <div className="space-y-6 animate-fade-in">
      {msg && <div className="bg-amber/10 border border-amber/30 text-amber text-sm rounded-xl px-4 py-3">{msg}</div>}

      {faces.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-display text-xl text-sand">No unknown faces</p>
          <p className="text-stone text-sm mt-1">Run a face scan first to find unidentified people</p>
        </div>
      ) : (
        <>
          <p className="text-stone text-sm">{faces.length} unidentified faces found — click to name them</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {faces.map(face => (
              <div key={face.id} className="space-y-2">
                <div
                  onClick={() => { setNaming(face.id); setName('') }}
                  className="aspect-square bg-ink border border-ash rounded-xl overflow-hidden cursor-pointer hover:border-amber transition-colors"
                >
                  {face.thumbnail_url && (
                    <img
                      src={`${face.thumbnail_url}?token=${tokens.access}`}
                      alt="Unknown face"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {naming === face.id ? (
                  <div className="flex gap-1">
                    <input type="text" className="input text-xs py-1 px-2 h-7"
                      placeholder="Name..." value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && nameFace(face.id)}
                      autoFocus />
                    <button onClick={() => nameFace(face.id)} className="btn-primary text-xs px-2 py-1">✓</button>
                  </div>
                ) : (
                  <p className="text-stone text-xs text-center">Unknown</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
