import React, { useState, useEffect, useRef } from 'react'
import {
  getTodayTodoList,
  createTodayTodoList,
  addTodoItem,
  addTodoItemAtPosition,
  toggleTodoItem,
  deleteTodoItem,
  calculateProgress,
  reorderTodoItems,
  getChildTasks,
  updateTodoItem,
  carryOverUncompletedTodos,
} from '../utils/todo'
import { getDailyTodos } from '../utils/rootsApi'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../utils/supabase'

export default function TodoList({ user, isDark, currentUser = null }) {
  const [todoList, setTodoList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [newItemIndent, setNewItemIndent] = useState(0)
  const [showNewTaskInput, setShowNewTaskInput] = useState(false)
  const [insertAtIndex, setInsertAtIndex] = useState(null) // 挿入位置（nullは最後）
  const [showConfetti, setShowConfetti] = useState(false)
  const prevProgressRef = useRef(0)
  const itemRefs = useRef({})
  const [loggedInUser, setLoggedInUser] = useState(null) // ログイン中のユーザー情報
  const [usersMap, setUsersMap] = useState({}) // ユーザーID -> ユーザー情報のマップ
  
  // Routine TODO state
  const [routineTodos, setRoutineTodos] = useState([])
  const [routineCompletions, setRoutineCompletions] = useState(new Set())

  // codex-dev連携 state
  const [rootsDailyTodos, setRootsDailyTodos] = useState([])
  const [rootsDailyLoading, setRootsDailyLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
      },
    })
  )

  useEffect(() => {
    if (user) {
      loadTodoList()
      loadRoutineTodos()
      loadTodayCompletions()
      loadLoggedInUser()
      loadUsersMap()
      // codex-dev DailyTodoを読み込む（読み取り専用）
      if (user.roots_user_id) {
        loadRootsDailyTodos()
      }
    }
  }, [user])
  
  // codex-dev DailyTodoを読み込む（読み取り専用）
  const loadRootsDailyTodos = async () => {
    if (!user?.roots_user_id) return
    
    setRootsDailyLoading(true)
    try {
      const todos = await getDailyTodos(user.roots_user_id)
      
      // codex-devのTodoをkintai形式に変換（読み取り専用）
      const convertedTodos = todos.map((todo, index) => ({
        id: `roots_${todo.id}`,
        content: todo.title,
        is_completed: todo.isCompleted,
        order_index: todo.orderIndex ?? index,
        indent_level: 0,
        is_roots_todo: true, // 読み取り専用フラグ
        roots_id: todo.id,
        children: todo.children?.map((child, childIndex) => ({
          id: `roots_${child.id}`,
          content: child.title,
          is_completed: child.isCompleted,
          order_index: child.orderIndex ?? childIndex,
          indent_level: 1,
          is_roots_todo: true,
          roots_id: child.id,
        })) || [],
      }))
      
      setRootsDailyTodos(convertedTodos)
    } catch (error) {
      console.error('Error loading codex-dev daily todos:', error)
    } finally {
      setRootsDailyLoading(false)
    }
  }

  // ログイン中のユーザー情報を取得
  const loadLoggedInUser = async () => {
    // currentUserがpropsで渡されている場合はそれを使用
    if (currentUser) {
      setLoggedInUser(currentUser)
      return
    }
    
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      setLoggedInUser(data)
    }
  }

  // ユーザー情報マップを取得（アバター表示用）
  const loadUsersMap = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
    
    if (data) {
      const map = {}
      data.forEach(u => {
        map[u.id] = u
      })
      setUsersMap(map)
    }
  }

  // Calculate progress and items
  // kintaiのTodoとroots_devのDailyTodoをマージ
  const kintaiItems = todoList?.todo_items || []
  // roots_devのTodoをフラット化（子要素も含める）
  const flattenRootsTodos = (todos) => {
    const result = []
    todos.forEach(todo => {
      result.push(todo)
      if (todo.children) {
        todo.children.forEach(child => result.push(child))
      }
    })
    return result
  }
  // codex-devのTodoのorder_indexを大きくして必ず最後に表示（空のTodoは除外）
  const rootsItems = flattenRootsTodos(rootsDailyTodos)
    .filter(item => item.content && item.content.trim() !== '') // 空のTodoを除外
    .map((item, index) => ({
      ...item,
      order_index: 10000 + index, // 大きな値を設定して最後に表示
    }))
  // マージ（kintaiのTodoを先頭に、codex-devのTodoを一番下に）
  const regularItems = [...kintaiItems, ...rootsItems]
  const routineItems = routineTodos.map(rt => ({
    ...rt,
    is_routine: true,
    is_completed: routineCompletions.has(rt.id),
    indent_level: rt.indent_level || 0
  }))
  
  const allItems = [...routineItems, ...regularItems]
  const completedRoutineItems = routineItems.filter(item => item.is_completed)
  const completedRegularItems = regularItems.filter(item => item.is_completed)
  const totalCompletedItems = completedRoutineItems.length + completedRegularItems.length
  const progress = allItems.length > 0 ? Math.round((totalCompletedItems / allItems.length) * 100) : 0

  // progressに応じて入力欄の表示を切り替え
  useEffect(() => {
    if (!todoList) return
    
    // 進捗が100%未満の時は入力欄を表示、100%の時は非表示
    setShowNewTaskInput(progress < 100)
  }, [todoList, routineCompletions, routineTodos, progress])

  // 100%達成時のクラッカー表示
  useEffect(() => {
    if (!todoList) return
    
    // 前回が100%未満で、今回100%になった場合のみ表示
    if (prevProgressRef.current < 100 && progress === 100 && allItems.length > 0) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000) // 4秒後に消す
    }
    
    prevProgressRef.current = progress
  }, [todoList, routineCompletions, routineTodos, progress, allItems.length])

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const sortedItems = [...regularItems].sort((a, b) => a.order_index - b.order_index)
    const oldIndex = sortedItems.findIndex((item) => item.id === active.id)
    const newIndex = sortedItems.findIndex((item) => item.id === over.id)

    const draggedItem = sortedItems[oldIndex]

    // 子タスクを取得
    const childTasks = getChildTasks(sortedItems, draggedItem.id)

    // 親タスクを移動
    let reorderedItems = arrayMove(sortedItems, oldIndex, newIndex)

    // 子タスクがある場合、親の直後に配置
    if (childTasks.length > 0) {
      // 子タスクを除いた配列を作成
      const itemsWithoutChildren = reorderedItems.filter(
        (item) => !childTasks.find((child) => child.id === item.id)
      )

      // 親タスクの新しい位置を見つける
      const parentNewIndex = itemsWithoutChildren.findIndex(
        (item) => item.id === draggedItem.id
      )

      // 親の直後に子タスクを挿入
      reorderedItems = [
        ...itemsWithoutChildren.slice(0, parentNewIndex + 1),
        ...childTasks,
        ...itemsWithoutChildren.slice(parentNewIndex + 1),
      ]
    }

    // 各アイテムに新しいorder_indexを設定して、新しいオブジェクトとして作成
    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      order_index: index
    }))

    // 楽観的更新: UIを即座に更新
    setTodoList({
      ...todoList,
      todo_items: updatedItems,
    })

    try {
      await reorderTodoItems(reorderedItems)
      // 成功した場合は再取得しない（UIは既に更新済み）
    } catch (error) {
      console.error('Error reordering tasks:', error)
      // エラーが発生した場合のみ元に戻す
      await loadTodoList()
    }
  }

  const loadTodoList = async () => {
    try {
      let list = await getTodayTodoList(user.id)

      if (!list) {
        // 新しいリストを作成
        list = await createTodayTodoList(user.id)
        list.todo_items = []
        
        // 前日の未完了TODOを引き継ぐ
        const carriedOverCount = await carryOverUncompletedTodos(user.id, list.id)
        
        if (carriedOverCount > 0) {
          // 引き継ぎ後、リストを再取得
          list = await getTodayTodoList(user.id)
        }
      }

      setTodoList(list)
    } catch (error) {
      console.error('Error loading todo list:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoutineTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('routine_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      setRoutineTodos(data || [])
    } catch (error) {
      console.error('Error loading routine todos:', error)
    }
  }

  const loadTodayCompletions = async () => {
    try {
      // 日本時間で今日の日付を取得
      const now = new Date()
      const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
      const today = jstDate.toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('routine_todo_completions')
        .select('routine_todo_id')
        .eq('user_id', user.id)
        .eq('completed_date', today)

      if (error) throw error
      setRoutineCompletions(new Set(data?.map(c => c.routine_todo_id) || []))
    } catch (error) {
      console.error('Error loading completions:', error)
    }
  }

  // 一括追加用の関数
  const handleBulkAdd = async (contents, indent) => {
    if (!contents || contents.length === 0) return
    
    
    // 他人のTODOに追加する場合は、追加者のIDを記録
    const addedBy = (loggedInUser && user.id !== loggedInUser.id) ? loggedInUser.id : null
    
    try {
      // 順番に追加
      for (const content of contents) {
        if (content.trim()) {
          await addTodoItem(todoList.id, content.trim(), indent, addedBy)
        }
      }
      
      // 追加完了後、リストを再読み込み
      await loadTodoList()
      setResetKey(prev => prev + 1)
    } catch (error) {
      console.error('Error bulk adding tasks:', error)
      await loadTodoList()
    }
  }

  const handleAddTask = async (content, indent) => {
    if (!content.trim()) return

    // 挿入位置とインデントを保存（非同期処理中に変更される可能性があるため）
    const savedInsertAtIndex = insertAtIndex
    const savedIndent = indent
    const sortedItems = [...regularItems].sort((a, b) => a.order_index - b.order_index)
    
    // 他人のTODOに追加する場合は、追加者のIDを記録
    const addedBy = (loggedInUser && user.id !== loggedInUser.id) ? loggedInUser.id : null

    try {
      // バックグラウンドでデータベースに保存（kintai Supabase）
      if (savedInsertAtIndex !== null) {
        const afterOrderIndex = sortedItems[savedInsertAtIndex]?.order_index ?? null
        await addTodoItemAtPosition(todoList.id, content.trim(), savedIndent, afterOrderIndex, addedBy)
      } else {
        await addTodoItem(todoList.id, content.trim(), savedIndent, addedBy)
      }

      // 保存完了後、リストを再読み込み
      await loadTodoList()

      // 入力欄の状態を更新
      if (savedInsertAtIndex !== null) {
        // 挿入位置を更新（新しく追加したアイテムの位置）
        setInsertAtIndex(savedInsertAtIndex + 1)
        // インデントレベルを引き継ぐ
        setNewItemIndent(savedIndent)
      } else {
        // 最後に追加した場合はインデントをリセット
        setNewItemIndent(0)
      }

      // 入力欄をリセット（新しいキーで再マウント）
      setResetKey(prev => prev + 1)
    } catch (error) {
      console.error('Error adding task:', error)
      // エラー時は元に戻す
      setInsertAtIndex(null)
      setNewItemIndent(0)
      await loadTodoList()
    }
  }

  const handleToggle = async (itemId, currentIsCompleted, isRoutine = false, isRootsTodo = false) => {
    try {
      if (isRoutine) {
        // Handle routine todo completion
        // 日本時間で今日の日付を取得
        const now = new Date()
        const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000))
        const today = jstDate.toISOString().split('T')[0]

        if (currentIsCompleted) {
          // Currently completed, so uncomplete: remove from completions table
          await supabase
            .from('routine_todo_completions')
            .delete()
            .eq('routine_todo_id', itemId)
            .eq('user_id', user.id)
            .eq('completed_date', today)

          setRoutineCompletions(prev => {
            const newSet = new Set(prev)
            newSet.delete(itemId)
            return newSet
          })
        } else {
          // Currently not completed, so complete: add to completions table
          await supabase
            .from('routine_todo_completions')
            .insert({
              routine_todo_id: itemId,
              user_id: user.id,
              completed_date: today
            })

          setRoutineCompletions(prev => new Set([...prev, itemId]))
        }
      } else if (isRootsTodo) {
        // codex-dev Todoは読み取り専用（操作はcodex-devで行う）
        return
      } else {
        // Handle regular kintai todo
        await toggleTodoItem(itemId, currentIsCompleted)
        await loadTodoList()
      }
    } catch (error) {
      console.error('Error toggling task:', error)
      alert('チェックの更新に失敗しました')
    }
  }

  const handleDelete = async (itemId, isRoutine = false, isRootsTodo = false) => {
    try {
      if (isRoutine) {
        // Handle routine todo deletion
        await supabase
          .from('routine_todos')
          .delete()
          .eq('id', itemId)
        
        // Remove from state
        setRoutineTodos(routineTodos.filter(t => t.id !== itemId))
        setRoutineCompletions(prev => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })
      } else if (isRootsTodo) {
        // codex-dev Todoは読み取り専用（削除はcodex-devで行う）
        return
      } else {
        // Handle regular kintai todo deletion
        await deleteTodoItem(itemId)
        await loadTodoList()
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border p-8 transition-colors duration-500 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className={`animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <>
      {/* クラッカーアニメーション */}
      {showConfetti && <ConfettiAnimation />}

      {/* 進捗バーセクション */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 relative mb-6 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        <div className="p-8">
          {/* タイトルと進捗バッジ */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}のToDo
            </h2>
            <div className={`px-4 py-2 rounded-full font-bold text-lg ${
              progress >= 70
                ? isDark
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-900 text-white'
                : progress >= 40
                ? isDark
                  ? 'bg-gray-300 text-gray-900'
                  : 'bg-gray-700 text-white'
                : isDark
                ? 'bg-gray-700 text-gray-300'
                : 'bg-gray-300 text-gray-700'
            }`}>
              {progress}%
            </div>
          </div>

          {/* プログレスバー */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                進捗
              </span>
              <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {totalCompletedItems} / {allItems.length} タスク完了
              </span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isDark ? 'bg-white' : 'bg-gray-900'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 定常TODOセクション */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 relative mb-6 ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        {/* ヘッダー */}
        <div className="p-8 pb-6">
          <h2 className={`text-2xl font-bold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            定常ToDo
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            毎日繰り返すタスク（完了状態は毎日リセットされます）
          </p>
        </div>

        {/* 定常タスクリスト */}
        <div className="px-8 pb-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              // 定常TODO用のドラッグ＆ドロップ処理
              const { active, over } = event
              if (!over || active.id === over.id) return

              const oldIndex = routineItems.findIndex((item) => item.id === active.id)
              const newIndex = routineItems.findIndex((item) => item.id === over.id)

              if (oldIndex === -1 || newIndex === -1) return

              const reorderedItems = arrayMove(routineItems, oldIndex, newIndex)
              
              // order_indexを更新
              const updatedItems = reorderedItems.map((item, index) => ({
                ...item,
                order_index: index
              }))

              // 楽観的更新
              setRoutineTodos(updatedItems.map(item => {
                const { is_routine, is_completed, ...rest } = item
                return rest
              }))

              // データベース更新
              Promise.all(
                updatedItems.map(item =>
                  supabase
                    .from('routine_todos')
                    .update({ order_index: item.order_index })
                    .eq('id', item.id)
                )
              ).catch(error => {
                console.error('Error reordering routine todos:', error)
                loadRoutineTodos()
              })
            }}
          >
            <SortableContext
              items={routineItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 overflow-x-hidden">
                {routineItems.map((item, index) => (
                  <SortableTaskItem
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    usersMap={usersMap}
                    loggedInUser={loggedInUser}
                    todoOwner={user}
                    onBackspaceEmpty={() => {
                      // 一つ前の項目にフォーカス
                      if (index > 0) {
                        const prevItem = routineItems[index - 1]
                        itemRefs.current[prevItem.id]?.focus()
                      }
                    }}
                    onEnterPress={() => {}}
                    ref={(el) => (itemRefs.current[item.id] = el)}
                  />
                ))}
                
                {/* 定常TODO追加欄 */}
                <NewRoutineTaskItem 
                  isDark={isDark}
                  onAdd={async (content) => {
                    try {
                      const maxOrderIndex = routineItems.length > 0 
                        ? Math.max(...routineItems.map(item => item.order_index || 0))
                        : -1
                      
                      const { error } = await supabase
                        .from('routine_todos')
                        .insert({
                          user_id: user.id,
                          content: content.trim(),
                          order_index: maxOrderIndex + 1
                        })
                      
                      if (error) throw error
                      await loadRoutineTodos()
                    } catch (error) {
                      console.error('Error adding routine todo:', error)
                    }
                  }}
                />
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* 通常のTODOセクション */}
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 relative ${
        isDark
          ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
          : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
      }`}>
        {/* ヘッダー */}
        <div className="p-8 pb-6">
          <h2 className={`text-2xl font-bold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            本日のToDo
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            今日やるべきタスク
          </p>
        </div>

        {/* タスクリスト */}
        <div className="px-8 pb-8">
          <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={regularItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1 overflow-x-hidden">
              {regularItems
                .sort((a, b) => a.order_index - b.order_index)
                .map((item, index) => (
                  <React.Fragment key={item.id}>
                    <SortableTaskItem
                  item={item}
                  isDark={isDark}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  ref={(el) => (itemRefs.current[item.id] = el)}
                  usersMap={usersMap}
                  loggedInUser={loggedInUser}
                  todoOwner={user}
                  onBackspaceEmpty={() => {
                    // 一つ前の項目にフォーカス
                    const sortedItems = regularItems.sort((a, b) => a.order_index - b.order_index)
                    if (index > 0) {
                      const prevItem = sortedItems[index - 1]
                      itemRefs.current[prevItem.id]?.focus()
                    }
                  }}
                  onEnterPress={(currentIndent) => {
                    // Enterで次の行に新しいタスクを挿入（同じインデントレベルで）
                    setInsertAtIndex(index)
                    setNewItemIndent(currentIndent || 0)
                    setShowNewTaskInput(true)
                  }}
                />
                
                {/* 挿入位置に入力欄を表示 */}
                {insertAtIndex === index && showNewTaskInput && (
                  <NewTaskItem 
                    key={`insert-${index}-${resetKey}`}
                    isDark={isDark} 
                    onAdd={handleAddTask}
                    onBulkAdd={handleBulkAdd}
                    indentLevel={newItemIndent}
                    onIndentChange={() => {}}
                    loggedInUser={loggedInUser}
                    todoOwner={user}
                    onBackspaceEmpty={() => {
                      setInsertAtIndex(null)
                      setShowNewTaskInput(false)
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          
          {/* 新規タスク追加欄（最後の位置、条件付き表示） */}
          {showNewTaskInput && insertAtIndex === null ? (
            <NewTaskItem 
            key={resetKey}
            isDark={isDark} 
            onAdd={handleAddTask}
            onBulkAdd={handleBulkAdd}
            indentLevel={newItemIndent}
            onIndentChange={setNewItemIndent}
            loggedInUser={loggedInUser}
            todoOwner={user}
            onBackspaceEmpty={() => {
              // 一番最後のアイテムにフォーカス
              const sortedItems = regularItems.sort((a, b) => a.order_index - b.order_index)
              if (sortedItems.length > 0) {
                const lastItem = sortedItems[sortedItems.length - 1]
                itemRefs.current[lastItem.id]?.focus()
              }
            }}
          />
          ) : (
            <button
              onClick={() => setShowNewTaskInput(true)}
              className={`w-full py-3 mt-2 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                isDark
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/30'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">タスクを追加</span>
            </button>
          )}
            </div>
          </SortableContext>
        </DndContext>
        </div>
      </div>
    </>
  )
}

// Sortable wrapper component for TaskItem
function SortableTaskItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // 必要なpropsを抽出して渡す
  const { usersMap, loggedInUser, todoOwner, ...restProps } = props

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskItem 
        {...restProps} 
        dragHandleProps={listeners}
        usersMap={usersMap}
        loggedInUser={loggedInUser}
        todoOwner={todoOwner}
      />
    </div>
  )
}

// クラッカーアニメーションコンポーネント
function ConfettiAnimation() {
  // ランダムにメッセージを選択
  const messages = [
    'タスクが全部完了しました！',
    'お疲れ様でした！',
    '今日はこれで終わり！',
    '素晴らしい！全て完了です！',
    'やりきりましたね！',
    '完璧です！',
    '今日も頑張りました！',
    'ミッションコンプリート！'
  ]
  const [message] = React.useState(() => messages[Math.floor(Math.random() * messages.length)])
  
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    rotation: Math.random() * 360,
    color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'][Math.floor(Math.random() * 7)]
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: '-5%',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}
      
      {/* お祝いメッセージ */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce-in pointer-events-auto text-center">
        <div className="text-7xl mb-4">🎉</div>
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-8 py-4 shadow-2xl border border-gray-200/50">
          <p className="text-2xl font-bold text-gray-900 whitespace-nowrap">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

// テキストを解析してTODOリストに変換する関数
function parseTextToTodos(text) {
  // 改行で分割
  const lines = text.split(/\r?\n/)
  
  // 各行を処理
  const todos = lines
    .map(line => {
      // 箇条書き記号を削除するパターン
      // ・、-、−、‐、•、◦、▪、★、☆、○、●、◎、□、■、※、→、►、▸、▹、➤、➢、*
      // 番号付き（1. 2. 3. や ① ② ③ や 1) 2) 3) など）
      const bulletPattern = /^[\s]*[・\-−‐•◦▪★☆○●◎□■※→►▸▹➤➢\*]+[\s]*/
      const numberedPattern = /^[\s]*(?:\d+[\.)\]\:、]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]+)[\s]*/
      const checkboxPattern = /^[\s]*(?:\[[\s\-xX]?\]|\-[\s]*\[[\s\-xX]?\])[\s]*/
      
      let cleaned = line
        .replace(bulletPattern, '')
        .replace(numberedPattern, '')
        .replace(checkboxPattern, '')
        .trim()
      
      return cleaned
    })
    .filter(line => line.length > 0) // 空行を除外
  
  return todos
}

function NewTaskItem({ isDark, onAdd, onBulkAdd, onBackspaceEmpty, indentLevel, onIndentChange, onCancel, loggedInUser, todoOwner }) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localIndent, setLocalIndent] = useState(indentLevel)
  const inputRef = useRef(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const lastSubmittedContent = useRef('')
  const [isComposing, setIsComposing] = useState(false)
  
  // 他の人のTODOに追加しようとしているか
  const isAddingToOther = loggedInUser && todoOwner && loggedInUser.id !== todoOwner.id

  // コンポーネントがマウントされた時に自動的にフォーカス
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // indentLevelが変更されたら（新しいTODOが追加されたら）contentをリセット
  useEffect(() => {
    setContent('')
    setLocalIndent(indentLevel)
  }, [indentLevel])

  // ペーストハンドラ - 複数行の場合は一括追加
  const handlePaste = async (e) => {
    const pastedText = e.clipboardData.getData('text')
    const todos = parseTextToTodos(pastedText)
    
    // 複数行の場合は一括追加
    if (todos.length > 1) {
      e.preventDefault() // デフォルトのペーストを防止
      
      if (onBulkAdd && !isSubmitting) {
        setIsSubmitting(true)
        try {
          await onBulkAdd(todos, localIndent)
          setContent('')
        } catch (error) {
          console.error('Error in bulk add:', error)
        } finally {
          setIsSubmitting(false)
        }
      }
    }
    // 1行の場合はそのまま通常のペースト処理（記号は削除しない）
  }

  const handleTouchStart = (e) => {
    // 入力中は無効
    if (document.activeElement === inputRef.current) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsDragging(false)
  }

  const handleTouchMove = (e) => {
    if (document.activeElement === inputRef.current) return
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    
    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
      setIsDragging(true)
      e.preventDefault()
    }
  }

  const handleTouchEnd = (e) => {
    if (document.activeElement === inputRef.current || !isDragging) return
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    
    if (deltaX > 50 && localIndent < 3) {
      setLocalIndent((prev) => prev + 1)
    } else if (deltaX < -50 && localIndent > 0) {
      setLocalIndent((prev) => prev - 1)
    }
    
    setIsDragging(false)
  }

  const handleKeyDown = async (e) => {
    // IME入力中（日本語変換中）はEnterを無視
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      const taskContent = content.trim()

      // 内容がある場合のみ追加（重複送信を防ぐ）
      // 同じ内容を連続して送信しないようにチェック
      if (taskContent && !isSubmitting && taskContent !== lastSubmittedContent.current) {
        setIsSubmitting(true)
        lastSubmittedContent.current = taskContent

        // 現在のインデントレベルを親に保存
        onIndentChange?.(localIndent)

        try {
          await onAdd(taskContent, localIndent)

          // 保存完了後に入力欄をクリア
          setContent('')

          // 送信成功後、少し待ってから次の入力を許可
          setTimeout(() => {
            lastSubmittedContent.current = ''
          }, 500)
        } catch (error) {
          console.error('Error in onAdd:', error)
          lastSubmittedContent.current = ''
        } finally {
          setIsSubmitting(false)
        }
      }
    } else if (e.key === 'Backspace' && content === '' && !isComposing) {
      // 空の状態でBackspaceを押したら一つ上の欄にフォーカス
      e.preventDefault()
      onBackspaceEmpty?.()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setLocalIndent((prev) => (prev > 0 ? prev - 1 : prev))
      } else {
        setLocalIndent((prev) => (prev < 3 ? prev + 1 : prev))
      }
    }
  }

  return (
    <div
      className={`group flex items-center gap-3 py-2 transition-all duration-200 ${
        isDragging ? 'scale-105' : ''
      }`}
      style={{ paddingLeft: `${localIndent * 24}px` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 新規タスク用のボタン */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm overflow-hidden ${
        isAddingToOther 
          ? '' // 他の人のTODOに追加する場合は自分のアバターを表示
          : isDark
          ? 'bg-white text-gray-900'
          : 'bg-gray-900 text-white'
      }`}>
        {isAddingToOther && loggedInUser ? (
          // 他の人のTODOに追加する場合：自分のアバターを表示
          loggedInUser.avatar_url ? (
            <img 
              src={loggedInUser.avatar_url} 
              alt={loggedInUser.name || loggedInUser.email} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${
              isDark 
                ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white' 
                : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
            }`}>
              {(loggedInUser.name || loggedInUser.email || '?').charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <span className="text-sm font-bold transform -rotate-90">
            ▼
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        disabled={isSubmitting}
        placeholder=""
        className={`flex-1 bg-transparent border-0 focus:ring-0 outline-none text-sm ${
          isDark
            ? 'text-white placeholder:text-gray-600'
            : 'text-gray-900 placeholder:text-gray-400'
        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      
      {/* インデント表示（モバイル用） - スワイプで調整 */}
      {localIndent > 0 && (
        <div className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-500/20 text-xs">
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {'→'.repeat(localIndent)}
          </span>
        </div>
      )}
    </div>
  )
}

const TaskItem = React.forwardRef(({ item, isDark, onToggle, onDelete, onBackspaceEmpty, onEnterPress, dragHandleProps, usersMap, loggedInUser, todoOwner }, ref) => {
  const [indentLevel, setIndentLevel] = useState(item.indent_level || 0)
  
  // 追加者情報
  const addedByUser = item.added_by && usersMap ? usersMap[item.added_by] : null
  // 他の人が追加したタスクかどうか（added_byが存在し、かつtodoOwnerと異なる場合）
  const isAddedByOther = item.added_by && todoOwner && item.added_by !== todoOwner.id
  
  // 編集可能かどうか
  // - 自分のTODOリスト → 全て編集可能
  // - 他の人のTODOリスト → 自分が追加したタスク（added_byが自分）のみ編集可能
  const isOwnTodoList = todoOwner && loggedInUser && todoOwner.id === loggedInUser.id
  const canEdit = isOwnTodoList || (loggedInUser && item.added_by && item.added_by === loggedInUser.id)
  // 削除可能かどうか（canEditと同じ条件）
  const canDelete = canEdit

  // indent_levelが変更されたらデータベースを更新
  useEffect(() => {
    const updateIndent = async () => {
      if (indentLevel !== (item.indent_level || 0)) {
        try {
          await updateTodoItem(item.id, { indent_level: indentLevel })
        } catch (error) {
          console.error('Error updating indent level:', error)
        }
      }
    }
    updateIndent()
  }, [indentLevel, item.id, item.indent_level])
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(item.content)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // 外部からfocusを呼べるようにする
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      // 編集不可の場合はフォーカスしない
      if (!canEdit) return
      setIsEditing(true)
      setTimeout(() => {
        inputRef.current?.focus()
        // カーソルを最後に移動
        inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
      }, 0)
    }
  }))

  const handleToggle = async () => {
    // 編集不可の場合はチェックも不可
    if (!canEdit) return
    await onToggle(item.id, item.is_completed, item.is_routine || false, item.is_roots_todo || false)
  }

  const handleEdit = () => {
    // 編集不可の場合は何もしない
    if (!canEdit) return
    setIsEditing(true)
    setEditContent(item.content)
  }

  const handleSave = async () => {
    if (editContent.trim() && editContent !== item.content) {
      try {
        if (item.is_routine) {
          // 定常TODOの更新
          await supabase
            .from('routine_todos')
            .update({ content: editContent.trim() })
            .eq('id', item.id)
        } else {
          // 通常TODOの更新
          await updateTodoItem(item.id, { content: editContent.trim() })
        }
        item.content = editContent.trim()
      } catch (error) {
        console.error('Error updating task:', error)
        alert('タスクの更新に失敗しました')
      }
    }
    setIsEditing(false)
  }

  const handleTouchStart = (e) => {
    if (isEditing || !canEdit) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsDragging(false)
  }

  const handleTouchMove = (e) => {
    if (isEditing || !canEdit) return
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    
    // 縦スクロールより横スワイプが大きい場合のみ反応
    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
      setIsDragging(true)
      e.preventDefault() // スクロールを防ぐ
    }
  }

  const handleTouchEnd = (e) => {
    if (isEditing || !isDragging || !canEdit) return
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    
    // 右スワイプ（インデント増加）
    if (deltaX > 50 && indentLevel < 3) {
      setIndentLevel((prev) => prev + 1)
    }
    // 左スワイプ（インデント減少）
    else if (deltaX < -50 && indentLevel > 0) {
      setIndentLevel((prev) => prev - 1)
    }
    
    setIsDragging(false)
  }

  const handleKeyDown = (e) => {
    // 編集不可の場合はキーボード操作を制限
    if (!canEdit && !isEditing) {
      return
    }
    
    // IME入力中は特殊キー操作を無視
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSave()
      // Enterで次の行に新しいタスクを挿入（現在のインデントレベルを渡す）
      onEnterPress?.(indentLevel)
    } else if (e.key === 'Escape') {
      setEditContent(item.content)
      setIsEditing(false)
    } else if (e.key === 'Tab') {
      if (!canEdit) return
      e.preventDefault()
      if (e.shiftKey) {
        setIndentLevel((prev) => (prev > 0 ? prev - 1 : prev))
      } else {
        setIndentLevel((prev) => (prev < 3 ? prev + 1 : prev))
      }
    } else if (e.key === 'Backspace' && isEditing && editContent === '' && !isComposing) {
      // 編集中で内容が空の時にBackspaceを押したら削除して上の欄にフォーカス
      // ただし、他の人が追加したタスクは削除できない
      if (!canDelete) {
        return
      }
      e.preventDefault()
      setIsDeleting(true)
      setTimeout(() => {
        onDelete(item.id, item.is_routine || false, item.is_roots_todo || false)
        onBackspaceEmpty?.()
      }, 200) // 200msのアニメーション後に削除
    } else if (e.key === 'Backspace' && !isEditing && !isComposing) {
      // 他の人が追加したタスクは削除できない
      if (!canDelete) {
        return
      }
      e.preventDefault()
      setIsDeleting(true)
      setTimeout(() => {
        onDelete(item.id, item.is_routine || false, item.is_roots_todo || false)
        onBackspaceEmpty?.()
      }, 200)
    }
  }

  return (
    <div
      className={`group flex items-center gap-3 py-2 transition-all duration-200 ${
        isDeleting ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
      } ${isDragging ? 'scale-105' : ''}`}
      style={{ paddingLeft: `${indentLevel * 24}px` }}
      tabIndex={canEdit ? 0 : -1}
      onKeyDown={canEdit ? handleKeyDown : undefined}
      onTouchStart={canEdit ? handleTouchStart : undefined}
      onTouchMove={canEdit ? handleTouchMove : undefined}
      onTouchEnd={canEdit ? handleTouchEnd : undefined}
    >
      {/* チェックボタン（ドラッグハンドル兼用） */}
      <div className="relative">
        <button
          {...(canEdit && dragHandleProps ? dragHandleProps : {})}
          onClick={handleToggle}
          disabled={!canEdit}
          title={isAddedByOther && addedByUser ? `${addedByUser.name || addedByUser.email}さんが追加` : undefined}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm overflow-hidden relative ${
            canEdit ? 'cursor-grab active:cursor-grabbing hover:scale-110' : 'cursor-not-allowed opacity-80'
          } ${
            item.is_completed && !(isAddedByOther && addedByUser)
              ? isDark
                ? 'bg-gray-700 text-white'
                : 'bg-gray-300 text-gray-700'
              : isAddedByOther && addedByUser
              ? '' // 他の人が追加した場合はアバターを表示
              : item.is_roots_todo
              ? 'bg-blue-700 text-white hover:bg-blue-800' // roots_devからのTodoはネイビー系
              : isDark
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {isAddedByOther && addedByUser ? (
            // 他の人が追加したタスク：追加者のアバターを表示
            <>
              {addedByUser.avatar_url ? (
                <img 
                  src={addedByUser.avatar_url} 
                  alt={addedByUser.name || addedByUser.email} 
                  className={`w-full h-full object-cover ${item.is_completed ? 'opacity-40' : ''}`}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${
                  isDark 
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white' 
                    : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
                } ${item.is_completed ? 'opacity-40' : ''}`}>
                  {(addedByUser.name || addedByUser.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {/* 完了時は白いオーバーレイとチェックマーク */}
              {item.is_completed && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-full">
                  <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </>
          ) : item.is_completed ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <span className="text-sm font-bold transform -rotate-90">
              ▼
            </span>
          )}
        </button>
      </div>

{isEditing ? (
        <>
          <input
            ref={inputRef}
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            autoFocus
            className={`flex-1 bg-transparent border-0 focus:ring-0 outline-none text-sm ${
              isDark
                ? 'text-white'
                : 'text-gray-900'
            }`}
          />
          {/* インデント表示（モバイル用） - スワイプで調整 */}
          {indentLevel > 0 && (
            <div className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-500/20 text-xs">
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {'→'.repeat(indentLevel)}
              </span>
            </div>
          )}
        </>
      ) : (
        <span
          onClick={handleEdit}
          className={`flex-1 text-sm transition-all duration-200 ${
            canEdit ? 'cursor-text' : 'cursor-default'
          } ${
            item.is_completed
              ? isDark ? 'text-gray-600 line-through' : 'text-gray-400 line-through'
              : isDark ? 'text-gray-100' : 'text-gray-900'
          }`}
        >
{item.content}
        </span>
      )}
    </div>
  )
})

TaskItem.displayName = 'TaskItem'

// 定常TODO用の新規タスク入力コンポーネント
function NewRoutineTaskItem({ isDark, onAdd }) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef(null)
  const lastSubmittedContent = useRef('')

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      const taskContent = content.trim()

      if (taskContent && !isSubmitting && taskContent !== lastSubmittedContent.current) {
        setIsSubmitting(true)
        lastSubmittedContent.current = taskContent

        try {
          await onAdd(taskContent)
          setContent('')
          setTimeout(() => {
            lastSubmittedContent.current = ''
          }, 500)
        } catch (error) {
          console.error('Error in onAdd:', error)
          lastSubmittedContent.current = ''
        } finally {
          setIsSubmitting(false)
        }
      }
    }
  }

  return (
    <div className="group flex items-center gap-3 py-2 transition-all duration-200">
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        disabled={isSubmitting}
        placeholder="定常タスクを追加..."
        className={`flex-1 bg-transparent border-0 focus:ring-0 outline-none text-sm ${
          isDark
            ? 'text-white placeholder:text-gray-600'
            : 'text-gray-900 placeholder:text-gray-400'
        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </div>
  )
}
