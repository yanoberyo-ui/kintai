import { useState, useRef } from 'react'
import { supabase } from '../../../utils/supabase'

export default function ExpenseReceiptUpload({ urls = [], onChange, isDark, userId }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const newUrls = [...urls]
      for (const file of files) {
        const path = `${userId}/${Date.now()}_${file.name}`
        const { error } = await supabase.storage
          .from('expense-receipts')
          .upload(path, file)
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(path)
        newUrls.push(publicUrl)
      }
      onChange(newUrls)
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (index) => {
    const next = urls.filter((_, i) => i !== index)
    onChange(next)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        領収書
      </label>

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : isDark
              ? 'border-gray-700 hover:border-gray-600'
              : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>アップロード中...</span>
          </div>
        ) : (
          <>
            <svg className={`mx-auto h-8 w-8 mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
            </svg>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              クリックまたはドラッグ&ドロップでアップロード
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              画像・PDF対応
            </p>
          </>
        )}
      </div>

      {/* Previews */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {urls.map((url, i) => (
            <div key={i} className="relative group">
              {url.endsWith('.pdf') ? (
                <div className={`w-20 h-20 rounded-lg flex items-center justify-center text-xs font-medium ${
                  isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                  PDF
                </div>
              ) : (
                <img
                  src={url}
                  alt={`receipt-${i}`}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
