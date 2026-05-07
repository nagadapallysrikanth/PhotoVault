/**
 * components/Lightbox.jsx
 * Fullscreen photo viewer.
 * Supports: keyboard nav, swipe gestures (mobile), ESC to close.
 */

import { useEffect, useRef, useCallback } from 'react'
import { photoApi } from '../api/client'

export default function Lightbox({ photos, index, onClose, onChange }) {
  const photo       = photos[index]
  const touchStart  = useRef(null)
  const hasPrev     = index > 0
  const hasNext     = index < photos.length - 1

  const prev = useCallback(() => { if (hasPrev) onChange(index - 1) }, [index, hasPrev, onChange])
  const next = useCallback(() => { if (hasNext) onChange(index + 1) }, [index, hasNext, onChange])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Touch swipe
  function onTouchStart(e) {
    touchStart.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return
    const delta = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 50) {
      delta > 0 ? next() : prev()
    }
    touchStart.current = null
  }

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col lightbox-enter"
      style={{ background: 'rgba(10,9,8,0.97)' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 safe-top shrink-0">
        <div className="text-stone text-sm font-body">
          {index + 1} / {photos.length}
        </div>
        <p className="text-sand text-sm font-body truncate max-w-[200px] sm:max-w-sm">
          {photo.filename}
        </p>
        <button
          onClick={onClose}
          className="btn-ghost p-2"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-12">

        {/* Prev arrow */}
        {hasPrev && (
          <button
            onClick={prev}
            className="absolute left-2 sm:left-4 btn-ghost p-3 opacity-60 hover:opacity-100"
            aria-label="Previous"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        {/* Photo */}
        <img
          key={photo.id}
          src={photoApi.original(photo.id)}
          alt={photo.filename}
          className="max-w-full max-h-full object-contain animate-fade-in rounded"
          style={{ maxHeight: 'calc(100dvh - 140px)' }}
          draggable={false}
        />

        {/* Next arrow */}
        {hasNext && (
          <button
            onClick={next}
            className="absolute right-2 sm:right-4 btn-ghost p-3 opacity-60 hover:opacity-100"
            aria-label="Next"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="px-4 py-3 safe-bottom flex items-center justify-between gap-4 shrink-0">
        <div className="flex gap-4 text-stone text-xs font-mono">
          {photo.taken_at && (
            <span>{new Date(photo.taken_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}</span>
          )}
          {photo.width && photo.height && (
            <span className="hidden sm:inline">{photo.width} × {photo.height}</span>
          )}
          {photo.size_kb && (
            <span>{photo.size_kb >= 1024
              ? `${(photo.size_kb / 1024).toFixed(1)} MB`
              : `${photo.size_kb} KB`}
            </span>
          )}
        </div>

        {/* Download original */}
        <a
          href={photoApi.original(photo.id)}
          download={photo.filename}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download
        </a>
      </div>
    </div>
  )
}
