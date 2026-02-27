import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, PageHeader, Badge } from '../../../components/ui'
import ContractSignPage from './ContractSignPage'

export default function ContractViewer({ isDark, user }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedContract, setSelectedContract] = useState(null)
  const [viewMode, setViewMode] = useState(null) // 'sign' | 'view'

  useEffect(() => {
    if (user?.id) loadContracts()
  }, [user?.id])

  const loadContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, template:contract_templates(*)')
        .eq('signer_id', user.id)
        .in('status', ['sent', 'viewed', 'signed', 'rejected'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setContracts(data || [])
    } catch (err) {
      console.error('Error loading contracts:', err)
    } finally {
      setLoading(false)
    }
  }

  const unsigned = contracts.filter(c => c.status === 'sent' || c.status === 'viewed')
  const completed = contracts.filter(c => c.status === 'signed' || c.status === 'rejected')

  const handleContractClick = (contract) => {
    setSelectedContract(contract)
    if (contract.status === 'sent' || contract.status === 'viewed') {
      setViewMode('sign')
    } else {
      setViewMode('view')
    }
  }

  const handleBack = () => {
    setSelectedContract(null)
    setViewMode(null)
    loadContracts()
  }

  if (selectedContract && viewMode === 'sign') {
    return (
      <ContractSignPage
        isDark={isDark}
        user={user}
        contractId={selectedContract.id}
        onBack={handleBack}
      />
    )
  }

  if (selectedContract && viewMode === 'view') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>

        <GlassCard isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {selectedContract.title}
            </h2>
            <ContractStatusBadge status={selectedContract.status} isDark={isDark} />
          </div>

          {selectedContract.pdf_url ? (
            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <a
                href={selectedContract.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDFを表示
              </a>
            </div>
          ) : selectedContract.content ? (
            <div
              className={`p-6 rounded-lg prose max-w-none ${
                isDark ? 'bg-gray-800 prose-invert text-gray-200' : 'bg-gray-50 text-gray-800'
              }`}
              dangerouslySetInnerHTML={{ __html: selectedContract.content }}
            />
          ) : null}

          <div className={`mt-4 pt-4 border-t space-y-1 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            {selectedContract.sent_at && (
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                送信日: {new Date(selectedContract.sent_at).toLocaleString('ja-JP')}
              </p>
            )}
            {selectedContract.signed_at && (
              <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                署名日: {new Date(selectedContract.signed_at).toLocaleString('ja-JP')}
              </p>
            )}
            {selectedContract.rejected_at && (
              <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                拒否日: {new Date(selectedContract.rejected_at).toLocaleString('ja-JP')}
              </p>
            )}
            {selectedContract.rejection_reason && (
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                拒否理由: {selectedContract.rejection_reason}
              </p>
            )}
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="契約"
        subtitle="電子契約の確認・署名"
        isDark={isDark}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
        </div>
      ) : contracts.length === 0 ? (
        <GlassCard isDark={isDark}>
          <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            契約はありません
          </p>
        </GlassCard>
      ) : (
        <>
          {unsigned.length > 0 && (
            <section>
              <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                未署名の契約
              </h2>
              <div className="space-y-3">
                {unsigned.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    isDark={isDark}
                    onClick={() => handleContractClick(contract)}
                  />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                締結済み契約
              </h2>
              <div className="space-y-3">
                {completed.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    isDark={isDark}
                    onClick={() => handleContractClick(contract)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function ContractCard({ contract, isDark, onClick }) {
  return (
    <GlassCard isDark={isDark} padding="p-4" className="cursor-pointer hover:scale-[1.01] transition-transform" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {contract.title}
          </h3>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {contract.sent_at && `送信: ${new Date(contract.sent_at).toLocaleDateString('ja-JP')}`}
            {contract.signed_at && ` / 署名: ${new Date(contract.signed_at).toLocaleDateString('ja-JP')}`}
          </p>
        </div>
        <ContractStatusBadge status={contract.status} isDark={isDark} />
      </div>
    </GlassCard>
  )
}

function ContractStatusBadge({ status, isDark }) {
  const styles = {
    sent: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700',
    viewed: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700',
    signed: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700',
    rejected: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700',
  }
  const labels = {
    sent: '送信済み',
    viewed: '閲覧済み',
    signed: '署名済み',
    rejected: '拒否',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  )
}
