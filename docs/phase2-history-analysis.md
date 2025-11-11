# Phase 2: 履歴・分析機能

**優先度**: 中
**期間**: 2-3日
**目的**: 過去のTODOリストを確認でき、週次/月次で振り返りができるようにする

---

## チケット#4: 過去のTODO履歴表示

### 📋 概要
今日のTODOだけでなく、過去の日付のTODOリストを確認できる機能を追加する。過去何をやっていたか、どれくらい達成していたかを振り返れるようにする。

### 🎯 目的
- 過去のタスクを振り返れる
- 日々の進捗を確認できる
- 過去のタスク内容を参照できる

### 難易度
**Medium** ⭐⭐

### 📦 成果物
- 日付選択UI（カレンダーまたはドロップダウン）
- 選択した日付のTODOリスト表示
- 過去7日間へのクイックアクセス
- 読み取り専用の過去TODOリスト表示

### 🔧 実装ステップ

- [ ] `public/index.html`に「TODO履歴」セクションを追加
- [ ] 日付選択UIの実装（日付入力またはカレンダー）
- [ ] 過去7日間のクイックアクセスボタン実装
- [ ] `src/utils/todo.js`に日付指定のTODO取得関数を追加
  - `getTodoListByDate(userId, date)`
- [ ] `src/app.js`に履歴表示ロジックを実装
- [ ] 過去のTODOは読み取り専用で表示（編集・削除不可）
- [ ] スタイリング（過去のTODOは薄い背景色で区別）
- [ ] 動作確認

### 📝 実装例

```html
<!-- public/index.html: TODO履歴セクションを追加 -->
<div class="bg-white rounded-lg shadow-md p-6 mt-6">
  <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
    <span>📅</span>
    <span>TODO履歴</span>
  </h3>

  <!-- 日付選択 -->
  <div class="mb-4">
    <label class="block text-sm font-medium text-gray-700 mb-2">日付を選択</label>
    <input
      type="date"
      id="history-date-picker"
      class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
    >
  </div>

  <!-- クイックアクセス（過去7日間） -->
  <div class="mb-4">
    <p class="text-xs text-gray-600 mb-2">クイックアクセス</p>
    <div id="quick-date-buttons" class="flex gap-2 flex-wrap">
      <!-- ボタンが動的に生成される -->
    </div>
  </div>

  <!-- 履歴TODOリスト表示エリア -->
  <div id="history-todo-container" class="hidden">
    <div class="border-t border-gray-200 pt-4">
      <div class="bg-gray-50 p-4 rounded-lg">
        <h4 class="font-semibold text-gray-700 mb-2">
          <span id="history-date-label">2025年11月10日</span>のTODO
        </h4>
        <p class="text-xs text-gray-500 mb-3">
          進捗: <span id="history-progress" class="font-bold">0%</span>
          (<span id="history-completed">0</span>/<span id="history-total">0</span> タスク完了)
        </p>

        <!-- 履歴タスク一覧 -->
        <div id="history-todo-items" class="space-y-2">
          <!-- 過去のタスクがここに表示される -->
        </div>

        <p id="no-history-data" class="text-sm text-gray-400 italic hidden">
          この日のTODOリストはありません
        </p>
      </div>
    </div>
  </div>
</div>
```

```javascript
// src/utils/todo.js に追加
/**
 * 指定日付のTODOリストを取得
 */
export async function getTodoListByDate(userId, date) {
  const { data, error } = await supabase
    .from('todo_lists')
    .select(`
      *,
      todo_items (*)
    `)
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * 過去N日間の日付リストを取得
 */
export function getRecentDates(days = 7) {
  const dates = [];
  const today = new Date();

  for (let i = 1; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}
```

```javascript
// src/app.js に追加
import { getTodoListByDate, getRecentDates } from './utils/todo.js';

// DOM要素
const historyDatePicker = document.getElementById('history-date-picker');
const historyContainer = document.getElementById('history-todo-container');
const quickDateButtons = document.getElementById('quick-date-buttons');

// クイックアクセスボタンの生成
function generateQuickDateButtons() {
  const recentDates = getRecentDates(7);
  quickDateButtons.innerHTML = '';

  recentDates.forEach(date => {
    const dateObj = new Date(date);
    const dayLabel = getDayLabel(dateObj);

    const btn = document.createElement('button');
    btn.className = 'px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition';
    btn.textContent = dayLabel;
    btn.onclick = () => loadHistoryTodo(date);

    quickDateButtons.appendChild(btn);
  });
}

// 日付ラベルの取得（例: 11/10(日)）
function getDayLabel(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

// 履歴TODOの読み込み
async function loadHistoryTodo(date) {
  try {
    const todoList = await getTodoListByDate(currentUser.id, date);

    if (!todoList) {
      // データがない場合
      historyContainer.classList.remove('hidden');
      document.getElementById('history-date-label').textContent = formatDateLabel(date);
      document.getElementById('history-todo-items').innerHTML = '';
      document.getElementById('no-history-data').classList.remove('hidden');
      return;
    }

    // データがある場合
    historyContainer.classList.remove('hidden');
    document.getElementById('no-history-data').classList.add('hidden');

    const items = todoList.todo_items || [];
    const progress = calculateProgress(items);
    const completedCount = items.filter(item => item.is_completed).length;

    document.getElementById('history-date-label').textContent = formatDateLabel(date);
    document.getElementById('history-progress').textContent = `${progress}%`;
    document.getElementById('history-completed').textContent = completedCount;
    document.getElementById('history-total').textContent = items.length;

    // タスク表示（読み取り専用）
    const historyItemsContainer = document.getElementById('history-todo-items');
    historyItemsContainer.innerHTML = '';

    items.sort((a, b) => a.order_index - b.order_index).forEach(item => {
      const itemEl = createHistoryTodoItemElement(item);
      historyItemsContainer.appendChild(itemEl);
    });

    showSuccess('履歴を読み込みました');
  } catch (error) {
    showError('履歴の取得に失敗しました: ' + error.message);
  }
}

// 履歴TODO要素の作成（読み取り専用）
function createHistoryTodoItemElement(item) {
  const div = document.createElement('div');
  div.className = 'flex items-center gap-3 p-2 bg-white rounded border border-gray-200';
  div.innerHTML = `
    <input
      type="checkbox"
      ${item.is_completed ? 'checked' : ''}
      disabled
      class="w-5 h-5 text-gray-400 rounded cursor-not-allowed"
    >
    <span class="${item.is_completed ? 'line-through text-gray-500' : 'text-gray-700'} flex-1">
      ${escapeHtml(item.content)}
    </span>
  `;
  return div;
}

// 日付ラベルのフォーマット（例: 2025年11月10日(日)）
function formatDateLabel(dateString) {
  const date = new Date(dateString);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${year}年${month}月${day}日(${dayOfWeek})`;
}

// イベントリスナー設定
function setupEventListeners() {
  // ... 既存のコード ...

  // 日付ピッカー
  historyDatePicker.addEventListener('change', (e) => {
    loadHistoryTodo(e.target.value);
  });

  // クイックアクセスボタン生成
  generateQuickDateButtons();
}
```

### 📂 関連ファイル
- `public/index.html` (TODOリストセクションの後に追加)
- `src/utils/todo.js` (新規関数追加)
- `src/app.js` (履歴表示ロジック追加)

### ✅ テスト項目
- [ ] 日付ピッカーで過去の日付を選択すると、その日のTODOが表示される
- [ ] クイックアクセスボタンで過去7日間のTODOに素早くアクセスできる
- [ ] TODOがない日は「この日のTODOリストはありません」と表示される
- [ ] 過去のTODOは読み取り専用（チェックボックスがdisabled）
- [ ] 今日のTODOと履歴TODOが明確に区別されている
- [ ] 日付ラベルが正しくフォーマットされている

### 🔗 依存関係
なし（独立して実装可能）

---

## チケット#5: 週次/月次タスク完了サマリー

### 📋 概要
今週・今月に完了したタスク数や達成率を可視化し、生産性を確認できるサマリー機能を追加する。

### 🎯 目的
- 自分の生産性を可視化
- 達成感の向上
- モチベーション維持

### 難易度
**Medium** ⭐⭐

### 📦 成果物
- 週次サマリー表示（今週のタスク完了数、達成率）
- 月次サマリー表示（今月のタスク完了数、達成率）
- 簡易的な視覚化（プログレスバーまたはグラフ）
- 過去との比較（オプション）

### 🔧 実装ステップ

- [ ] `public/index.html`に「生産性サマリー」セクションを追加
- [ ] `src/utils/todo.js`に集計用関数を追加
  - `getWeeklySummary(userId)`
  - `getMonthlySummary(userId)`
- [ ] `src/app.js`にサマリー表示ロジックを実装
- [ ] 週次データの取得と表示
- [ ] 月次データの取得と表示
- [ ] 簡易グラフの実装（Tailwind CSSまたはChart.js）
- [ ] スタイリング調整
- [ ] 動作確認

### 📝 実装例

```html
<!-- public/index.html: 生産性サマリーセクションを追加 -->
<div class="bg-white rounded-lg shadow-md p-6 mt-6">
  <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
    <span>📈</span>
    <span>生産性サマリー</span>
  </h3>

  <!-- タブ切り替え -->
  <div class="flex gap-2 mb-4 border-b border-gray-200">
    <button id="tab-weekly" class="tab-btn active">今週</button>
    <button id="tab-monthly" class="tab-btn">今月</button>
  </div>

  <!-- 週次サマリー -->
  <div id="weekly-summary" class="summary-panel">
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="text-center p-4 bg-blue-50 rounded-lg">
        <p class="text-sm text-gray-600">完了タスク</p>
        <p class="text-3xl font-bold text-blue-600" id="weekly-completed">0</p>
      </div>
      <div class="text-center p-4 bg-green-50 rounded-lg">
        <p class="text-sm text-gray-600">達成率</p>
        <p class="text-3xl font-bold text-green-600" id="weekly-rate">0%</p>
      </div>
    </div>

    <!-- 日別グラフ -->
    <div class="mb-4">
      <p class="text-sm text-gray-600 mb-2">日別完了タスク</p>
      <div id="weekly-chart" class="flex items-end gap-1 h-24">
        <!-- グラフがここに表示される -->
      </div>
    </div>
  </div>

  <!-- 月次サマリー -->
  <div id="monthly-summary" class="summary-panel hidden">
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="text-center p-4 bg-blue-50 rounded-lg">
        <p class="text-sm text-gray-600">完了タスク</p>
        <p class="text-3xl font-bold text-blue-600" id="monthly-completed">0</p>
      </div>
      <div class="text-center p-4 bg-green-50 rounded-lg">
        <p class="text-sm text-gray-600">達成率</p>
        <p class="text-3xl font-bold text-green-600" id="monthly-rate">0%</p>
      </div>
    </div>

    <!-- 週別グラフ -->
    <div class="mb-4">
      <p class="text-sm text-gray-600 mb-2">週別完了タスク</p>
      <div id="monthly-chart" class="flex items-end gap-1 h-24">
        <!-- グラフがここに表示される -->
      </div>
    </div>
  </div>
</div>
```

```css
/* src/styles/main.css に追加 */
.tab-btn {
  @apply px-4 py-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800 transition;
}

.tab-btn.active {
  @apply text-blue-600 border-blue-600;
}

.summary-panel {
  @apply transition-opacity duration-300;
}
```

```javascript
// src/utils/todo.js に追加
/**
 * 週次サマリーを取得（月曜日から日曜日）
 */
export async function getWeeklySummary(userId) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDate = monday.toISOString().split('T')[0];
  const endDate = sunday.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('todo_lists')
    .select(`
      date,
      todo_items (
        id,
        is_completed
      )
    `)
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) throw error;

  // 日別集計
  const dailyData = data.map(list => {
    const items = list.todo_items || [];
    const total = items.length;
    const completed = items.filter(item => item.is_completed).length;
    return {
      date: list.date,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  });

  // 週全体の集計
  const totalTasks = dailyData.reduce((sum, day) => sum + day.total, 0);
  const completedTasks = dailyData.reduce((sum, day) => sum + day.completed, 0);
  const averageRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    period: { start: startDate, end: endDate },
    daily: dailyData,
    summary: {
      total: totalTasks,
      completed: completedTasks,
      rate: averageRate
    }
  };
}

/**
 * 月次サマリーを取得
 */
export async function getMonthlySummary(userId) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('todo_lists')
    .select(`
      date,
      todo_items (
        id,
        is_completed
      )
    `)
    .eq('user_id', userId)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date');

  if (error) throw error;

  // 週別集計（簡易的に7日ごと）
  const weeklyData = [];
  for (let i = 0; i < data.length; i += 7) {
    const weekData = data.slice(i, i + 7);
    const totalTasks = weekData.reduce((sum, day) => sum + (day.todo_items?.length || 0), 0);
    const completedTasks = weekData.reduce((sum, day) =>
      sum + (day.todo_items?.filter(item => item.is_completed).length || 0), 0);

    weeklyData.push({
      week: Math.floor(i / 7) + 1,
      total: totalTasks,
      completed: completedTasks,
      rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    });
  }

  // 月全体の集計
  const totalTasks = data.reduce((sum, day) => sum + (day.todo_items?.length || 0), 0);
  const completedTasks = data.reduce((sum, day) =>
    sum + (day.todo_items?.filter(item => item.is_completed).length || 0), 0);
  const averageRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    period: { start: firstDay, end: lastDay },
    weekly: weeklyData,
    summary: {
      total: totalTasks,
      completed: completedTasks,
      rate: averageRate
    }
  };
}
```

```javascript
// src/app.js に追加
import { getWeeklySummary, getMonthlySummary } from './utils/todo.js';

let currentSummaryTab = 'weekly';

// サマリーの読み込み
async function loadSummary() {
  try {
    if (currentSummaryTab === 'weekly') {
      await loadWeeklySummary();
    } else {
      await loadMonthlySummary();
    }
  } catch (error) {
    console.error('サマリーの取得に失敗:', error);
  }
}

// 週次サマリーの読み込み
async function loadWeeklySummary() {
  const summary = await getWeeklySummary(currentUser.id);

  document.getElementById('weekly-completed').textContent = summary.summary.completed;
  document.getElementById('weekly-rate').textContent = `${summary.summary.rate}%`;

  // 簡易グラフ表示
  const chartContainer = document.getElementById('weekly-chart');
  chartContainer.innerHTML = '';

  const maxCompleted = Math.max(...summary.daily.map(d => d.completed), 1);
  const days = ['月', '火', '水', '木', '金', '土', '日'];

  summary.daily.forEach((day, index) => {
    const height = (day.completed / maxCompleted) * 100;
    const bar = document.createElement('div');
    bar.className = 'flex-1 bg-blue-500 rounded-t relative group cursor-pointer';
    bar.style.height = `${height}%`;
    bar.title = `${days[index]}: ${day.completed}個`;

    const label = document.createElement('div');
    label.className = 'text-xs text-gray-600 text-center mt-1';
    label.textContent = days[index];

    const wrapper = document.createElement('div');
    wrapper.className = 'flex-1 flex flex-col items-center';
    wrapper.appendChild(bar);
    wrapper.appendChild(label);

    chartContainer.appendChild(wrapper);
  });
}

// 月次サマリーの読み込み
async function loadMonthlySummary() {
  const summary = await getMonthlySummary(currentUser.id);

  document.getElementById('monthly-completed').textContent = summary.summary.completed;
  document.getElementById('monthly-rate').textContent = `${summary.summary.rate}%`;

  // 簡易グラフ表示
  const chartContainer = document.getElementById('monthly-chart');
  chartContainer.innerHTML = '';

  const maxCompleted = Math.max(...summary.weekly.map(w => w.completed), 1);

  summary.weekly.forEach((week) => {
    const height = (week.completed / maxCompleted) * 100;
    const bar = document.createElement('div');
    bar.className = 'flex-1 bg-green-500 rounded-t relative group cursor-pointer';
    bar.style.height = `${height}%`;
    bar.title = `第${week.week}週: ${week.completed}個`;

    const label = document.createElement('div');
    label.className = 'text-xs text-gray-600 text-center mt-1';
    label.textContent = `${week.week}週`;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex-1 flex flex-col items-center';
    wrapper.appendChild(bar);
    wrapper.appendChild(label);

    chartContainer.appendChild(wrapper);
  });
}

// タブ切り替え
document.getElementById('tab-weekly').addEventListener('click', () => {
  currentSummaryTab = 'weekly';
  document.getElementById('tab-weekly').classList.add('active');
  document.getElementById('tab-monthly').classList.remove('active');
  document.getElementById('weekly-summary').classList.remove('hidden');
  document.getElementById('monthly-summary').classList.add('hidden');
  loadWeeklySummary();
});

document.getElementById('tab-monthly').addEventListener('click', () => {
  currentSummaryTab = 'monthly';
  document.getElementById('tab-monthly').classList.add('active');
  document.getElementById('tab-weekly').classList.remove('active');
  document.getElementById('monthly-summary').classList.remove('hidden');
  document.getElementById('weekly-summary').classList.add('hidden');
  loadMonthlySummary();
});

// 初回ロード時にサマリーを読み込む
async function loadUser(userId) {
  // ... 既存のコード ...

  // サマリーを読み込む
  await loadSummary();
}
```

### 📂 関連ファイル
- `public/index.html` (新規セクション追加)
- `src/utils/todo.js` (集計関数追加)
- `src/app.js` (サマリー表示ロジック追加)
- `src/styles/main.css` (タブスタイル追加)

### ✅ テスト項目
- [ ] 「今週」タブで今週の完了タスク数と達成率が表示される
- [ ] 「今月」タブで今月の完了タスク数と達成率が表示される
- [ ] 日別/週別グラフが正しく表示される
- [ ] グラフのバーにマウスオーバーすると詳細が表示される
- [ ] タブ切り替えがスムーズに動作する
- [ ] データがない期間でもエラーが出ない

### 🔗 依存関係
- チケット#4（履歴表示）と並行して実装可能
- ただし、同じデータ取得ロジックを使う部分があるため、調整が必要

---

## Phase 2 完了の定義

以下の全てが満たされた時、Phase 2は完了とする：

✅ 過去の任意の日付のTODOリストを確認できる
✅ 過去7日間へのクイックアクセスが可能
✅ 週次サマリーが表示される（完了タスク数、達成率、日別グラフ）
✅ 月次サマリーが表示される（完了タスク数、達成率、週別グラフ）
✅ 全てのテスト項目がパスする
✅ パフォーマンスが良好（データ取得が2秒以内）

---

## 次のステップ

Phase 2完了後は、必要に応じて[Phase 3: 高度な機能](./phase3-advanced-features.md)に進む。
