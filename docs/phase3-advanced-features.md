# Phase 3: 高度な機能

**優先度**: 低（オプション）
**期間**: 3-4日
**目的**: より高度なタスク管理機能を提供し、タスクの分類と効率的な管理を実現

---

## チケット#6: タスクのカテゴリ/タグ機能

### 📋 概要
タスクにカテゴリやタグを付けて分類できるようにする。仕事・個人・緊急などのカテゴリでタスクを整理し、視覚的に区別できるようにする。

### 🎯 目的
- タスクを種類別に分類
- 優先度や重要度を視覚化
- カテゴリごとにフィルタリング
- より効率的なタスク管理

### 難易度
**Complex** ⭐⭐⭐

### 📦 成果物
- カテゴリマスタ管理機能
- タスクへのカテゴリ割り当て
- カテゴリごとの色分け表示
- カテゴリフィルタリング機能
- データベーススキーマ変更（マイグレーション）

### ⚠️ 注意事項
- **データベーススキーマ変更が必要**
- 既存のタスクデータとの互換性を保つ必要がある
- マイグレーションファイルの作成が必須

### 🔧 実装ステップ

#### ステップ1: データベーススキーマ変更

- [ ] マイグレーションファイルの作成
- [ ] `todo_categories` テーブルの作成
- [ ] `todo_items` テーブルに `category_id` カラム追加
- [ ] Supabaseでマイグレーション実行
- [ ] RLSポリシーの設定

#### ステップ2: バックエンド実装

- [ ] `src/utils/category.js` 新規作成
- [ ] カテゴリCRUD関数の実装
- [ ] カテゴリ取得関数の実装
- [ ] デフォルトカテゴリの初期データ投入

#### ステップ3: フロントエンド実装

- [ ] カテゴリ管理UIの作成
- [ ] タスク追加時のカテゴリ選択UI
- [ ] カテゴリごとの色分け表示
- [ ] カテゴリフィルタリング機能
- [ ] 既存タスクの表示調整

#### ステップ4: テスト・調整

- [ ] 全機能のテスト
- [ ] 既存機能との整合性確認
- [ ] パフォーマンステスト
- [ ] UI/UX調整

### 📝 実装例

#### データベーススキーマ

```sql
-- supabase/migrations/002_add_categories.sql

-- カテゴリマスタテーブル
CREATE TABLE todo_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL, -- Tailwind CSS色クラス (例: blue, red, green)
  icon VARCHAR(10), -- 絵文字アイコン
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_todo_categories_user_id ON todo_categories(user_id);
CREATE INDEX idx_todo_categories_order ON todo_categories(user_id, order_index);

-- RLS設定
ALTER TABLE todo_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories"
  ON todo_categories FOR ALL
  USING (user_id = auth.uid());

-- todo_itemsテーブルにカテゴリカラム追加
ALTER TABLE todo_items
ADD COLUMN category_id UUID REFERENCES todo_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_todo_items_category ON todo_items(category_id);

-- デフォルトカテゴリの挿入関数
CREATE OR REPLACE FUNCTION create_default_categories(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO todo_categories (user_id, name, color, icon, order_index)
  VALUES
    (p_user_id, '仕事', 'blue', '💼', 0),
    (p_user_id, '個人', 'green', '🏠', 1),
    (p_user_id, '緊急', 'red', '🔥', 2),
    (p_user_id, '学習', 'purple', '📚', 3),
    (p_user_id, 'その他', 'gray', '📝', 4);
END;
$$ LANGUAGE plpgsql;
```

#### カテゴリユーティリティ

```javascript
// src/utils/category.js (新規作成)
import { supabase } from './supabase.js';

/**
 * ユーザーの全カテゴリを取得
 */
export async function getUserCategories(userId) {
  const { data, error } = await supabase
    .from('todo_categories')
    .select('*')
    .eq('user_id', userId)
    .order('order_index');

  if (error) throw error;

  return data || [];
}

/**
 * カテゴリを作成
 */
export async function createCategory(userId, name, color, icon) {
  // 現在の最大order_indexを取得
  const { data: categories } = await supabase
    .from('todo_categories')
    .select('order_index')
    .eq('user_id', userId)
    .order('order_index', { ascending: false })
    .limit(1);

  const maxOrder = categories && categories.length > 0 ? categories[0].order_index : -1;

  const { data, error } = await supabase
    .from('todo_categories')
    .insert({
      user_id: userId,
      name,
      color,
      icon,
      order_index: maxOrder + 1
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * カテゴリを更新
 */
export async function updateCategory(categoryId, updates) {
  const { data, error } = await supabase
    .from('todo_categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * カテゴリを削除
 */
export async function deleteCategory(categoryId) {
  const { error } = await supabase
    .from('todo_categories')
    .delete()
    .eq('id', categoryId);

  if (error) throw error;
}

/**
 * デフォルトカテゴリを作成
 */
export async function createDefaultCategories(userId) {
  const { error } = await supabase.rpc('create_default_categories', {
    p_user_id: userId
  });

  if (error) throw error;
}

/**
 * カテゴリの色クラスを取得
 */
export function getCategoryColorClass(color, type = 'bg') {
  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
  };

  return colorMap[color]?.[type] || colorMap.gray[type];
}
```

#### UI実装

```html
<!-- public/index.html: カテゴリ管理セクションを追加 -->

<!-- TODOリストの上部にカテゴリフィルター追加 -->
<div class="bg-white rounded-lg shadow-md p-6">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2">
      <span class="text-xl">📝</span>
      <input
        type="text"
        id="todo-title"
        class="text-lg font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
        value="今日のtodo"
      >
    </div>
    <div class="flex gap-2">
      <button id="manage-categories-btn" class="text-gray-600 hover:text-gray-800" title="カテゴリ管理">
        🏷️
      </button>
      <button id="delete-todo-list-btn" class="text-red-500 hover:text-red-700">
        🗑️
      </button>
    </div>
  </div>

  <!-- カテゴリフィルター -->
  <div class="mb-4">
    <p class="text-xs text-gray-600 mb-2">カテゴリでフィルター</p>
    <div id="category-filter" class="flex gap-2 flex-wrap">
      <button class="category-filter-btn active" data-category="all">
        すべて
      </button>
      <!-- カテゴリボタンが動的に生成される -->
    </div>
  </div>

  <!-- ... 既存のTODOリスト ... -->
</div>

<!-- カテゴリ管理モーダル -->
<div id="category-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">カテゴリ管理</h3>
      <button id="close-category-modal" class="text-gray-600 hover:text-gray-800 text-2xl">
        ×
      </button>
    </div>

    <!-- カテゴリリスト -->
    <div id="category-list" class="space-y-2 mb-4 max-h-64 overflow-y-auto">
      <!-- カテゴリがここに表示される -->
    </div>

    <!-- 新規カテゴリ追加 -->
    <div class="border-t border-gray-200 pt-4">
      <p class="text-sm font-semibold mb-2">新しいカテゴリ</p>
      <div class="flex gap-2 mb-2">
        <input
          type="text"
          id="new-category-name"
          placeholder="カテゴリ名"
          class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          maxlength="20"
        >
        <select id="new-category-color" class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="blue">🔵 青</option>
          <option value="green">🟢 緑</option>
          <option value="red">🔴 赤</option>
          <option value="purple">🟣 紫</option>
          <option value="yellow">🟡 黄</option>
          <option value="gray">⚪ グレー</option>
        </select>
      </div>
      <button id="add-category-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm">
        カテゴリを追加
      </button>
    </div>
  </div>
</div>
```

```javascript
// src/app.js に追加
import {
  getUserCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createDefaultCategories,
  getCategoryColorClass
} from './utils/category.js';

let userCategories = [];
let currentCategoryFilter = 'all';

// カテゴリの読み込み
async function loadCategories() {
  try {
    userCategories = await getUserCategories(currentUser.id);

    // カテゴリが0件の場合、デフォルトカテゴリを作成
    if (userCategories.length === 0) {
      await createDefaultCategories(currentUser.id);
      userCategories = await getUserCategories(currentUser.id);
    }

    renderCategoryFilter();
    renderCategoryList();
  } catch (error) {
    console.error('カテゴリの取得に失敗:', error);
  }
}

// カテゴリフィルターの描画
function renderCategoryFilter() {
  const filterContainer = document.getElementById('category-filter');
  const allBtn = filterContainer.querySelector('[data-category="all"]');

  // 既存のカテゴリボタンを削除
  filterContainer.querySelectorAll('.category-filter-btn:not([data-category="all"])').forEach(btn => btn.remove());

  // カテゴリボタンを追加
  userCategories.forEach(category => {
    const btn = document.createElement('button');
    btn.className = 'category-filter-btn';
    btn.dataset.category = category.id;
    btn.innerHTML = `${category.icon} ${category.name}`;

    const bgClass = getCategoryColorClass(category.color, 'bg');
    const textClass = getCategoryColorClass(category.color, 'text');
    btn.classList.add(bgClass, textClass);

    btn.addEventListener('click', () => {
      currentCategoryFilter = category.id;
      updateCategoryFilterUI();
      updateTodoUI();
    });

    filterContainer.appendChild(btn);
  });

  // 「すべて」ボタンのイベント
  allBtn.addEventListener('click', () => {
    currentCategoryFilter = 'all';
    updateCategoryFilterUI();
    updateTodoUI();
  });
}

// フィルターUIの更新
function updateCategoryFilterUI() {
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    if (btn.dataset.category === currentCategoryFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// TODO表示をフィルタリング
function updateTodoUI() {
  if (!currentTodoList) return;

  const items = currentTodoList.todo_items || [];

  // カテゴリフィルターを適用
  const filteredItems = currentCategoryFilter === 'all'
    ? items
    : items.filter(item => item.category_id === currentCategoryFilter);

  // ... 既存の表示ロジック（filteredItemsを使用）...
}

// TODOアイテム要素の作成（カテゴリバッジ追加版）
function createTodoItemElement(item) {
  const div = document.createElement('div');
  div.className = 'todo-item task-appear';

  const category = userCategories.find(c => c.id === item.category_id);
  const categoryBadge = category
    ? `<span class="text-xs px-2 py-1 rounded ${getCategoryColorClass(category.color, 'bg')} ${getCategoryColorClass(category.color, 'text')}">
         ${category.icon} ${category.name}
       </span>`
    : '';

  div.innerHTML = `
    <input
      type="checkbox"
      ${item.is_completed ? 'checked' : ''}
      class="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      data-id="${item.id}"
    >
    <div class="flex-1 flex flex-col gap-1">
      <span class="${item.is_completed ? 'line-through text-gray-500' : 'text-gray-800'}">
        ${escapeHtml(item.content)}
      </span>
      ${categoryBadge}
    </div>
    <button class="text-red-500 hover:text-red-700 delete-todo" data-id="${item.id}">
      🗑️
    </button>
  `;

  // ... 既存のイベントリスナー ...

  return div;
}

// カテゴリ管理モーダルの表示
document.getElementById('manage-categories-btn').addEventListener('click', () => {
  document.getElementById('category-modal').classList.remove('hidden');
  document.getElementById('category-modal').classList.add('flex');
  renderCategoryList();
});

// モーダルを閉じる
document.getElementById('close-category-modal').addEventListener('click', () => {
  document.getElementById('category-modal').classList.add('hidden');
  document.getElementById('category-modal').classList.remove('flex');
});

// カテゴリリストの描画
function renderCategoryList() {
  const listContainer = document.getElementById('category-list');
  listContainer.innerHTML = '';

  userCategories.forEach(category => {
    const item = document.createElement('div');
    item.className = `flex items-center gap-2 p-3 rounded border ${getCategoryColorClass(category.color, 'border')} ${getCategoryColorClass(category.color, 'bg')}`;
    item.innerHTML = `
      <span class="text-2xl">${category.icon}</span>
      <span class="flex-1 font-semibold ${getCategoryColorClass(category.color, 'text')}">${category.name}</span>
      <button class="delete-category text-red-500 hover:text-red-700" data-id="${category.id}">
        🗑️
      </button>
    `;

    // 削除ボタン
    item.querySelector('.delete-category').addEventListener('click', async () => {
      if (!confirm(`「${category.name}」を削除しますか？`)) return;
      try {
        await deleteCategory(category.id);
        await loadCategories();
        showSuccess('カテゴリを削除しました');
      } catch (error) {
        showError('カテゴリの削除に失敗しました');
      }
    });

    listContainer.appendChild(item);
  });
}

// カテゴリ追加
document.getElementById('add-category-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-category-name').value.trim();
  const color = document.getElementById('new-category-color').value;

  if (!name) {
    showError('カテゴリ名を入力してください');
    return;
  }

  try {
    const iconMap = {
      blue: '🔵',
      green: '🟢',
      red: '🔴',
      purple: '🟣',
      yellow: '🟡',
      gray: '⚪'
    };

    await createCategory(currentUser.id, name, color, iconMap[color]);
    await loadCategories();

    document.getElementById('new-category-name').value = '';
    showSuccess('カテゴリを追加しました');
  } catch (error) {
    showError('カテゴリの追加に失敗しました');
  }
});
```

```css
/* src/styles/main.css に追加 */
.category-filter-btn {
  @apply px-3 py-1 text-xs rounded-full border border-transparent transition opacity-60 hover:opacity-100;
}

.category-filter-btn.active {
  @apply opacity-100 font-semibold border-current;
}
```

### 📂 関連ファイル
- `supabase/migrations/002_add_categories.sql` (新規作成)
- `src/utils/category.js` (新規作成)
- `public/index.html` (カテゴリUI追加)
- `src/app.js` (カテゴリロジック追加)
- `src/styles/main.css` (カテゴリスタイル追加)

### ✅ テスト項目
- [ ] 初回ログイン時にデフォルトカテゴリが自動作成される
- [ ] カテゴリ管理モーダルでカテゴリの一覧が表示される
- [ ] 新しいカテゴリを追加できる
- [ ] カテゴリを削除できる
- [ ] タスク追加時にカテゴリを選択できる
- [ ] タスクにカテゴリバッジが表示される
- [ ] カテゴリフィルターでタスクを絞り込める
- [ ] 「すべて」フィルターで全タスクが表示される
- [ ] カテゴリ削除時、関連タスクのcategory_idがNULLになる
- [ ] 既存のTODO機能が正常に動作する

### 🔗 依存関係
- Phase 1、Phase 2の実装完了後が望ましい
- 既存のTODO機能との整合性を保つ必要がある

---

## Phase 3 完了の定義

以下の全てが満たされた時、Phase 3は完了とする：

✅ データベースマイグレーションが正常に完了している
✅ デフォルトカテゴリが自動作成される
✅ カテゴリの作成・削除ができる
✅ タスクにカテゴリを割り当てられる
✅ カテゴリごとに色分け表示される
✅ カテゴリフィルターが正常に動作する
✅ 既存のTODO機能が全て正常に動作する
✅ 全てのテスト項目がパスする

---

## リリース後の展望

Phase 3完了後、さらなる機能拡張の候補：
- タスクの優先度設定（高・中・低）
- タスクの期限設定とリマインダー
- タスクのサブタスク機能
- カテゴリごとの統計表示
- タスクのエクスポート機能（CSV、PDF）
- タスクテンプレート機能

---

**注**: Phase 3は優先度が低いため、Phase 1, 2が完了し、ユーザーフィードバックを得てから実装を検討することを推奨します。
