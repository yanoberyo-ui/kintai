# Phase 1: 基本的な視覚改善

**優先度**: 高
**期間**: 1-2日
**目的**: すぐに効果が見える改善を実施し、TODOリストを「パッと見て分かる」UIに改善

---

## チケット#1: プログレスバーの視覚化

### 📋 概要
現在は進捗率が数値（例: 33%）のみで表示されているが、視覚的なプログレスバーを追加し、一目で進捗状況を把握できるようにする。

### 🎯 目的
- ユーザーが進捗を視覚的に把握できる
- 達成感を高める
- カラーコーディングで状態を直感的に理解

### 難易度
**Simple** ⭐

### 📦 成果物
- カラフルなプログレスバーUI
- 進捗に応じた色変化（0-30%: 赤、31-70%: 黄、71-100%: 緑）
- スムーズなアニメーション

### 🔧 実装ステップ

- [ ] `public/index.html` のTODOセクションにプログレスバー要素を追加
- [ ] Tailwind CSSでプログレスバーのスタイリング
- [ ] `src/app.js`の`updateTodoUI()`関数でプログレスバー更新ロジック実装
- [ ] 進捗率に応じた色変更ロジック実装
  - 0-30%: `bg-red-500`
  - 31-70%: `bg-yellow-500`
  - 71-100%: `bg-green-500`
- [ ] CSS Transitionでスムーズなアニメーション追加
- [ ] ブラウザで動作確認

### 📝 実装例

```html
<!-- public/index.html に追加 -->
<div class="mb-4">
  <!-- 既存の進捗テキスト -->
  <p class="text-sm text-gray-600">進捗: <span id="todo-progress" class="font-bold text-blue-600">0%</span></p>
  <p class="text-sm text-gray-600"><span id="todo-completed">0</span>/<span id="todo-total">0</span> タスク完了</p>

  <!-- 新規追加: プログレスバー -->
  <div class="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden">
    <div
      id="todo-progress-bar"
      class="h-full rounded-full transition-all duration-500 ease-out bg-gray-400"
      style="width: 0%"
    ></div>
  </div>
</div>
```

```javascript
// src/app.js の updateTodoUI() 関数内に追加
function updateTodoUI() {
  // ... 既存のコード ...

  const progress = calculateProgress(items);
  const completedCount = items.filter(item => item.is_completed).length;

  // 進捗率テキスト更新（既存）
  document.getElementById('todo-progress').textContent = `${progress}%`;
  document.getElementById('todo-completed').textContent = completedCount;
  document.getElementById('todo-total').textContent = items.length;

  // 新規追加: プログレスバー更新
  const progressBar = document.getElementById('todo-progress-bar');
  progressBar.style.width = `${progress}%`;

  // 進捗に応じた色変更
  if (progress <= 30) {
    progressBar.className = 'h-full rounded-full transition-all duration-500 ease-out bg-red-500';
  } else if (progress <= 70) {
    progressBar.className = 'h-full rounded-full transition-all duration-500 ease-out bg-yellow-500';
  } else {
    progressBar.className = 'h-full rounded-full transition-all duration-500 ease-out bg-green-500';
  }

  // ... 残りのコード ...
}
```

### 📂 関連ファイル
- `public/index.html` (line 121-124)
- `src/app.js` (line 355-375: `updateTodoUI()`)

### ✅ テスト項目
- [ ] タスクが0個の時、プログレスバーが0%で表示される
- [ ] タスクを追加すると、プログレスバーが適切に更新される
- [ ] タスクを完了すると、プログレスバーがアニメーションで増加
- [ ] 進捗30%以下で赤色、31-70%で黄色、71-100%で緑色になる
- [ ] プログレスバーのアニメーションがスムーズ

### 🔗 依存関係
なし（独立して実装可能）

---

## チケット#2: 未完了/完了タスクの分離

### 📋 概要
現在は未完了と完了タスクが混在して表示されているが、これを2つのセクションに分離し、「やること」と「やったこと」を明確に区別する。

### 🎯 目的
- 「やること」が一目で分かる
- 完了タスクは邪魔にならないよう折りたたみ可能に
- 達成感の可視化

### 難易度
**Simple** ⭐

### 📦 成果物
- 未完了タスクセクション（上部、目立つ表示）
- 完了タスクセクション（下部、グレーアウト、折りたたみ可能）
- セクション間の視覚的な区切り

### 🔧 実装ステップ

- [ ] `public/index.html` のTODOアイテム表示エリアを2つのセクションに分割
- [ ] 未完了タスクセクション用の要素追加
- [ ] 完了タスクセクション用の要素追加（折りたたみ可能）
- [ ] `src/app.js`の`updateTodoUI()`関数を修正し、タスクを2つのセクションに振り分け
- [ ] 完了タスクセクションの折りたたみ/展開ロジック実装
- [ ] スタイリング調整（完了セクションはグレーアウト）
- [ ] 動作確認

### 📝 実装例

```html
<!-- public/index.html: TODOアイテムリストを2つのセクションに分割 -->
<div class="space-y-4">
  <!-- 未完了タスクセクション -->
  <div>
    <h4 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
      <span>☐ やること</span>
      <span id="incomplete-count" class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">0</span>
    </h4>
    <div id="todo-items-incomplete" class="space-y-2">
      <!-- 未完了タスクがここに表示される -->
    </div>
    <p id="no-incomplete-tasks" class="text-sm text-gray-400 italic hidden">やることはありません 🎉</p>
  </div>

  <!-- 完了タスクセクション -->
  <div class="border-t border-gray-200 pt-4">
    <button
      id="toggle-completed-btn"
      class="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2 hover:text-gray-800 w-full text-left"
    >
      <span id="toggle-icon">▼</span>
      <span>✓ やったこと</span>
      <span id="completed-count" class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">0</span>
    </button>
    <div id="todo-items-completed" class="space-y-2">
      <!-- 完了タスクがここに表示される -->
    </div>
  </div>
</div>
```

```javascript
// src/app.js の updateTodoUI() 関数を修正
function updateTodoUI() {
  if (!currentTodoList) return;

  todoTitle.value = currentTodoList.title || '今日のtodo';

  const items = currentTodoList.todo_items || [];
  const progress = calculateProgress(items);

  // 未完了と完了に分ける
  const incompleteItems = items.filter(item => !item.is_completed);
  const completedItems = items.filter(item => item.is_completed);

  document.getElementById('todo-progress').textContent = `${progress}%`;
  document.getElementById('todo-completed').textContent = completedItems.length;
  document.getElementById('todo-total').textContent = items.length;

  // カウント表示
  document.getElementById('incomplete-count').textContent = incompleteItems.length;
  document.getElementById('completed-count').textContent = completedItems.length;

  // 未完了タスクの表示
  const incompleteContainer = document.getElementById('todo-items-incomplete');
  const noIncompleteMsg = document.getElementById('no-incomplete-tasks');
  incompleteContainer.innerHTML = '';

  if (incompleteItems.length === 0) {
    noIncompleteMsg.classList.remove('hidden');
  } else {
    noIncompleteMsg.classList.add('hidden');
    incompleteItems.sort((a, b) => a.order_index - b.order_index).forEach(item => {
      const itemEl = createTodoItemElement(item);
      incompleteContainer.appendChild(itemEl);
    });
  }

  // 完了タスクの表示
  const completedContainer = document.getElementById('todo-items-completed');
  completedContainer.innerHTML = '';
  completedItems.sort((a, b) => b.order_index - a.order_index).forEach(item => {
    const itemEl = createTodoItemElement(item);
    completedContainer.appendChild(itemEl);
  });
}

// 完了タスクセクションの折りたたみ
const toggleCompletedBtn = document.getElementById('toggle-completed-btn');
const completedContainer = document.getElementById('todo-items-completed');
const toggleIcon = document.getElementById('toggle-icon');
let isCompletedVisible = true;

toggleCompletedBtn.addEventListener('click', () => {
  isCompletedVisible = !isCompletedVisible;
  completedContainer.classList.toggle('hidden');
  toggleIcon.textContent = isCompletedVisible ? '▼' : '▶';
});
```

### 📂 関連ファイル
- `public/index.html` (line 126-129)
- `src/app.js` (line 355-375: `updateTodoUI()`)

### ✅ テスト項目
- [ ] 未完了タスクが「やること」セクションに表示される
- [ ] 完了タスクが「やったこと」セクションに表示される
- [ ] タスクにチェックを入れると、即座にセクション間で移動する
- [ ] 完了タスクセクションのタイトルをクリックすると折りたたみ/展開される
- [ ] 未完了タスクが0件の時「やることはありません 🎉」が表示される
- [ ] カウントバッジが正しく表示される

### 🔗 依存関係
なし（独立して実装可能）

---

## チケット#3: タスク完了時のアニメーション

### 📋 概要
タスクにチェックを入れた際に、満足感を高めるアニメーションを追加する。

### 🎯 目的
- タスク完了時の達成感を高める
- UXを向上させる
- 気持ちいい操作感の提供

### 難易度
**Simple** ⭐

### 📦 成果物
- チェックマークのアニメーション
- 完了タスクが「やったこと」セクションにスムーズに移動
- プログレスバーのアニメーション更新

### 🔧 実装ステップ

- [ ] CSS Keyframesでチェックアニメーション定義
- [ ] タスク完了時のフェードアウト→フェードインアニメーション実装
- [ ] プログレスバー更新時のアニメーション（既にチケット#1で実装済み）
- [ ] `src/styles/main.css`にアニメーション用CSSを追加
- [ ] `src/app.js`でアニメーションクラスの付与/削除ロジック実装
- [ ] 動作確認

### 📝 実装例

```css
/* src/styles/main.css に追加 */

/* チェックマークアニメーション */
@keyframes checkmark-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

.checkbox-animate {
  animation: checkmark-pop 0.3s ease-in-out;
}

/* タスク完了時のフェードアウト */
@keyframes task-complete {
  0% {
    opacity: 1;
    transform: translateX(0);
  }
  50% {
    opacity: 0.5;
    transform: translateX(10px);
  }
  100% {
    opacity: 0;
    transform: translateX(20px);
  }
}

.task-completing {
  animation: task-complete 0.4s ease-out;
}

/* タスク追加時のフェードイン */
@keyframes task-appear {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.task-appear {
  animation: task-appear 0.3s ease-out;
}
```

```javascript
// src/app.js の createTodoItemElement() 関数を修正
function createTodoItemElement(item) {
  const div = document.createElement('div');
  div.className = 'todo-item task-appear'; // アニメーションクラス追加
  div.innerHTML = `
    <input
      type="checkbox"
      ${item.is_completed ? 'checked' : ''}
      class="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      data-id="${item.id}"
    >
    <span class="${item.is_completed ? 'line-through text-gray-500' : 'text-gray-800'} flex-1">
      ${escapeHtml(item.content)}
    </span>
    <button class="text-red-500 hover:text-red-700 delete-todo" data-id="${item.id}">
      🗑️
    </button>
  `;

  // チェックボックスのイベント
  const checkbox = div.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', async (e) => {
    try {
      // チェックボックスにアニメーション追加
      checkbox.classList.add('checkbox-animate');

      // タスク全体にアニメーション追加
      if (e.target.checked) {
        div.classList.add('task-completing');
      }

      // 少し待ってからデータ更新
      setTimeout(async () => {
        await toggleTodoItem(item.id, e.target.checked);
        await loadTodoList();

        // アニメーションクラス削除
        checkbox.classList.remove('checkbox-animate');
      }, 300);

    } catch (error) {
      showError('TODOの更新に失敗しました');
      e.target.checked = !e.target.checked; // チェック状態を戻す
      checkbox.classList.remove('checkbox-animate');
      div.classList.remove('task-completing');
    }
  });

  // 削除ボタンのイベント（既存のまま）
  const deleteBtn = div.querySelector('.delete-todo');
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      await deleteTodoItem(item.id);
      await loadTodoList();
      showSuccess('タスクを削除しました');
    } catch (error) {
      showError('タスクの削除に失敗しました');
    }
  });

  return div;
}
```

### 📂 関連ファイル
- `src/styles/main.css`
- `src/app.js` (line 377-421: `createTodoItemElement()`)

### ✅ テスト項目
- [ ] チェックボックスをクリックすると、チェックマークがポップアニメーションする
- [ ] タスク完了時、タスクがフェードアウトする
- [ ] 完了タスクが「やったこと」セクションにフェードインする
- [ ] プログレスバーがスムーズにアニメーションする
- [ ] アニメーション中も他の操作が可能

### 🔗 依存関係
- チケット#2（未完了/完了の分離）が完了後に実装するのが望ましい
- ただし、独立して実装も可能

---

## Phase 1 完了の定義

以下の全てが満たされた時、Phase 1は完了とする：

✅ プログレスバーが視覚的に表示され、進捗に応じて色が変わる
✅ 未完了タスクと完了タスクが明確に分離されている
✅ 完了タスクセクションが折りたたみ可能
✅ タスク完了時にアニメーションが表示される
✅ 全てのテスト項目がパスする
✅ モバイル・デスクトップ両方で正しく表示される

---

## 次のステップ

Phase 1完了後は、[Phase 2: 履歴・分析機能](./phase2-history-analysis.md)に進む。
