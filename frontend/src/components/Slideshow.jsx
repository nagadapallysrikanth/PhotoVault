/**
 * components/Slideshow.jsx
 * Auto-playing fullscreen slideshow.
 * Controls: play/pause, speed, prev/next, exit.
 */

import { useState, useEffect, useCallback } from 'react'
import { photoApi } from '../api/client'

const SPEEDS = [3000, 5000, 8000]  // ms between slides
const SPEED_LABELS = ['3s', '5s', '8s']

export default function Slideshow({ photos, startIndex = 0, onClose }) {
  const [index,     setIndex]     = useState(startIndex)
  const [playing,   setPlaying]   = useState(true)
  const [speedIdx,  setSpeedIdx]  = useState(1)   // default 5s
  const [loaded,    setLoaded]    = useState(false)

  const photo   = photos[index]
  const speed   = SPEEDS[speedIdx]

  const next = useCallback(() =>
    setIndex(i => (i + 1) % photos.length), [photos.length])

  const prev = useCallback(() =>
    setIndex(i => (i - 1 + photos.length) % photos.length), [photos.length])

  // Auto-advance
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(next, speed)
    return () => clearTimeout(t)
  }, [playing, speed, next, index])

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === ' ')          setPlaying(p => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-void flex flex-col">

      {/* Image */}
      <div className="flex-1 flex items-center justify-center relative min-h-0">
        <img
          key={photo.id}
          src={photoApi.original(photo.id)}
          alt={photo.filename}
          onLoad={() => setLoaded(true)}
          onLoadStart={() => setLoaded(false)}
          className={`max-w-full max-h-full object-contain transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ maxHeight: 'calc(100dvh - 80px)' }}
          draggable={false}
        />

        {/* Progress bar */}
        {playing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ash overflow-hidden">
            <div
              key={`${index}-${playing}`}
              className="h-full bg-amber"
              style={{
                animation: `slideProgress ${speed}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-20 safe-bottom flex items-center justify-between px-6 gap-4 bg-gradient-to-t from-void to-transparent">

        {/* Left: counter + filename */}
        <div className="flex-1 min-w-0">
          <p className="text-stone text-xs font-mono">{index + 1} / {photos.length}</p>
          <p className="text-sand text-sm truncate">{photo.filename}</p>
        </div>

        {/* Centre: playback controls */}
        <div className="flex items-center gap-3">
          <button onClick={prev} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button
            onClick={() => setPlaying(p => !p)}
            className="w-10 h-10 rounded-full bg-amber flex items-center justify-center hover:bg-ember transition-colors"
          >
            {playing ? (
              <svg className="w-4 h-4 text-void" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-void ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button onClick={next} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Right: speed + close */}
        <div className="flex-1 flex justify-end items-center gap-3">
          <button
            onClick={() => setSpeedIdx(s => (s + 1) % SPEEDS.length)}
            className="tag hover:text-cream transition-colors cursor-pointer"
          >
            {SPEED_LABELS[speedIdx]}
          </button>
          <button onClick={onClose} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideProgress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}
