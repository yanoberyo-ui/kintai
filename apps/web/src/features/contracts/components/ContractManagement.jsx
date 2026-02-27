import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Modal, Badge, PageHeader } from '../../../components/ui'
import ContractEditor from './ContractEditor'
import ContractTemplateList from './ContractTemplateList'
import ContractPdfUpload from './ContractPdfUpload'

const STATUS_TABS = [
  { key: 'all', label: 'すべて' },
  { key: 'draft', label: '下書き' },
  { key: 'sent', label: '送信済み' },
  { key: 'viewed', label: '閲覧済み' },
  { key: 'signed', label: '署名済み' },
  { key: 'rejected', label: '拒否' },
]

const STATUS_STYLES = {
  draft: { variant: 'default', label: '下書き' },
  sent: { variant: 'info', label: '送信済み' },
  viewed: { variant: 'warning', label: '閲覧済み' },
  signed: { variant: 'success', label: '署名済み' },
  rejected: { variant: 'danger', label: '拒否' },
}

const generateToken = () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export default function ContractManagement({ isDark, users }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // Creation flow state
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState(1) // 1=method, 2=signer, 3=editor
  const [createMethod, setCreateMethod] = useState(null) // 'template' | 'new' | 'pdf'
  const [selectedSigner, setSelectedSigner] = useState(null)
  const [signerSearch, setSignerSearch] = useState('')
  const [contractTitle, setContractTitle] = useState('')
  const [contractContent, setContractContent] = useState('')
  const [contractPdfUrl, setContractPdfUrl] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [sending, setSending] = useState(false)

  // Detail view
  const [selectedContract, setSelectedContract] = useState(null)
  const [editingContent, setEditingContent] = useState('')

  const loadContracts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, signer:users!contracts_signer_id_fkey(id, name, email), template:contract_templates(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setContracts(data || [])
    } catch (err) {
      console.error('Error loading contracts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  const filteredContracts = activeTab === 'all'
    ? contracts
    : contracts.filter(c => c.status === activeTab)

  const resetCreateFlow = () => {
    setShowCreate(false)
    setCreateStep(1)
    setCreateMethod(null)
    setSelectedSigner(null)
    setSignerSearch('')
    setContractTitle('')
    setContractContent('')
    setContractPdfUrl('')
    setSelectedTemplateId(null)
  }

  const handleMethodSelect = (method) => {
    setCreateMethod(method)
    if (method === 'template') {
      // Stay on step 1 to show template list, then go to signer
      return
    }
    setCreateStep(2)
  }

  const handleTemplateSelect = (template) => {
    setContractTitle(template.title)
    setContractContent(template.content || '')
    setSelectedTemplateId(template.id)
    setCreateStep(2)
  }

  const handleSignerSelect = (user) => {
    setSelectedSigner(user)
    setCreateStep(3)
  }

  const saveDraft = async () => {
    try {
      const payload = {
        title: contractTitle || '無題の契約',
        content: createMethod !== 'pdf' ? contractContent : null,
        pdf_url: createMethod === 'pdf' ? contractPdfUrl : null,
        template_id: selectedTemplateId,
        signer_id: selectedSigner?.id,
        status: 'draft',
      }

      if (selectedContract) {
        const { error } = await supabase
          .from('contracts')
          .update(payload)
          .eq('id', selectedContract.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('contracts')
          .insert(payload)
        if (error) throw error
      }

      resetCreateFlow()
      setSelectedContract(null)
      loadContracts()
    } catch (err) {
      console.error('Error saving draft:', err)
    }
  }

  const sendContract = async (contractToSend) => {
    const contract = contractToSend || selectedContract
    if (!contract && !selectedSigner) return

    setSending(true)
    try {
      const signToken = generateToken()
      const now = new Date().toISOString()

      if (contract?.id) {
        // Update existing draft
        const payload = {
          title: contractTitle || contract.title,
          content: editingContent || contract.content,
          pdf_url: contractPdfUrl || contract.pdf_url,
          signer_id: selectedSigner?.id || contract.signer_id,
          status: 'sent',
          sign_token: signToken,
          sign_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          sent_at: now,
        }
        const { error } = await supabase
          .from('contracts')
          .update(payload)
          .eq('id', contract.id)
        if (error) throw error
      } else {
        // Create and send new
        const payload = {
          title: contractTitle || '無題の契約',
          content: createMethod !== 'pdf' ? contractContent : null,
          pdf_url: createMethod === 'pdf' ? contractPdfUrl : null,
          template_id: selectedTemplateId,
          signer_id: selectedSigner?.id,
          status: 'sent',
          sign_token: signToken,
          sign_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          sent_at: now,
        }
        const { error } = await supabase
          .from('contracts')
          .insert(payload)
        if (error) throw error
      }

      resetCreateFlow()
      setSelectedContract(null)
      loadContracts()
    } catch (err) {
      console.error('Error sending contract:', err)
    } finally {
      setSending(false)
    }
  }

  const openContractDetail = (contract) => {
    setSelectedContract(contract)
    setContractTitle(contract.title)
    setEditingContent(contract.content || '')
    setContractPdfUrl(contract.pdf_url || '')
    setSelectedSigner(contract.signer || null)
  }

  const filteredUsers = (users || []).filter(u =>
    !signerSearch || u.name?.toLowerCase().includes(signerSearch.toLowerCase()) || u.email?.toLowerCase().includes(signerSearch.toLowerCase())
  )

  // ---- Detail View ----
  if (selectedContract) {
    const c = selectedContract
    const isDraft = c.status === 'draft'

    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedContract(null); setEditingContent('') }}
          className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          一覧に戻る
        </button>

        <GlassCard isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            {isDraft ? (
              <input
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                className={`text-xl font-bold bg-transparent outline-none border-b-2 pb-1 transition-colors ${
                  isDark ? 'text-white border-gray-700 focus:border-gray-500' : 'text-gray-900 border-gray-200 focus:border-gray-400'
                }`}
                placeholder="契約タイトル"
              />
            ) : (
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.title}</h2>
            )}
            <Badge variant={STATUS_STYLES[c.status]?.variant || 'default'} isDark={isDark}>
              {STATUS_STYLES[c.status]?.label || c.status}
            </Badge>
          </div>

          <div className={`text-sm space-y-1 mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>署名者: {c.signer?.name || '未選択'} {c.signer?.email ? `(${c.signer.email})` : ''}</p>
            {c.sent_at && <p>送信日: {new Date(c.sent_at).toLocaleString('ja-JP')}</p>}
            {c.viewed_at && <p>閲覧日: {new Date(c.viewed_at).toLocaleString('ja-JP')}</p>}
            {c.signed_at && <p>署名日: {new Date(c.signed_at).toLocaleString('ja-JP')}</p>}
            {c.rejected_at && <p>拒否日: {new Date(c.rejected_at).toLocaleString('ja-JP')}</p>}
            {c.rejection_reason && <p>拒否理由: {c.rejection_reason}</p>}
          </div>
        </GlassCard>

        {c.pdf_url ? (
          <GlassCard isDark={isDark} padding="p-4">
            <a
              href={c.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF を表示
            </a>
          </GlassCard>
        ) : isDraft ? (
          <ContractEditor
            isDark={isDark}
            content={editingContent}
            onChange={setEditingContent}
            onSave={async () => {
              await supabase
                .from('contracts')
                .update({ title: contractTitle, content: editingContent })
                .eq('id', c.id)
              loadContracts()
            }}
          />
        ) : (
          <GlassCard isDark={isDark}>
            <div
              className={`prose max-w-none ${isDark ? 'prose-invert text-gray-200' : 'text-gray-800'}`}
              dangerouslySetInnerHTML={{ __html: c.content || '' }}
            />
          </GlassCard>
        )}

        {isDraft && (
          <div className="flex gap-3">
            <Button isDark={isDark} variant="secondary" onClick={saveDraft}>
              下書き保存
            </Button>
            <Button isDark={isDark} variant="blue" onClick={() => sendContract()} disabled={sending || !c.signer_id}>
              {sending ? '送信中...' : '送信する'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ---- Create Flow ----
  if (showCreate) {
    return (
      <div className="space-y-4">
        <button
          onClick={resetCreateFlow}
          className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          キャンセル
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                createStep >= step
                  ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                  : isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-8 h-0.5 ${createStep > step ? (isDark ? 'bg-white' : 'bg-gray-900') : (isDark ? 'bg-gray-800' : 'bg-gray-200')}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose method */}
        {createStep === 1 && !createMethod && (
          <div className="space-y-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              作成方法を選択
            </h3>
            <div className="grid gap-3">
              {[
                { key: 'template', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'テンプレートから', desc: '既存のテンプレートを選択' },
                { key: 'new', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', label: '新規作成', desc: 'エディタで一から作成' },
                { key: 'pdf', icon: 'M12 10v6m0 0l-3-3m3 3l3-3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1', label: 'PDFアップロード', desc: 'PDFファイルをアップロード' },
              ].map(({ key, icon, label, desc }) => (
                <GlassCard
                  key={key}
                  isDark={isDark}
                  padding="p-4"
                  className="cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => handleMethodSelect(key)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <svg className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* Step 1b: Template selection */}
        {createStep === 1 && createMethod === 'template' && (
          <ContractTemplateList isDark={isDark} onSelect={handleTemplateSelect} />
        )}

        {/* Step 2: Select signer */}
        {createStep === 2 && (
          <div className="space-y-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              署名者を選択
            </h3>
            <input
              value={signerSearch}
              onChange={(e) => setSignerSearch(e.target.value)}
              placeholder="名前またはメールで検索..."
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300'
              }`}
            />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredUsers.map((u) => (
                <GlassCard
                  key={u.id}
                  isDark={isDark}
                  padding="p-3"
                  className="cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => handleSignerSelect(u)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{u.name}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{u.email}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
              {filteredUsers.length === 0 && (
                <p className={`text-center py-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ユーザーが見つかりません
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Editor / PDF upload */}
        {createStep === 3 && (
          <div className="space-y-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>署名者:</span>
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {selectedSigner?.name} ({selectedSigner?.email})
              </span>
            </div>

            <input
              value={contractTitle}
              onChange={(e) => setContractTitle(e.target.value)}
              placeholder="契約タイトル"
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300'
              }`}
            />

            {createMethod === 'pdf' ? (
              <ContractPdfUpload isDark={isDark} url={contractPdfUrl} onChange={setContractPdfUrl} />
            ) : (
              <ContractEditor isDark={isDark} content={contractContent} onChange={setContractContent} />
            )}

            <div className="flex gap-3">
              <Button isDark={isDark} variant="secondary" onClick={saveDraft}>
                下書き保存
              </Button>
              <Button isDark={isDark} variant="blue" onClick={() => sendContract()} disabled={sending}>
                {sending ? '送信中...' : '送信する'}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- Main List View ----
  return (
    <div className="space-y-4">
      <PageHeader
        title="契約管理"
        subtitle="電子契約の作成・送信・管理"
        isDark={isDark}
        action={
          <Button isDark={isDark} onClick={() => setShowCreate(true)}>
            新規契約作成
          </Button>
        }
      />

      {/* Status filter tabs */}
      <div className={`flex gap-1 p-1 rounded-lg overflow-x-auto ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
        </div>
      ) : filteredContracts.length === 0 ? (
        <GlassCard isDark={isDark}>
          <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {activeTab === 'all' ? '契約がありません' : `${STATUS_TABS.find(t => t.key === activeTab)?.label}の契約はありません`}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((contract) => (
            <GlassCard
              key={contract.id}
              isDark={isDark}
              padding="p-4"
              className="cursor-pointer hover:scale-[1.01] transition-transform"
              onClick={() => openContractDetail(contract)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {contract.title}
                    </h3>
                    <Badge variant={STATUS_STYLES[contract.status]?.variant || 'default'} isDark={isDark}>
                      {STATUS_STYLES[contract.status]?.label || contract.status}
                    </Badge>
                  </div>
                  <div className={`flex items-center gap-3 mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span>署名者: {contract.signer?.name || '未設定'}</span>
                    {contract.sent_at && <span>送信: {new Date(contract.sent_at).toLocaleDateString('ja-JP')}</span>}
                    {contract.signed_at && <span>署名: {new Date(contract.signed_at).toLocaleDateString('ja-JP')}</span>}
                  </div>
                </div>
                <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
