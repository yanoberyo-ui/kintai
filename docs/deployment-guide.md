# デプロイガイド

## ビルド済みファイル

プロジェクトは既にビルド済みです。`dist/` フォルダに本番用のファイルが生成されています。

## デプロイ方法の選択肢

### 方法1: GitHub Pages（推奨・無料）

1. **GitHubリポジトリにプッシュ**
   ```bash
   git add .
   git commit -m "Add password reset feature"
   git push origin main
   ```

2. **GitHubリポジトリの設定**
   - リポジトリの「Settings」→「Pages」を開く
   - 「Source」で「GitHub Actions」を選択
   - または「Deploy from a branch」で`main`ブランチの`dist`フォルダを選択

3. **GitHub Actionsワークフローの作成**（推奨）
   `.github/workflows/deploy.yml` を作成：
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

### 方法2: Netlify（無料・簡単）

1. **Netlifyアカウント作成**
   - https://www.netlify.com にアクセス
   - GitHubアカウントでログイン

2. **デプロイ**
   - 「Add new site」→「Import an existing project」
   - GitHubリポジトリを選択
   - ビルド設定：
     - Build command: `npm run build`
     - Publish directory: `dist`
   - 「Deploy site」をクリック

3. **環境変数の設定**
   - 「Site settings」→「Environment variables」
   - 以下を追加：
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

### 方法3: Supabase Hosting（無料・Supabaseと統合）

1. **Supabase CLIのインストール**
   ```bash
   npm install -g supabase
   ```

2. **Supabaseにログイン**
   ```bash
   supabase login
   ```

3. **プロジェクトをリンク**
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **デプロイ**
   ```bash
   supabase functions deploy
   # または
   supabase deploy
   ```

### 方法4: 手動デプロイ（任意のホスティング）

1. **ビルドファイルをアップロード**
   - `dist/` フォルダの内容をホスティングサービスにアップロード
   - 環境変数はホスティングサービスの設定で指定

2. **環境変数の設定**
   - ホスティングサービスの環境変数設定で以下を設定：
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

## 環境変数の設定

どのデプロイ方法でも、以下の環境変数を設定する必要があります：

- `VITE_SUPABASE_URL`: SupabaseプロジェクトのURL
- `VITE_SUPABASE_ANON_KEY`: Supabaseの匿名キー

**注意**: Viteの環境変数は `VITE_` プレフィックスが必要です。

## デプロイ後の確認事項

1. **パスワードリセット機能の動作確認**
   - ログイン画面で「パスワードを忘れた場合」をクリック
   - メールアドレスを入力して送信
   - メールが届くか確認

2. **リダイレクトURLの更新**
   - Supabaseダッシュボードで「Redirect URLs」を更新
   - 本番環境のURLを追加（例: `https://your-domain.com/reset-password`）

3. **SMTP設定の確認**
   - 本番環境でもメール送信が動作するか確認
   - 必要に応じてSMTP設定を確認

## トラブルシューティング

### ビルドエラー

```bash
npm run build
```

エラーが発生した場合は、エラーメッセージを確認して修正してください。

### 環境変数が読み込まれない

- 環境変数に `VITE_` プレフィックスが付いているか確認
- ホスティングサービスの環境変数設定を確認
- ビルド後に環境変数が埋め込まれているか確認

### ルーティングエラー

- SPA（Single Page Application）の設定が必要
- すべてのルートを `index.html` にリダイレクトする設定を追加

