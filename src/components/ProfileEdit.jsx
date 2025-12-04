import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function ProfileEdit({ user, onClose, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url)

  const uploadAvatar = async (event) => {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('画像を選択してください')
      }

      const file = event.target.files[0]
      
      // ファイルサイズチェック（10MB以下）
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('ファイルサイズは10MB以下にしてください')
      }

      const fileExt = file.name.split('.').pop().toLowerCase()
      // タイムスタンプを追加してキャッシュ問題を回避
      const fileName = `${user.id}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // 既存のアバターを削除（エラーは無視）
      if (user.avatar_url) {
        try {
          const oldPath = user.avatar_url.split('/').slice(-2).join('/')
          await supabase.storage.from('avatars').remove([oldPath])
        } catch (e) {
          // 削除に失敗しても続行
          console.log('既存アバターの削除をスキップ:', e)
        }
      }

      // 新しいアバターをアップロード
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // 公開URLを取得（キャッシュバスター付き）
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      
      const newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`

      // ユーザーテーブルを更新
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(newAvatarUrl)
      alert('アイコンを更新しました！')
      onUpdate?.()
    } catch (error) {
      console.error('アバターアップロードエラー:', error)
      alert('エラーが発生しました: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            プロフィール編集
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* アバター表示 */}
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">
                  👤
                </div>
              )}
            </div>

            {/* アップロードボタン */}
            <div className="flex gap-3 flex-wrap justify-center">
              {/* カメラで撮影 */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={uploadAvatar}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  📷 {uploading ? 'アップロード中...' : '写真を撮る'}
                </div>
              </label>

              {/* ギャラリーから選択 */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadAvatar}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  🖼️ {uploading ? 'アップロード中...' : 'ギャラリー'}
                </div>
              </label>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
              JPG, PNG, GIF (最大10MB)
            </p>
          </div>

          {/* ユーザー情報 */}
          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">名前</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {user?.name}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">メール</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {user?.email}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">所属</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {user?.department}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
