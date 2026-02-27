import { useState, useRef } from 'react'
import { supabase } from '../../../utils/supabase'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function ContractPdfUpload({ isDark, url, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    setError(null)

    if (file.type !== 'application/pdf') {
      setError('PDFファイルのみアップロードできます')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('ファイルサイズは10MB以下にしてください')
      return
    }

    setUploading(true)
    try {
      const path = `pdfs/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(path, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('contracts')
        .getPublicUrl(path)

      setFileInfo({ name: file.name, size: file.size })
      onChange(publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setError('アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
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
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>アップロード中...</span>
          </div>
        ) : (
          <>
            <svg className={`mx-auto h-10 w-10 mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
            </svg>
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              クリックまたはドラッグ&ドロップでPDFをアップロード
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              PDF形式 / 最大10MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {url && fileInfo && (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <svg className={`h-8 w-8 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {fileInfo.name}
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {formatSize(fileInfo.size)}
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
              isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            プレビュー
          </a>
        </div>
      )}
    </div>
  )
}
