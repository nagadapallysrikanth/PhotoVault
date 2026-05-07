/**
 * components/PhotoGrid.jsx
 * Masonry photo grid with lazy loading and skeleton states.
 */

import { useState } from 'react'
import { photoApi } from '../api/client'

export default function PhotoGrid({ photos, loading, onPhotoClick }) {
  if (loading) return <SkeletonGrid />

  if (!photos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <svg className="w-16 h-16 text-ash mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 9a.75.75 0 110-1.5.75.75 0 010 1.5zm10.5-1.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
        <p className="font-display text-xl text-sand">No photos found</p>
        <p className="text-stone text-sm mt-1">Try scanning your drives or adjusting filters</p>
      </div>
    )
  }

  return (
    <div className="masonry">
      {photos.map((photo, i) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          index={i}
          onClick={() => onPhotoClick(i)}
        />
      ))}
    </div>
  )
}


function PhotoCard({ photo, index, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div
      className="masonry-item photo-card animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      onClick={onClick}
    >
      {/* Skeleton shown until image loads */}
      {!imgLoaded && (
        <div
          className="skeleton w-full"
          style={{ aspectRatio: photo.width && photo.height
            ? `${photo.width}/${photo.height}`
            : '1/1' }}
        />
      )}

      <img
        src={photoApi.thumbnail(photo.id)}
        alt={photo.filename}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        className={`w-full rounded-lg transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        draggable={false}
      />

      {/* Hover overlay with info */}
      <div className="photo-overlay rounded-lg">
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5">
          <p className="text-white text-xs font-body truncate opacity-90">
            {photo.filename}
          </p>
          {photo.taken_at && (
            <p className="text-white/60 text-xs font-mono">
              {new Date(photo.taken_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


function SkeletonGrid() {
  // Vary heights to mimic masonry feel
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
