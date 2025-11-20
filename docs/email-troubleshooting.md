# Supabaseメール送信のトラブルシューティング

## メールが届かない場合の確認事項

### 1. Supabaseダッシュボードでの確認

#### 1.1 メール送信設定の確認

1. Supabaseダッシュボードにログイン
2. 「**Authentication**」→「**Settings**」を開く
3. 「**SMTP Settings**」セクションを確認
4. **重要**: 無料プランでは、SupabaseのデフォルトSMTPサーバーが使用されますが、**1時間あたりのメール送信数に制限**があります

#### 1.2 メール送信ログの確認

1. 「**Authentication**」→「**Users**」を開く
2. パスワードリセットをリクエストしたユーザーを検索
3. ユーザーの詳細を開いて、メール送信履歴を確認
4. エラーメッセージがないか確認

#### 1.3 Rate Limitの確認

無料プランでは、メール送信に以下の制限があります：
- **1時間あたり最大4通**のメール
- これを超えると、メールが送信されない可能性があります

**解決策**: 
- しばらく待ってから再度試す
- Supabase Proプランにアップグレード（制限が緩和されます）

### 2. メールボックスの確認

#### 2.1 スパムフォルダを確認

多くの場合、メールはスパムフォルダに入っています：
- Gmail: 「スパム」フォルダ
- Outlook: 「迷惑メール」フォルダ
- その他のメールクライアント: スパム/迷惑メールフォルダ

#### 2.2 メールアドレスの確認

- 正しいメールアドレスを入力しているか確認
- タイプミスがないか確認
- メールアドレスがSupabaseに登録されているか確認

### 3. 開発環境での確認

#### 3.1 コンソールでエラーを確認

ブラウザの開発者ツール（F12）を開いて、コンソールタブでエラーメッセージを確認：

```javascript
// パスワードリセットリクエスト時のエラー
const { error } = await supabase.auth.resetPasswordForEmail(email)
if (error) {
  console.error('Password reset error:', error)
}
```

#### 3.2 ネットワークタブでリクエストを確認

1. 開発者ツールの「Network」タブを開く
2. パスワードリセットをリクエスト
3. `/auth/v1/recover` へのリクエストを確認
4. ステータスコードが200か確認
5. レスポンスにエラーがないか確認

### 4. カスタムSMTPの設定（推奨）

無料プランの制限を回避するには、カスタムSMTPサーバーを設定することをお勧めします。

#### 4.1 Gmail SMTPの設定

1. Supabaseダッシュボードで「**Authentication**」→「**Settings**」を開く
2. 「**SMTP Settings**」セクションで「**Enable Custom SMTP**」をONにする
3. 以下の設定を入力：

```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: 【アプリパスワード】（通常のパスワードではない）
Sender email: your-email@gmail.com
Sender name: FD GROUP 勤怠管理システム
```

**Gmailアプリパスワードの取得方法：**
1. Googleアカウント設定 → セキュリティ
2. 「2段階認証プロセス」を有効化
3. 「アプリパスワード」を生成
4. 生成された16文字のパスワードを使用

#### 4.2 SendGridの設定（推奨）

SendGridは無料プランで1日100通まで送信可能：

1. SendGridアカウントを作成: https://sendgrid.com
2. API Keyを生成
3. SupabaseでSMTP設定：

```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: 【SendGrid API Key】
Sender email: your-verified-email@example.com
Sender name: FD GROUP 勤怠管理システム
```

#### 4.3 Mailgunの設定

Mailgunも無料プランで1ヶ月5,000通まで送信可能：

1. Mailgunアカウントを作成: https://www.mailgun.com
2. SMTP認証情報を取得
3. SupabaseでSMTP設定：

```
Host: smtp.mailgun.org
Port: 587
Username: 【Mailgun SMTP Username】
Password: 【Mailgun SMTP Password】
Sender email: your-verified-email@your-domain.com
Sender name: FD GROUP 勤怠管理システム
```

### 5. テスト方法

#### 5.1 テストメールの送信

Supabaseダッシュボードで直接テストメールを送信：

1. 「**Authentication**」→「**Email Templates**」を開く
2. 「**Reset Password**」テンプレートを選択
3. 「**Send test email**」ボタンをクリック
4. メールアドレスを入力して送信
5. メールが届くか確認

#### 5.2 コードでテスト

```javascript
// パスワードリセットのテスト
const testPasswordReset = async () => {
  const email = 'test@example.com'
  
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    
    if (error) {
      console.error('Error:', error.message)
      alert(`エラー: ${error.message}`)
    } else {
      console.log('Password reset email sent successfully')
      alert('パスワードリセットメールを送信しました。メールボックスを確認してください。')
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    alert(`予期しないエラーが発生しました: ${err.message}`)
  }
}
```

### 6. よくあるエラーと解決策

#### エラー: "Email rate limit exceeded"

**原因**: 1時間あたりのメール送信制限を超えた

**解決策**:
- しばらく待ってから再度試す
- カスタムSMTPを設定する
- Supabase Proプランにアップグレード

#### エラー: "Invalid email address"

**原因**: メールアドレスの形式が正しくない

**解決策**:
- メールアドレスの形式を確認（例: `user@example.com`）
- スペースや特殊文字がないか確認

#### エラー: "User not found"

**原因**: そのメールアドレスでユーザーが登録されていない

**解決策**:
- 正しいメールアドレスを入力
- ユーザーがSupabaseに登録されているか確認

### 7. デバッグ用コードの追加

アプリにデバッグ情報を追加して、問題を特定しやすくします：

```javascript
// src/App.jsx の handlePasswordReset 関数を更新
const handlePasswordReset = async (e) => {
  e.preventDefault()
  setResetLoading(true)
  setResetError('')
  setResetSuccess(false)

  try {
    console.log('Sending password reset email to:', resetEmail)
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      console.error('Password reset error:', error)
      console.error('Error code:', error.status)
      console.error('Error message:', error.message)
      throw error
    }

    console.log('Password reset email sent successfully:', data)
    setResetSuccess(true)
    setResetEmail('')
  } catch (error) {
    console.error('Password reset error:', error)
    setResetError(error.message || 'パスワードリセットメールの送信に失敗しました')
  } finally {
    setResetLoading(false)
  }
}
```

## まとめ

メールが届かない場合のチェックリスト：

- [ ] Supabaseダッシュボードでメール送信ログを確認
- [ ] スパムフォルダを確認
- [ ] メールアドレスが正しいか確認
- [ ] Rate Limitに達していないか確認
- [ ] ブラウザのコンソールでエラーを確認
- [ ] カスタムSMTPを設定（推奨）
- [ ] テストメールを送信して確認

それでも解決しない場合は、Supabaseのサポートに問い合わせるか、カスタムSMTPの設定を検討してください。

