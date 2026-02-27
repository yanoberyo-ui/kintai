import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../utils/supabase'
import { GlassCard, Button, Modal } from '../../../components/ui'

export default function ContractSignPage({ isDark, user, contractId, onBack }) {
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showSignConfirm, setShowSignConfirm] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [signing, setSigning] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [signed, setSigned] = useState(false)

  const loadContract = useCallback(async () => {
    if (!contractId) return
    try {
      const { data, error: fetchError } = await supabase
        .from('contracts')
        .select('*, signer:users!contracts_signer_id_fkey(id, name, email), template:contract_templates(*)')
        .eq('id', contractId)
        .single()

      if (fetchError) throw fetchError

      if (data.signer_id !== user?.id) {
        setError('この契約の署名権限がありません')
        return
      }

      setContract(data)

      // Mark as viewed on first view
      if (data.status === 'sent') {
        await supabase
          .from('contracts')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', data.id)
        setContract(prev => ({ ...prev, status: 'viewed', viewed_at: new Date().toISOString() }))
      }
    } catch (err) {
      console.error('Error loading contract:', err)
      setError('契約の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [contractId, user?.id])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  const handleSign = async () => {
    setSigning(true)
    try {
      const { error: signError } = await supabase
        .from('contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signer_ip: 'unknown',
          signer_user_agent: navigator.userAgent,
        })
        .eq('id', contract.id)

      if (signError) throw signError
      setShowSignConfirm(false)
      setSigned(true)
      setContract(prev => ({ ...prev, status: 'signed', signed_at: new Date().toISOString() }))
    } catch (err) {
      console.error('Error signing contract:', err)
    } finally {
      setSigning(false)
    }
  }

  const handleReject = async () => {
    setRejecting(true)
    try {
      const { error: rejectError } = await supabase
        .from('contracts')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', contract.id)

      if (rejectError) throw rejectError
      setShowRejectModal(false)
      setContract(prev => ({
        ...prev,
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      }))
    } catch (err) {
      console.error('Error rejecting contract:', err)
    } finally {
      setRejecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-white' : 'border-gray-900'}`} />
      </div>
    )
  }

  if (error) {
    return (
      <GlassCard isDark={isDark}>
        <p className={`text-center py-8 ${isDark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>
      </GlassCard>
    )
  }

  if (signed) {
    return (
      <div className="space-y-6">
        <GlassCard isDark={isDark}>
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-bounce">&#10003;</div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              署名完了
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              契約に署名しました。ありがとうございます。
            </p>
            {onBack && (
              <Button isDark={isDark} className="mt-6" onClick={onBack}>
                戻る
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    )
  }

  const isActionable = contract?.status === 'sent' || contract?.status === 'viewed'

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          onClick={onBack}
          className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
      )}

      <GlassCard isDark={isDark}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {contract?.title}
          </h2>
          <StatusBadge status={contract?.status} isDark={isDark} />
        </div>

        {contract?.pdf_url ? (
          <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <a
              href={contract.pdf_url}
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
        ) : contract?.content ? (
          <div
            className={`p-6 rounded-lg mb-4 prose max-w-none ${
              isDark ? 'bg-gray-800 prose-invert text-gray-200' : 'bg-gray-50 text-gray-800'
            }`}
            dangerouslySetInnerHTML={{ __html: contract.content }}
          />
        ) : null}

        {contract?.sent_at && (
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            送信日: {new Date(contract.sent_at).toLocaleString('ja-JP')}
          </p>
        )}
      </GlassCard>

      {isActionable && (
        <div className="flex gap-3">
          <Button
            isDark={isDark}
            variant="blue"
            size="full"
            onClick={() => setShowSignConfirm(true)}
          >
            署名する
          </Button>
          <Button
            isDark={isDark}
            variant="danger"
            size="full"
            onClick={() => setShowRejectModal(true)}
          >
            拒否する
          </Button>
        </div>
      )}

      {contract?.status === 'signed' && (
        <GlassCard isDark={isDark} padding="p-4">
          <p className={`text-sm text-center ${isDark ? 'text-green-400' : 'text-green-600'}`}>
            この契約は {new Date(contract.signed_at).toLocaleString('ja-JP')} に署名済みです
          </p>
        </GlassCard>
      )}

      {contract?.status === 'rejected' && (
        <GlassCard isDark={isDark} padding="p-4">
          <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-500'}`}>
            拒否日: {new Date(contract.rejected_at).toLocaleString('ja-JP')}
          </p>
          {contract.rejection_reason && (
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              理由: {contract.rejection_reason}
            </p>
          )}
        </GlassCard>
      )}

      {/* Sign confirmation modal */}
      <Modal isOpen={showSignConfirm} onClose={() => setShowSignConfirm(false)} isDark={isDark}>
        <div className="p-6">
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            署名の確認
          </h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            「{contract?.title}」に署名します。この操作は取り消せません。よろしいですか？
          </p>
          <div className="flex justify-end gap-3">
            <Button isDark={isDark} variant="secondary" size="sm" onClick={() => setShowSignConfirm(false)}>
              キャンセル
            </Button>
            <Button isDark={isDark} variant="blue" size="sm" onClick={handleSign} disabled={signing}>
              {signing ? '署名中...' : '署名する'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rejection modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} isDark={isDark}>
        <div className="p-6">
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            契約の拒否
          </h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            拒否理由を入力してください（任意）
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors resize-none ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300'
            }`}
            placeholder="拒否理由..."
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button isDark={isDark} variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>
              キャンセル
            </Button>
            <Button isDark={isDark} variant="danger" size="sm" onClick={handleReject} disabled={rejecting}>
              {rejecting ? '処理中...' : '拒否する'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatusBadge({ status, isDark }) {
  const styles = {
    draft: isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600',
    sent: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700',
    viewed: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700',
    signed: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700',
    rejected: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700',
  }
  const labels = {
    draft: '下書き',
    sent: '送信済み',
    viewed: '閲覧済み',
    signed: '署名済み',
    rejected: '拒否',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  )
}
