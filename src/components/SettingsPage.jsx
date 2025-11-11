import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function SettingsPage({ user, isDark, setIsDark }) {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

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
      setUserData(data)
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
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
        <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          アカウント情報
        </h2>

        <div className="space-y-4">
          {/* アバター */}
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white ${
              isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-800 to-gray-700'
            }`}>
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {userData?.name || user?.email?.split('@')[0]}
              </div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* ユーザー詳細情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                氏名
              </label>
              <div className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
              }`}>
                {userData?.name || '-'}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Slack ID
              </label>
              <div className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
              }`}>
                {userData?.slack_id || '-'}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                部署
              </label>
              <div className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
              }`}>
                {userData?.department || '-'}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                権限
              </label>
              <div className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
              }`}>
                {userData?.role === 'admin' ? '管理者' : 'ユーザー'}
              </div>
            </div>
          </div>
        </div>
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
    </div>
  )
}
