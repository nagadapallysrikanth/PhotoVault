/**
 * components/TagCloud.jsx
 * Displays all AI tags as a clickable cloud.
 * Larger = more photos with that tag.
 */

import { useState, useEffect } from 'react'
import api from '../api/client'

export default function TagCloud({ onTagClick, activeTag }) {
  const [tags,    setTags]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/ai/tags')
      .then(r => { setTags(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-20 rounded-xl" />
  if (!tags.length) return null

  const maxCount = Math.max(...tags.map(t => t.count))

  return (
    <div className="bg-ink border border-ash rounded-2xl p-4">
      <p className="text-stone text-xs uppercase tracking-wider font-medium mb-3">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => {
          const size   = 0.75 + (tag.count / maxCount) * 0.5
          const active = activeTag === tag.label
          return (
            <button
              key={tag.label}
              onClick={() => onTagClick(active ? '' : tag.label)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all duration-150 ${
                active
                  ? 'bg-amber text-void font-medium'
                  : 'bg-ash text-sand hover:text-cream hover:bg-stone/30'
              }`}
              style={{ fontSize: `${size}rem` }}
              title={`${tag.count} photos`}
            >
              {tag.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
