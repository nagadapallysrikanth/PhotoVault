/**
 * pages/Gallery.jsx
 * Main gallery page — the heart of the app.
 * Features: filter by year/album/drive, search, lightbox, slideshow.
 */

import { useState, useEffect, useCallback } from 'react'
import api, { photoApi, albumApi, apiError } from '../api/client'
import Navbar      from '../components/Navbar'
import PhotoGrid   from '../components/PhotoGrid'
import Lightbox    from '../components/Lightbox'
import Slideshow   from '../components/Slideshow'

const LIMIT = 150

export default function Gallery() {
  // Photos
  const [photos,   setPhotos]   = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Filters
  const [albums,   setAlbums]   = useState([])
  const [search,   setSearch]   = useState('')
  const [yearFil,  setYearFil]  = useState('')
  const [albumFil, setAlbumFil] = useState('')
  const [driveFil, setDriveFil] = useState('')

  // Available years (derived from photos)
  const [years,    setYears]    = useState([])

  // Lightbox / Slideshow
  const [lightIdx,  setLightIdx]  = useState(null)
  const [slideshow, setSlideshow] = useState(false)

  // Scan
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [selected,  setSelected]  = useState([])
  const [showBulk,  setShowBulk]  = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMsg,  setScanMsg]  = useState('')

  // ── Load albums once ────────────────────────────────────
  useEffect(() => {
    albumApi.list().then(setAlbums).catch(() => {})
    photoApi.stats().then(s => setYears(s.years || [])).catch(() => {})
  }, [])

  // ── Load photos when filters change ────────────────────
  const loadPhotos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { limit: LIMIT, sort: 'date', order: 'desc' }
      if (search)   params.search   = search
      if (yearFil)  params.year     = yearFil
      if (albumFil) params.album_id = albumFil
      if (driveFil)  params.drive    = driveFil
      if (dateFrom)  params.date_from = dateFrom
      if (dateTo)    params.date_to   = dateTo

      const data = await photoApi.list(params)
      setPhotos(data.photos)
      setTotal(data.total)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }, [search, yearFil, albumFil, driveFil, dateFrom, dateTo])

  useEffect(() => {
    const t = setTimeout(loadPhotos, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [loadPhotos, search])

  // ── Scan drives ─────────────────────────────────────────
  function handleSelectionChange(ids) {
    setSelected(ids)
    setShowBulk(ids.length > 0)
  }

  async function handleTrashSelected() {
    if (!selected.length) return
    try {
      await api.post('/trash/delete', selected)
      setSelected([])
      setShowBulk(false)
      loadPhotos()
    } catch (e) { console.error(e) }
  }

  async function handleScan() {
    setScanning(true)
    setScanMsg('')
    try {
      await photoApi.scan()
      setScanMsg('Scan started — refresh in a moment')
      setTimeout(() => { loadPhotos(); setScanMsg('') }, 4000)
    } catch (e) {
      setScanMsg(apiError(e))
    } finally {
      setScanning(false)
    }
  }

  const clearFilters = () => {
    setSearch(''); setYearFil(''); setAlbumFil(''); setDriveFil('')
    setDateFrom(''); setDateTo('')
  }
  const hasFilters = search || yearFil || albumFil || driveFil || dateFrom || dateTo

  return (
    <div className="min-h-dvh bg-void">
      <Navbar onScan={handleScan} scanning={scanning} />

      {/* Scan message */}
      {scanMsg && (
        <div className="bg-amber/10 border-b border-amber/20 text-amber text-sm px-4 py-2 text-center font-body animate-fade-in">
          {scanMsg}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl text-cream">Library</h1>
            <p className="text-stone text-sm mt-0.5">
              {loading ? '...' : `${total.toLocaleString()} photos`}
            </p>
          </div>

          {/* Slideshow button */}
          {photos.length > 0 && (
            <button
              onClick={() => setSlideshow(true)}
              className="btn-ghost flex items-center gap-2 self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Slideshow
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search photos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 w-48 sm:w-64 h-9 py-0 text-sm"
            />
          </div>

          {/* Year filter */}
          {years.length > 0 && (
            <select
              value={yearFil}
              onChange={e => setYearFil(e.target.value)}
              className="input h-9 py-0 text-sm w-auto pr-8"
            >
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          {/* Album filter */}
          {albums.length > 0 && (
            <select
              value={albumFil}
              onChange={e => setAlbumFil(e.target.value)}
              className="input h-9 py-0 text-sm w-auto pr-8 max-w-[160px]"
            >
              <option value="">All albums</option>
              {albums.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.photo_count})
                </option>
              ))}
            </select>
          )}

          {/* Drive filter */}
          <select
            value={driveFil}
            onChange={e => setDriveFil(e.target.value)}
            className="input h-9 py-0 text-sm w-auto pr-8"
          >
            <option value="">All drives</option>
            <option value="ssd">SSD</option>
            <option value="external">External HDD</option>
          </select>

          {/* Date range */}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="input h-9 py-0 text-sm w-auto" title="From date" />
          <span className="text-stone text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="input h-9 py-0 text-sm w-auto" title="To date" />

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost h-9 text-sm text-rose">
              Clear filters
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose/10 border border-rose/20 text-rose text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Grid */}
        {/* Bulk action bar */}
        {showBulk && (
          <div className="sticky top-16 z-30 flex items-center justify-between bg-ink border border-ash rounded-2xl px-4 py-3 mb-4 animate-slide-up shadow-lg">
            <p className="text-cream text-sm font-medium">{selected.length} selected</p>
            <div className="flex gap-2">
              <button onClick={handleTrashSelected} className="btn-danger text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Move to Trash
              </button>
              <button onClick={() => { setSelected([]); setShowBulk(false) }} className="btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        <PhotoGrid
          photos={photos}
          loading={loading}
          onPhotoClick={i => setLightIdx(i)}
          onSelectionChange={handleSelectionChange}
        />

        {/* Load more */}
        {!loading && photos.length < total && (
          <div className="text-center mt-8">
            <p className="text-stone text-sm mb-3">
              Showing {photos.length} of {total} photos
            </p>
            <button
              onClick={() => {/* Phase 3 bonus: infinite scroll */}}
              className="btn-ghost"
            >
              Load more
            </button>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightIdx}
          onClose={() => setLightIdx(null)}
          onChange={setLightIdx}
        />
      )}

      {/* Slideshow */}
      {slideshow && (
        <Slideshow
          photos={photos}
          startIndex={lightIdx ?? 0}
          onClose={() => setSlideshow(false)}
        />
      )}
    </div>
  )
}
