/**
 * components/Uploader.jsx
 * Reusable drag-and-drop file uploader.
 * Used by both Upload.jsx (family) and GuestUpload.jsx (friends).
 */

import { useState, useRef, useCallback } from 'react'

const ACCEPTED = '.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.tiff'
const MAX_MB   = 200

export default function Uploader({ onUpload, uploading, disabled }) {
  const [dragging, setDragging]   = useState(false)
  const [selected, setSelected]   = useState([])
  const inputRef                  = useRef(null)

  const addFiles = useCallback((fileList) => {
    const valid = Array.from(fileList).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      return ACCEPTED.includes(ext) && f.size <= MAX_MB * 1024 * 1024
    })
    setSelected(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))]
    })
  }, [])

  const removeFile = (idx) =>
    setSelected(prev => prev.filter((_, i) => i !== idx))

  const clearAll = () => setSelected([])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  async function handleUpload() {
    if (!selected.length || uploading) return
    await onUpload(selected)
    setSelected([])
  }

  const totalSize = selected.reduce((sum, f) => sum + f.size, 0)
  const formatSize = (bytes) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`

  return (
    <div className="space-y-4">

      {/* Drop zone */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
          transition-all duration-200
          ${dragging  ? 'border-amber bg-amber/5 scale-[1.01]' : 'border-ash hover:border-stone'}
          ${disabled  ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={e => addFiles(e.target.files)}
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          <svg className={`w-12 h-12 transition-colors ${dragging ? 'text-amber' : 'text-stone'}`}
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>

          <div>
            <p className="text-cream font-body font-medium">
              {dragging ? 'Drop photos here' : 'Drag photos here'}
            </p>
            <p className="text-stone text-sm mt-0.5">
              or <span className="text-amber">browse files</span>
            </p>
          </div>

          <p className="text-stone text-xs">
            JPG, PNG, HEIC, WebP · Max {MAX_MB}MB per file
          </p>
        </div>
      </div>

      {/* Selected files list */}
      {selected.length > 0 && (
        <div className="bg-ink border border-ash rounded-xl overflow-hidden animate-fade-in">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ash">
            <span className="text-sand text-sm font-body">
              {selected.length} file{selected.length !== 1 ? 's' : ''} · {formatSize(totalSize)}
            </span>
            <button onClick={clearAll} className="text-stone hover:text-rose text-xs transition-colors">
              Clear all
            </button>
          </div>

          {/* File list — show max 8, scroll */}
          <div className="max-h-48 overflow-y-auto divide-y divide-ash">
            {selected.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <FileIcon name={f.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-sm truncate">{f.name}</p>
                  <p className="text-stone text-xs">{formatSize(f.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-stone hover:text-rose transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload button */}
      {selected.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading || disabled}
          className="btn-primary w-full flex items-center justify-center gap-2 animate-fade-in"
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              Upload {selected.length} photo{selected.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  )
}

function FileIcon({ name }) {
  const ext = name.split('.').pop().toLowerCase()
  const colors = { jpg: 'text-amber', jpeg: 'text-amber', png: 'text-blue-400',
                   heic: 'text-purple-400', webp: 'text-green-400' }
  return (
    <span className={`text-xs font-mono font-bold uppercase ${colors[ext] || 'text-stone'}`}>
      {ext}
    </span>
  )
}
