import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Modal } from '../../../components/ui'
import ContractEditor from './ContractEditor'

export default function ContractTemplateList({ isDark, onSelect }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTemplates(data || [])
    } catch (err) {
      console.error('Error loading templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNewTemplate = () => {
    setEditingTemplate(null)
    setEditTitle('')
    setEditContent('<p>契約内容をここに入力してください</p>')
    setShowEditor(true)
  }

  const openEditTemplate = (template) => {
    setEditingTemplate(template)
    setEditTitle(template.title)
    setEditContent(template.content || '')
    setShowEditor(true)
  }

  const saveTemplate = async () => {
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('contract_templates')
          .update({ title: editTitle, content: editContent, updated_at: new Date().toISOString() })
          .eq('id', editingTemplate.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('contract_templates')
          .insert({ title: editTitle, content: editContent })
        if (error) throw error
      }
      setShowEditor(false)
      loadTemplates()
    } catch (err) {
      console.error('Error saving template:', err)
    }
  }

  const duplicateTemplate = async (template) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .insert({ title: `${template.title} (コピー)`, content: template.content })
      if (error) throw error
      loadTemplates()
    } catch (err) {
      console.error('Error duplicating template:', err)
    }
  }

  const deleteTemplate = async () => {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', deleteTarget.id)
      if (error) throw error
      setDeleteTarget(null)
      loadTemplates()
    } catch (err) {
      console.error('Error deleting template:', err)
    }
  }

  if (showEditor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEditor(false)}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="テンプレート名"
            className={`flex-1 px-4 py-2 rounded-lg border outline-none transition-colors ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300'
            }`}
          />
        </div>
        <ContractEditor
          isDark={isDark}
          content={editContent}
          onChange={setEditContent}
          onSave={saveTemplate}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          テンプレート一覧
        </h3>
        <Button isDark={isDark} size="sm" onClick={openNewTemplate}>
          新規テンプレート
        </Button>
      </div>

      {templates.length === 0 ? (
        <GlassCard isDark={isDark}>
          <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            テンプレートがありません
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {templates.map((template) => (
            <GlassCard key={template.id} isDark={isDark} padding="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {template.title}
                  </h4>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {new Date(template.created_at).toLocaleDateString('ja-JP')}
                  </p>
                  {template.content && (
                    <div
                      className={`text-sm mt-2 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                      dangerouslySetInnerHTML={{ __html: template.content }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onSelect && (
                    <Button isDark={isDark} size="sm" variant="blue" onClick={() => onSelect(template)}>
                      選択
                    </Button>
                  )}
                  <button
                    onClick={() => openEditTemplate(template)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="編集"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => duplicateTemplate(template)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="複製"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(template)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'}`}
                    title="削除"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} isDark={isDark}>
        <div className="p-6">
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            テンプレート削除
          </h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            「{deleteTarget?.title}」を削除しますか？この操作は取り消せません。
          </p>
          <div className="flex justify-end gap-3">
            <Button isDark={isDark} variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button isDark={isDark} variant="danger" size="sm" onClick={deleteTemplate}>
              削除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
