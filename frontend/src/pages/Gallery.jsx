/**
 * pages/Gallery.jsx
 * Main gallery page — the heart of the app.
 * Features: filter by year/album/drive, search, lightbox, slideshow.
 */

import { useState, useEffect, useCallback } from 'react'
import { photoApi, albumApi, apiError } from '../api/client'
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
      if (driveFil) params.drive    = driveFil

      const data = await photoApi.list(params)
      setPhotos(data.photos)
      setTotal(data.total)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }, [search, yearFil, albumFil, driveFil])

  useEffect(() => {
    const t = setTimeout(loadPhotos, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [loadPhotos, search])

  // ── Scan drives ─────────────────────────────────────────
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
  }
  const hasFilters = search || yearFil || albumFil || driveFil

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
        <PhotoGrid
          photos={photos}
          loading={loading}
          onPhotoClick={i => setLightIdx(i)}
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
