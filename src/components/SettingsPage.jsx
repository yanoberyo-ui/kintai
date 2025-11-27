import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import ProfileEdit from './ProfileEdit'

export default function SettingsPage({ user, isDark, setIsDark, onUserUpdate }) {
  const [userData, setUserData] = useState({
    name: '',
    slack_user_id: '',
    department: '',
    birthday: '',
    avatar_url: null,
    password_hint: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [user])

  const loadUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setUserData({
        name: data.name || '',
        slack_user_id: data.slack_user_id || '',
        department: data.department || '',
        birthday: data.birthday || '',
        avatar_url: data.avatar_url || null,
        password_hint: data.password_hint || '',
      })
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: userData.name,
          slack_user_id: userData.slack_user_id || null,
          department: userData.department || null,
          birthday: userData.birthday || null,
          password_hint: userData.password_hint || null,
        })
        .eq('id', user.id)

      if (error) throw error

      setMessage('✅ 保存しました！')
      setIsEditing(false)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('❌ エラー: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ページタイトル */}
      <div>
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          設定
        </h1>
        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          アカウント情報とアプリケーションの設定を管理します
        </p>
      </div>

      {/* アカウント情報 */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-8 transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            アカウント情報
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              ✏️ 編集
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* アバター */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowProfileEdit(true)}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden hover:ring-4 hover:ring-blue-500 transition-all ${
                isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
              }`}
              title="プロフィール画像を変更"
            >
              {userData?.avatar_url ? (
                <img src={userData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.email?.charAt(0).toUpperCase()
              )}
            </button>
            <div>
              <div className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {userData?.name || user?.email?.split('@')[0]}
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* フィールド */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 名前 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                氏名 <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  required
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                  }`}
                  placeholder="山田太郎"
                />
              ) : (
                <div className={`px-4 py-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                }`}>
                  {userData?.name || '-'}
                </div>
              )}
            </div>

            {/* Slack ID */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Slack ID
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.slack_user_id}
                  onChange={(e) => setUserData({ ...userData, slack_user_id: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                  }`}
                  placeholder="U01234ABCDE"
                />
              ) : (
                <div className={`px-4 py-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                }`}>
                  {userData?.slack_user_id || '-'}
                </div>
              )}
            </div>

            {/* 部署 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                部署
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.department}
                  onChange={(e) => setUserData({ ...userData, department: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                  }`}
                  placeholder="開発部"
                />
              ) : (
                <div className={`px-4 py-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                }`}>
                  {userData?.department || '-'}
                </div>
              )}
            </div>

            {/* 誕生日 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                誕生日
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={userData.birthday}
                  onChange={(e) => setUserData({ ...userData, birthday: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                  }`}
                />
              ) : (
                <div className={`px-4 py-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                }`}>
                  {userData?.birthday || '-'}
                </div>
              )}
            </div>
          </div>

          {/* パスワードヒント */}
          <div className="md:col-span-2">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              パスワードヒント
            </label>
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={userData.password_hint}
                  onChange={(e) => setUserData({ ...userData, password_hint: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors outline-none ${
                    isDark
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-gray-400'
                  }`}
                  placeholder="例: ちっちゃい頃の車"
                />
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  💡 パスワードを忘れた場合、このヒントとメールアドレスでパスワードをリセットできます。
                  <br />
                  例: 「ちっちゃい頃の車」「好きな食べ物」「ペットの名前」など、自分だけが知っている情報を設定してください。
                </p>
              </>
            ) : (
              <div className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
              }`}>
                {userData?.password_hint ? (
                  <span className="opacity-60">設定済み（セキュリティのため非表示）</span>
                ) : (
                  <span className="opacity-40">未設定</span>
                )}
              </div>
            )}
          </div>

          {/* メッセージ */}
          {message && (
            <div className={`p-4 rounded-xl ${
              message.includes('✅')
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}>
              {message}
            </div>
          )}

          {/* 保存・キャンセルボタン */}
          {isEditing && (
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 py-3 rounded-xl font-medium transition-all duration-200 ${
                  saving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {saving ? '保存中...' : '💾 保存'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  loadUserData()
                }}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                キャンセル
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 表示設定 */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-8 transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          表示設定
        </h2>

        <div className="space-y-4">
          {/* ダークモード切り替え */}
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ダークモード
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                アプリケーションの配色を変更します
              </div>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isDark ? 'bg-white' : 'bg-gray-900'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full transition-transform ${
                  isDark
                    ? 'translate-x-7 bg-gray-900'
                    : 'translate-x-1 bg-white'
                }`}
              />
            </button>
          </div>

          {/* 自動ダークモード情報 */}
          <div className={`p-4 rounded-xl ${
            isDark ? 'bg-gray-800/50' : 'bg-gray-50'
          }`}>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              💡 ヒント: 17:00〜翌朝6:00の間は自動的にダークモードになります。
              上記のスイッチで手動で切り替えることもできます。
            </div>
          </div>
        </div>
      </div>

      {/* 危険な操作 */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-8 transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-red-900/50'
          : 'bg-white/80 shadow-gray-200/50 border-red-200/50'
      }`}>
        <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          危険な操作
        </h2>

        <button
          onClick={() => supabase.auth.signOut()}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
            isDark
              ? 'bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800'
              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
          }`}
        >
          ログアウト
        </button>
      </div>

      {/* プロフィール編集モーダル */}
      {showProfileEdit && (
        <ProfileEdit
          user={{ ...user, avatar_url: userData.avatar_url }}
          onClose={() => setShowProfileEdit(false)}
          onUpdate={() => {
            loadUserData()
            onUserUpdate?.()
          }}
        />
      )}
    </div>
  )
}
