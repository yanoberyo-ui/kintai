import { useState, useRef, useCallback } from 'react'
import { GlassCard, Button } from '../../../components/ui'

export default function ContractEditor({ isDark, content, onChange, onSave }) {
  const [isPreview, setIsPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef(null)

  const execCmd = useCallback((command, value = null) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }, [])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  const toolbarButtons = [
    { label: 'B', command: 'bold', style: 'font-bold' },
    { label: 'I', command: 'italic', style: 'italic' },
    { label: 'H', command: 'formatBlock', value: '<h2>' },
    { label: 'UL', command: 'insertUnorderedList' },
    { label: 'OL', command: 'insertOrderedList' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          {toolbarButtons.map((btn) => (
            <button
              key={btn.label}
              onClick={() => execCmd(btn.command, btn.value || null)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${btn.style || ''} ${
                isDark
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {isPreview ? '編集' : 'プレビュー'}
          </button>
          {onSave && (
            <Button isDark={isDark} size="sm" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          )}
        </div>
      </div>

      <GlassCard isDark={isDark} padding="p-0" className="overflow-hidden">
        {isPreview ? (
          <div
            className={`p-6 min-h-[400px] prose max-w-none ${
              isDark ? 'prose-invert text-gray-200' : 'text-gray-800'
            }`}
            dangerouslySetInnerHTML={{ __html: content || '' }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            dangerouslySetInnerHTML={{ __html: content || '' }}
            className={`p-6 min-h-[400px] outline-none prose max-w-none ${
              isDark ? 'prose-invert text-gray-200' : 'text-gray-800'
            }`}
          />
        )}
      </GlassCard>
    </div>
  )
}
