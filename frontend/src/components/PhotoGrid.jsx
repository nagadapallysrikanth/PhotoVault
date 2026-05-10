/**
 * components/PhotoGrid.jsx
 * Masonry photo grid with bulk select and long press support.
 */

import { useState, useRef } from 'react'
import { photoApi } from '../api/client'

export default function PhotoGrid({ photos, loading, onPhotoClick, onSelectionChange }) {
  const [selected,   setSelected]  = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)

  function toggleSelect(id, e) {
    e?.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (next.size === 0) setSelectMode(false)
      else setSelectMode(true)
      onSelectionChange?.(Array.from(next))
      return next
    })
  }

  function enterSelectMode(id) {
    setSelectMode(true)
    setSelected(new Set([id]))
    onSelectionChange?.([id])
  }

  function clearSelection() {
    setSelected(new Set())
    setSelectMode(false)
    onSelectionChange?.([])
  }

  function selectAll() {
    const all = new Set(photos.map(p => p.id))
    setSelected(all)
    onSelectionChange?.(Array.from(all))
  }

  if (loading) return <SkeletonGrid />

  if (!photos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <svg className="w-16 h-16 text-ash mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18" />
        </svg>
        <p className="font-display text-xl text-sand">No photos found</p>
        <p className="text-stone text-sm mt-1">Try scanning your drives or adjusting filters</p>
      </div>
    )
  }

  return (
    <div>
      {selectMode && (
        <div className="flex items-center justify-between mb-4 bg-ink border border-ash rounded-2xl px-4 py-3 animate-slide-up">
          <p className="text-cream text-sm font-medium">{selected.size} selected</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-ghost text-xs">Select all</button>
            <button onClick={clearSelection} className="btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="masonry">
        {photos.map((photo, i) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={i}
            isSelected={selected.has(photo.id)}
            selectMode={selectMode}
            onClick={() => selectMode ? toggleSelect(photo.id) : onPhotoClick(i)}
            onLongPress={() => enterSelectMode(photo.id)}
            onSelect={(e) => toggleSelect(photo.id, e)}
          />
        ))}
      </div>
    </div>
  )
}

function PhotoCard({ photo, index, isSelected, selectMode, onClick, onLongPress, onSelect }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const longPressTimer = useRef(null)

  function handleTouchStart() {
    longPressTimer.current = setTimeout(() => onLongPress(), 600)
  }
  function handleTouchEnd() {
    clearTimeout(longPressTimer.current)
  }

  return (
    <div
      className={`group masonry-item photo-card animate-fade-in ${isSelected ? 'ring-2 ring-amber rounded-lg' : ''}`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {!imgLoaded && (
        <div className="skeleton w-full rounded-lg"
          style={{ aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : '1/1' }} />
      )}

      <img
        src={photoApi.thumbnail(photo.id)}
        alt={photo.filename}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        className={`w-full rounded-lg transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        draggable={false}
      />

      <div
        onClick={onSelect}
        className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer z-10 ${
          isSelected ? 'bg-amber border-amber' : selectMode ? 'bg-black/40 border-white/70' : 'opacity-0 group-hover:opacity-100 bg-black/40 border-white/50'
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-void" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>

      <div className="photo-overlay rounded-lg">
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5">
          <p className="text-white text-xs truncate">{photo.filename}</p>
          {photo.taken_at && (
            <p className="text-white/60 text-xs font-mono">{new Date(photo.taken_at).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonGrid() {
  const heights = [180, 240, 160, 280, 200, 220, 170, 260, 190, 240, 210, 180]
  return (
    <div className="masonry">
      {heights.map((h, i) => (
        <div key={i} className="masonry-item">
          <div className="skeleton rounded-lg w-full" style={{ height: h }} />
        </div>
      ))}
    </div>
  )
}
