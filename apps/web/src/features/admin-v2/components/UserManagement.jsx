import React, { useState } from 'react'
import { supabase } from '../../../utils/supabase'

export default function UserManagement({ isDark, users, onReloadUsers }) {
  const [showBulkDeptModal, setShowBulkDeptModal] = useState(false)
  const [bulkDeptCondition, setBulkDeptCondition] = useState('person')
  const [bulkDeptPersonId, setBulkDeptPersonId] = useState('')
  const [bulkDeptDepartmentNames, setBulkDeptDepartmentNames] = useState([])
  const [bulkDeptTarget, setBulkDeptTarget] = useState('')
  const [bulkDeptSaving, setBulkDeptSaving] = useState(false)

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
      if (error) throw error
      onReloadUsers()
      alert('権限を更新しました')
    } catch (error) {
      console.error('Error updating user role:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const handleToggleDeactivate = async (userId, userName, currentTags) => {
    const isDeactivated = currentTags?.includes('deactivated')
    const action = isDeactivated ? '有効化' : '無効化'
    if (!window.confirm(`${userName}さんのアカウントを${action}しますか？`)) return
    try {
      const newTags = isDeactivated
        ? (currentTags || []).filter(t => t !== 'deactivated')
        : [...(currentTags || []), 'deactivated']
      const { error } = await supabase.from('users').update({ tags: newTags }).eq('id', userId)
      if (error) throw error
      onReloadUsers()
      alert(`${userName}さんのアカウントを${action}しました`)
    } catch (error) {
      console.error('Error toggling user deactivation:', error)
      alert(`エラー: ${error.message}`)
    }
  }

  const getBulkDeptTargetUsers = () => {
    if (!users.length) return []
    const deptSet = new Set(bulkDeptDepartmentNames)
    switch (bulkDeptCondition) {
      case 'person': return bulkDeptPersonId ? users.filter(u => u.id === bulkDeptPersonId) : []
      case 'person_except': return bulkDeptPersonId ? users.filter(u => u.id !== bulkDeptPersonId) : []
      case 'departments': return bulkDeptDepartmentNames.length > 0 ? users.filter(u => u.department && deptSet.has(u.department)) : []
      case 'departments_except': return bulkDeptDepartmentNames.length > 0 ? users.filter(u => !u.department || !deptSet.has(u.department)) : []
      case 'person_except_and_departments_except':
        return bulkDeptPersonId && bulkDeptDepartmentNames.length > 0
          ? users.filter(u => u.id !== bulkDeptPersonId && (!u.department || !deptSet.has(u.department)))
          : []
      default: return []
    }
  }

  const handleBulkDepartmentUpdate = async () => {
    const targetUsers = getBulkDeptTargetUsers()
    if (targetUsers.length === 0) { alert('条件に該当するユーザーがいません'); return }
    if (!bulkDeptTarget.trim()) { alert('変更先の部署を選択してください'); return }
    if (!window.confirm(`${targetUsers.length}名の部署を「${bulkDeptTarget}」に変更します。よろしいですか？`)) return
    setBulkDeptSaving(true)
    try {
      for (const u of targetUsers) {
        const { error } = await supabase.from('users').update({ department: bulkDeptTarget.trim() }).eq('id', u.id)
        if (error) throw error
      }
      onReloadUsers()
      setShowBulkDeptModal(false)
      setBulkDeptPersonId('')
      setBulkDeptDepartmentNames([])
      setBulkDeptTarget('')
      alert(`${targetUsers.length}名の部署を更新しました`)
    } catch (error) {
      console.error('Bulk department update error:', error)
      alert(`エラー: ${error.message}`)
    } finally {
      setBulkDeptSaving(false)
    }
  }

  const toggleBulkDeptDepartment = (dept) => {
    setBulkDeptDepartmentNames(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept])
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
        <div className={`flex justify-between items-center px-6 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>社員一覧</h3>
          <button type="button" onClick={() => setShowBulkDeptModal(true)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
            部署を一括変更
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-gray-800/50' : 'bg-gray-50'}>
              <tr>
                {['社員情報', 'メールアドレス', '部署', '権限', 'ステータス', '登録日', '操作'].map(h => (
                  <th key={h} className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {users.map((user) => (
                <tr key={user.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    <div className="font-medium">{user.name}</div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{user.email}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{user.department || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => {
                      if (window.confirm(`${user.name}さんを${user.role === 'admin' ? '一般ユーザー' : '管理者'}に変更しますか？`)) {
                        handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                      }
                    }} className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}>
                      {user.role === 'admin' ? '管理者' : '一般'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.tags?.includes('deactivated') ? (
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">無効</span>
                    ) : (
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">有効</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {new Date(user.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button onClick={() => {
                      if (window.confirm(`${user.name}さんを${user.role === 'admin' ? '一般ユーザー' : '管理者'}に変更しますか？`)) {
                        handleUpdateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin')
                      }
                    }} className={`px-3 py-1 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                      {user.role === 'admin' ? '一般に変更' : '管理者に変更'}
                    </button>
                    <button onClick={() => handleToggleDeactivate(user.id, user.name, user.tags)}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        user.tags?.includes('deactivated') ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}>
                      {user.tags?.includes('deactivated') ? '有効化' : '無効化'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><p>ユーザーデータがありません</p></div>
          )}
        </div>
      </div>

      {/* 部署一括変更モーダル */}
      {showBulkDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !bulkDeptSaving && setShowBulkDeptModal(false)} />
          <div className={`relative w-full max-w-lg rounded-2xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`} onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>部署を一括変更</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>条件に合う社員を指定した部署に変更します</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>対象の条件</label>
                <select value={bulkDeptCondition} onChange={(e) => setBulkDeptCondition(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-sm ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}>
                  <option value="person">この人を</option>
                  <option value="person_except">この人以外を</option>
                  <option value="departments">この部署の人を（複数選択はOR）</option>
                  <option value="departments_except">この部署以外の人を</option>
                  <option value="person_except_and_departments_except">この人以外 かつ この部署以外の人を</option>
                </select>
              </div>

              {(bulkDeptCondition === 'person' || bulkDeptCondition === 'person_except' || bulkDeptCondition === 'person_except_and_departments_except') && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {bulkDeptCondition === 'person' ? '対象の社員' : '除外する社員'}
                  </label>
                  <select value={bulkDeptPersonId} onChange={(e) => setBulkDeptPersonId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-sm ${isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-300'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}>
                    <option value="">選択してください</option>
                    {users.map(u => (<option key={u.id} value={u.id}>{u.name || u.email} ({u.department || '未設定'})</option>))}
                  </select>
                </div>
              )}

              {(bulkDeptCondition === 'departments' || bulkDeptCondition === 'departments_except' || bulkDeptCondition === 'person_except_and_departments_except') && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {bulkDeptCondition === 'departments' ? '対象の部署（いずれかに属する人）' : '対象の部署（この部署以外＝どれにも属さない人）'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(users.map(u => u.department).filter(Boolean))].sort().map(dept => (
                      <button key={dept} type="button" onClick={() => toggleBulkDeptDepartment(dept)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          bulkDeptDepartmentNames.includes(dept)
                            ? isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
                            : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}>
                        {dept}
                      </button>
                    ))}
                    {([...new Set(users.map(u => u.department).filter(Boolean))].length === 0) && (
                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>部署が登録されていません</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>変更先の部署</label>
                <input type="text" value={bulkDeptTarget} onChange={(e) => setBulkDeptTarget(e.target.value)} placeholder="例: 営業部" list="bulk-dept-target-list"
                  className={`w-full px-3 py-2 rounded-xl text-sm ${isDark ? 'bg-gray-800 text-white border border-gray-700 placeholder:text-gray-500' : 'bg-white text-gray-900 border border-gray-300 placeholder:text-gray-400'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`} />
                <datalist id="bulk-dept-target-list">
                  {[...new Set(users.map(u => u.department).filter(Boolean))].sort().map(dept => (<option key={dept} value={dept} />))}
                </datalist>
              </div>

              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                対象: <strong className={isDark ? 'text-white' : 'text-gray-900'}>{getBulkDeptTargetUsers().length}</strong> 名
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => !bulkDeptSaving && setShowBulkDeptModal(false)}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  キャンセル
                </button>
                <button type="button" onClick={handleBulkDepartmentUpdate}
                  disabled={bulkDeptSaving || getBulkDeptTargetUsers().length === 0 || !bulkDeptTarget.trim()}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium text-white ${
                    bulkDeptSaving || getBulkDeptTargetUsers().length === 0 || !bulkDeptTarget.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDark ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}>
                  {bulkDeptSaving ? '更新中...' : '一括変更する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
