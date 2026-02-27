import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabase'
import { generateSalt, hashHintAnswer } from '../../../utils/crypto'
import { GlassCard, Button, Input, PageHeader } from '../../../components/ui'
import ProfileEdit from './ProfileEdit'

export default function SettingsPage({ user, isDark, setIsDark, onUserUpdate }) {
  const [userData, setUserData] = useState({
    name: '',
    slack_user_id: '',
    department: '',
    birthday: '',
    avatar_url: null,
    password_hint: null,
  })
  const [hintQuestion, setHintQuestion] = useState('')
  const [hintAnswer, setHintAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [showHintSetting, setShowHintSetting] = useState(false)
  const [tempHintQuestion, setTempHintQuestion] = useState('')
  const [tempHintAnswer, setTempHintAnswer] = useState('')
  const [hintSaving, setHintSaving] = useState(false)

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
      const passwordHint = data.password_hint || null
      setUserData({
        name: data.name || '',
        slack_user_id: data.slack_user_id || '',
        department: data.department || '',
        birthday: data.birthday || '',
        avatar_url: data.avatar_url || null,
        password_hint: passwordHint,
      })
      // Set hint question and answer if exists
      if (passwordHint && typeof passwordHint === 'object') {
        setHintQuestion(passwordHint.question || '')
        setHintAnswer(passwordHint.answer || '')
      } else {
        setHintQuestion('')
        setHintAnswer('')
      }
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
      // Prepare password hint data
      let passwordHintData = null
      if (hintQuestion.trim() && hintAnswer.trim()) {
        passwordHintData = {
          question: hintQuestion.trim(),
          answer: hintAnswer.trim(),
        }
      }

      const { error } = await supabase
        .from('users')
        .update({
          name: userData.name,
          slack_user_id: userData.slack_user_id || null,
          department: userData.department || null,
          birthday: userData.birthday || null,
          password_hint: passwordHintData,
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

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordChanging(true)
    setPasswordMessage('')

    if (newPassword !== confirmPassword) {
      setPasswordMessage('❌ パスワードが一致しません')
      setPasswordChanging(false)
      return
    }

    if (newPassword.length < 6) {
      setPasswordMessage('❌ パスワードは6文字以上である必要があります')
      setPasswordChanging(false)
      return
    }

    try {
      // 現在のパスワードで再認証（セキュリティのため）
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (reauthError) {
        throw new Error('現在のパスワードが正しくありません')
      }

      // パスワードを変更
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      setPasswordMessage('✅ パスワードを変更しました！')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)
      setTimeout(() => setPasswordMessage(''), 5000)
    } catch (error) {
      console.error('Password change error:', error)
      setPasswordMessage('❌ エラー: ' + (error.message || 'パスワードの変更に失敗しました'))
    } finally {
      setPasswordChanging(false)
    }
  }

  const handleHintSave = async () => {
    if (!tempHintQuestion.trim()) {
      setPasswordMessage('❌ 質問を入力してください')
      return
    }

    if (!tempHintAnswer.trim()) {
      setPasswordMessage('❌ 答えを入力してください')
      return
    }

    setHintSaving(true)
    setPasswordMessage('')

    try {
      const salt = generateSalt()
      const answerHash = await hashHintAnswer(tempHintAnswer, salt)
      const hintData = {
        question: tempHintQuestion.trim(),
        answer_hash: answerHash,
        salt: salt,
      }

      const { error } = await supabase
        .from('users')
        .update({ password_hint: hintData })
        .eq('id', user.id)

      if (error) throw error

      setPasswordMessage('✅ パスワードヒントを設定しました！')
      setUserData({ ...userData, password_hint: hintData })
      setHintQuestion(tempHintQuestion.trim())
      setHintAnswer('')
      setTempHintQuestion('')
      setTempHintAnswer('')
      setShowHintSetting(false)
      setTimeout(() => setPasswordMessage(''), 3000)
    } catch (error) {
      console.error('Hint save error:', error)
      setPasswordMessage('❌ ヒントの設定に失敗しました。もう一度お試しください。')
    } finally {
      setHintSaving(false)
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
    <div className="max-w-4xl mx-auto space-y-6 h-[calc(100dvh-14rem)] md:h-[calc(100dvh-8rem)] overflow-y-auto">
      {/* ページタイトル */}
      <PageHeader
        isDark={isDark}
        title="設定"
        subtitle="アカウント情報とアプリケーションの設定を管理します"
      />

      {/* アカウント情報 */}
      <GlassCard isDark={isDark} padding="p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            アカウント情報
          </h2>
          {!isEditing && (
            <Button
              isDark={isDark}
              variant="primary"
              size="md"
              onClick={() => setIsEditing(true)}
            >
              ✏️ 編集
            </Button>
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
              aria-label="プロフィール画像を変更"
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
              {isEditing ? (
                <Input
                  isDark={isDark}
                  label={<>氏名 <span className="text-red-500">*</span></>}
                  id="settings-name"
                  type="text"
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  required
                  placeholder="山田太郎"
                />
              ) : (
                <>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <div className={`px-4 py-3 rounded-xl ${
                    isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                  }`}>
                    {userData?.name || '-'}
                  </div>
                </>
              )}
            </div>

            {/* Slack ID */}
            <div>
              {isEditing ? (
                <Input
                  isDark={isDark}
                  label="Slack ID"
                  id="settings-slack-id"
                  type="text"
                  value={userData.slack_user_id}
                  onChange={(e) => setUserData({ ...userData, slack_user_id: e.target.value })}
                  placeholder="U01234ABCDE"
                />
              ) : (
                <>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Slack ID
                  </label>
                  <div className={`px-4 py-3 rounded-xl ${
                    isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                  }`}>
                    {userData?.slack_user_id || '-'}
                  </div>
                </>
              )}
            </div>

            {/* 部署 */}
            <div>
              {isEditing ? (
                <Input
                  isDark={isDark}
                  label="部署"
                  id="settings-department"
                  type="text"
                  value={userData.department}
                  onChange={(e) => setUserData({ ...userData, department: e.target.value })}
                  placeholder="開発部"
                />
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* 誕生日 */}
            <div>
              {isEditing ? (
                <Input
                  isDark={isDark}
                  label="誕生日"
                  id="settings-birthday"
                  type="date"
                  value={userData.birthday}
                  onChange={(e) => setUserData({ ...userData, birthday: e.target.value })}
                />
              ) : (
                <>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    誕生日
                  </label>
                  <div className={`px-4 py-3 rounded-xl ${
                    isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                  }`}>
                    {userData?.birthday || '-'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* パスワードヒント */}
          <div className="md:col-span-2">
            {isEditing ? (
              <>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  パスワードヒント（質問と答え）
                </label>
                <div className="space-y-3">
                  <Input
                    isDark={isDark}
                    label="質問"
                    id="settings-hint-question"
                    type="text"
                    value={hintQuestion}
                    onChange={(e) => setHintQuestion(e.target.value)}
                    placeholder="例: ちっちゃい頃の車は？"
                  />
                  <Input
                    isDark={isDark}
                    label="答え"
                    id="settings-hint-answer"
                    type="text"
                    value={hintAnswer}
                    onChange={(e) => setHintAnswer(e.target.value)}
                    placeholder="例: ハイエース"
                  />
                </div>
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  💡 パスワードを忘れた場合、この質問と答えでパスワードをリセットできます。
                  <br />
                  例: 質問「ちっちゃい頃の車は？」→ 答え「ハイエース」
                </p>
              </>
            ) : (
              <>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  パスワードヒント（質問と答え）
                </label>
                <div className={`px-4 py-3 rounded-xl ${
                  isDark ? 'bg-gray-800/50 text-white' : 'bg-gray-50 text-gray-900'
                }`}>
                  {userData?.password_hint && typeof userData.password_hint === 'object' ? (
                    <div className="space-y-2">
                      <div>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          質問:
                        </span>
                        <span className="ml-2">{userData.password_hint.question || '-'}</span>
                      </div>
                      <div>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          答え:
                        </span>
                        <span className="ml-2 opacity-60">設定済み（セキュリティのため非表示）</span>
                      </div>
                    </div>
                  ) : (
                    <span className="opacity-40">未設定</span>
                  )}
                </div>
              </>
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
              <Button
                isDark={isDark}
                variant="primary"
                size="full"
                type="submit"
                disabled={saving}
              >
                {saving ? '保存中...' : '💾 保存'}
              </Button>
              <Button
                isDark={isDark}
                variant="secondary"
                size="lg"
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  loadUserData()
                }}
              >
                キャンセル
              </Button>
            </div>
          )}
        </form>
      </GlassCard>

      {/* 表示設定 */}
      <GlassCard isDark={isDark} padding="p-8">
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
              aria-label="ダークモードを切り替え"
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
      </GlassCard>

      {/* パスワード変更 */}
      <GlassCard isDark={isDark} padding="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              パスワード変更
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              アカウントのパスワードを変更します
            </p>
          </div>
          {!showPasswordChange && (
            <div className="flex gap-2">
              {!userData.password_hint && (
                <Button
                  isDark={isDark}
                  variant="blue"
                  size="md"
                  onClick={() => setShowHintSetting(true)}
                >
                  💡 ヒントを設定
                </Button>
              )}
              <Button
                isDark={isDark}
                variant="primary"
                size="md"
                onClick={() => setShowPasswordChange(true)}
              >
                🔒 パスワードを変更
              </Button>
            </div>
          )}
        </div>

        {/* パスワードヒント設定フォーム */}
        {showHintSetting && (
          <div className={`mb-6 p-4 rounded-xl border ${
            isDark
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <h3 className={`text-lg font-medium mb-3 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              💡 パスワードヒントを設定
            </h3>
            <p className={`text-sm mb-4 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              パスワードを忘れた場合、この質問と答えでパスワードをリセットできます。
              <br />
              例: 質問「ちっちゃい頃の車は？」→ 答え「ハイエース」
            </p>
            <div className="space-y-3">
              <Input
                isDark={isDark}
                label="質問"
                id="hint-setting-question"
                type="text"
                value={tempHintQuestion}
                onChange={(e) => setTempHintQuestion(e.target.value)}
                placeholder="例: ちっちゃい頃の車は？"
              />
              <Input
                isDark={isDark}
                label="答え"
                id="hint-setting-answer"
                type="text"
                value={tempHintAnswer}
                onChange={(e) => setTempHintAnswer(e.target.value)}
                placeholder="例: ハイエース"
              />
              <div className="flex gap-2">
                <Button
                  isDark={isDark}
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowHintSetting(false)
                    setTempHintQuestion('')
                    setTempHintAnswer('')
                    setPasswordMessage('')
                  }}
                >
                  キャンセル
                </Button>
                <Button
                  isDark={isDark}
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={handleHintSave}
                  disabled={hintSaving}
                >
                  {hintSaving ? '保存中...' : '💾 保存'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* メッセージ表示 */}
        {passwordMessage && !showPasswordChange && (
          <div className={`mb-4 p-4 rounded-xl ${
            passwordMessage.includes('✅')
              ? isDark ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-800'
              : isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-800'
          }`}>
            {passwordMessage}
          </div>
        )}

        {showPasswordChange && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* パスワードヒント表示 */}
            {userData.password_hint ? (
              <div className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-blue-900/20 border-blue-700/50'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className={`text-sm font-medium mb-1 ${
                  isDark ? 'text-blue-300' : 'text-blue-800'
                }`}>
                  💡 パスワードヒント
                </div>
                <div className={`text-sm ${
                  isDark ? 'text-blue-200' : 'text-blue-700'
                }`}>
                  {userData.password_hint}
                </div>
                <div className={`text-xs mt-2 ${
                  isDark ? 'text-blue-300/70' : 'text-blue-600/70'
                }`}>
                  パスワードを忘れた場合は、このヒントを使ってリセットできます
                </div>
              </div>
            ) : (
              <div className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-yellow-900/20 border-yellow-700/50'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className={`text-sm font-medium mb-1 ${
                  isDark ? 'text-yellow-300' : 'text-yellow-800'
                }`}>
                  ⚠️ パスワードヒントが設定されていません
                </div>
                <div className={`text-xs mt-2 ${
                  isDark ? 'text-yellow-300/70' : 'text-yellow-600/70'
                }`}>
                  パスワードを忘れた場合に備えて、ヒントを設定することをおすすめします
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false)
                    setShowHintSetting(true)
                  }}
                  className={`mt-3 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isDark
                      ? 'bg-yellow-700 text-white hover:bg-yellow-600'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  💡 ヒントを設定する
                </button>
              </div>
            )}

            <Input
              isDark={isDark}
              label="現在のパスワード"
              id="settings-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="現在のパスワードを入力"
              required
            />

            <Input
              isDark={isDark}
              label="新しいパスワード"
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6文字以上"
              required
              minLength={6}
            />

            <Input
              isDark={isDark}
              label="新しいパスワード（確認）"
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度入力"
              required
              minLength={6}
            />

            {passwordMessage && (
              <div className={`p-4 rounded-xl ${
                passwordMessage.includes('✅')
                  ? isDark ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-800'
                  : isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-800'
              }`}>
                {passwordMessage}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                isDark={isDark}
                variant="secondary"
                size="lg"
                type="button"
                onClick={() => {
                  setShowPasswordChange(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordMessage('')
                }}
              >
                キャンセル
              </Button>
              <Button
                isDark={isDark}
                variant="primary"
                size="full"
                type="submit"
                disabled={passwordChanging}
              >
                {passwordChanging ? '変更中...' : '💾 パスワードを変更'}
              </Button>
            </div>
          </form>
        )}
      </GlassCard>

      {/* 危険な操作 */}
      <GlassCard isDark={isDark} padding="p-8" className={isDark ? 'border-red-900/50' : 'border-red-200/50'}>
        <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          危険な操作
        </h2>

        <Button
          isDark={isDark}
          variant="danger"
          size="lg"
          onClick={() => supabase.auth.signOut()}
        >
          ログアウト
        </Button>
      </GlassCard>

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
