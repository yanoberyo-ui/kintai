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

export default function TodoList({ user, isDark }) {
  const [todoList, setTodoList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [newItemIndent, setNewItemIndent] = useState(0)
  const [showNewTaskInput, setShowNewTaskInput] = useState(false)
  const [insertAtIndex, setInsertAtIndex] = useState(null) // 挿入位置（nullは最後）
  const [showConfetti, setShowConfetti] = useState(false)
  const prevProgressRef = useRef(0)
  const itemRefs = useRef({})

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    loadTodoList()
  }, [user])

  // progressに応じて入力欄の表示を切り替え
  useEffect(() => {
    if (!todoList) return
    
    const items = todoList?.todo_items || []
    const progress = calculateProgress(items)
    
    // 100%未満の時は入力欄を表示、100%の時は非表示
    setShowNewTaskInput(progress < 100)
  }, [todoList])

  // 100%達成時のクラッカー表示
  useEffect(() => {
    if (!todoList) return
    
    const items = todoList?.todo_items || []
    const progress = calculateProgress(items)
    
    // 前回が100%未満で、今回100%になった場合のみ表示
    if (prevProgressRef.current < 100 && progress === 100 && items.length > 0) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000) // 4秒後に消す
    }
    
    prevProgressRef.current = progress
  }, [todoList])

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index)
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
          console.log(`${carriedOverCount}件のTODOを前日から引き継ぎました`)
        }
      }

      setTodoList(list)
    } catch (error) {
      console.error('Error loading todo list:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTask = async (content, indent) => {
    console.log('handleAddTask called with:', content, 'indent:', indent, 'insertAtIndex:', insertAtIndex)
    if (!content.trim()) {
      console.log('Content is empty, returning')
      return
    }

    // 挿入位置を保存（非同期処理中に変更される可能性があるため）
    const savedInsertAtIndex = insertAtIndex
    const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index)

    try {
      console.log('Adding todo item...')

      // 入力欄を先にリセット（resetKeyをインクリメント）
      setResetKey(prev => prev + 1)

      // 楽観的更新: 一時的なIDで即座にUIを更新
      const tempId = `temp-${Date.now()}`
      let newOrderIndex
      let newItems

      if (savedInsertAtIndex !== null) {
        // 挿入位置が指定されている場合
        const afterOrderIndex = sortedItems[savedInsertAtIndex]?.order_index ?? -1
        newOrderIndex = afterOrderIndex + 1

        // 新しいアイテムを挿入位置の後に追加
        newItems = [
          ...sortedItems.slice(0, savedInsertAtIndex + 1),
          {
            id: tempId,
            content: content.trim(),
            is_completed: false,
            indent_level: indent,
            order_index: newOrderIndex,
            todo_list_id: todoList.id,
          },
          ...sortedItems.slice(savedInsertAtIndex + 1).map(item => ({
            ...item,
            order_index: item.order_index + 1
          }))
        ]

        // 挿入位置を更新（新しく追加したアイテムの位置）
        setInsertAtIndex(savedInsertAtIndex + 1)
        // インデントレベルを引き継ぐ
        setNewItemIndent(indent)
      } else {
        // 最後に追加
        newOrderIndex = sortedItems.length > 0 ? sortedItems[sortedItems.length - 1].order_index + 1 : 0
        newItems = [
          ...sortedItems,
          {
            id: tempId,
            content: content.trim(),
            is_completed: false,
            indent_level: indent,
            order_index: newOrderIndex,
            todo_list_id: todoList.id,
          }
        ]
        // インデントレベルをリセット
        setNewItemIndent(0)
      }

      // 楽観的更新: UIを即座に更新
      setTodoList({
        ...todoList,
        todo_items: newItems
      })

      // バックグラウンドでデータベースに保存
      if (savedInsertAtIndex !== null) {
        const afterOrderIndex = sortedItems[savedInsertAtIndex]?.order_index ?? null
        await addTodoItemAtPosition(todoList.id, content.trim(), indent, afterOrderIndex)
      } else {
        await addTodoItem(todoList.id, content.trim(), indent)
      }

      console.log('Todo item added, reloading list...')
      // 保存完了後、正確なデータで更新（ただし入力欄の位置は保持）
      await loadTodoList()
      console.log('List reloaded')
    } catch (error) {
      console.error('Error adding task:', error)
      // エラー時は元に戻す
      setInsertAtIndex(null)
      await loadTodoList()
    }
  }

  const handleToggle = async (itemId, isCompleted) => {
    try {
      await toggleTodoItem(itemId, isCompleted)
      await loadTodoList()
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleDelete = async (itemId) => {
    try {
      await deleteTodoItem(itemId)
      await loadTodoList()
    } catch (error) {
      console.error('Error deleting task:', error)
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

  const items = todoList?.todo_items || []
  const completedItems = items.filter((item) => item.is_completed)
  const progress = calculateProgress(items)

  return (
    <>
      {/* クラッカーアニメーション */}
      {showConfetti && <ConfettiAnimation />}
      
      <div className={`backdrop-blur-xl rounded-3xl shadow-lg border overflow-hidden transition-colors duration-500 relative ${
      isDark
        ? 'bg-gray-900/80 shadow-black/50 border-gray-800/50'
        : 'bg-white/80 shadow-gray-200/50 border-gray-200/50'
    }`}>
      {/* ヘッダー */}
      <div className="p-8 pb-6">
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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              進捗
            </span>
            <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {completedItems.length} / {items.length} タスク完了
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

      {/* タスクリスト */}
      <div className="px-8 pb-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {items
                .sort((a, b) => a.order_index - b.order_index)
                .map((item, index) => (
                  <React.Fragment key={item.id}>
                    <SortableTaskItem
                  item={item}
                  isDark={isDark}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  ref={(el) => (itemRefs.current[item.id] = el)}
                  onBackspaceEmpty={() => {
                    // 一つ前の項目にフォーカス
                    const sortedItems = items.sort((a, b) => a.order_index - b.order_index)
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
                    indentLevel={newItemIndent}
                    onIndentChange={() => {}}
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
            indentLevel={newItemIndent}
            onIndentChange={setNewItemIndent}
            onBackspaceEmpty={() => {
              // 一番最後のアイテムにフォーカス
              const sortedItems = items.sort((a, b) => a.order_index - b.order_index)
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

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskItem {...props} dragHandleProps={listeners} />
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

function NewTaskItem({ isDark, onAdd, onBackspaceEmpty, indentLevel, onIndentChange, onCancel }) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localIndent, setLocalIndent] = useState(indentLevel)
  const inputRef = useRef(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // コンポーネントがマウントされた時に自動的にフォーカス
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // indentLevelが変更されたら（新しいTODOが追加されたら）contentをリセット
  useEffect(() => {
    setContent('')
    setLocalIndent(indentLevel)
  }, [indentLevel])

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
    console.log('Key pressed:', e.key, 'Content:', content, 'localIndent:', localIndent)
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 内容がある場合のみ追加
      if (content.trim() && !isSubmitting) {
        const taskContent = content.trim()
        console.log('Adding task:', taskContent, 'with indent:', localIndent)
        setIsSubmitting(true)
        setContent('') // すぐにクリア
        
        // 現在のインデントレベルを親に保存
        onIndentChange?.(localIndent)
        
        try {
          await onAdd(taskContent, localIndent)
          console.log('onAdd completed')
        } finally {
          setIsSubmitting(false)
        }
      } else {
        console.log('Content is empty or already submitting, not adding')
      }
    } else if (e.key === 'Backspace' && content === '') {
      // 空の状態でBackspaceを押したら一つ上の欄にフォーカス
      e.preventDefault()
      console.log('Backspace on empty field, focusing previous item')
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
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
        isDark
          ? 'bg-white text-gray-900'
          : 'bg-gray-900 text-white'
      }`}>
        <span className="text-sm font-bold transform -rotate-90">
          ▼
        </span>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}

        placeholder=""
        className={`flex-1 bg-transparent border-0 focus:ring-0 outline-none text-sm ${
          isDark
            ? 'text-white placeholder:text-gray-600'
            : 'text-gray-900 placeholder:text-gray-400'
        }`}
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

const TaskItem = React.forwardRef(({ item, isDark, onToggle, onDelete, onBackspaceEmpty, onEnterPress, dragHandleProps }, ref) => {
  const [indentLevel, setIndentLevel] = useState(item.indent_level || 0)
  
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
  const inputRef = useRef(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // 外部からfocusを呼べるようにする
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      setIsEditing(true)
      setTimeout(() => {
        inputRef.current?.focus()
        // カーソルを最後に移動
        inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
      }, 0)
    }
  }))

  const handleToggle = async () => {
    await onToggle(item.id, !item.is_completed)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(item.content)
  }

  const handleSave = async () => {
    if (editContent.trim() && editContent !== item.content) {
      // TODO: タスク内容の更新API呼び出し
      item.content = editContent.trim()
    }
    setIsEditing(false)
  }

  const handleTouchStart = (e) => {
    if (isEditing) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsDragging(false)
  }

  const handleTouchMove = (e) => {
    if (isEditing) return
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    
    // 縦スクロールより横スワイプが大きい場合のみ反応
    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > deltaY) {
      setIsDragging(true)
      e.preventDefault() // スクロールを防ぐ
    }
  }

  const handleTouchEnd = (e) => {
    if (isEditing || !isDragging) return
    
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
      // Enterで次の行に新しいタスクを挿入（現在のインデントレベルを渡す）
      onEnterPress?.(indentLevel)
    } else if (e.key === 'Escape') {
      setEditContent(item.content)
      setIsEditing(false)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setIndentLevel((prev) => (prev > 0 ? prev - 1 : prev))
      } else {
        setIndentLevel((prev) => (prev < 3 ? prev + 1 : prev))
      }
    } else if (e.key === 'Backspace' && isEditing && editContent === '') {
      // 編集中で内容が空の時にBackspaceを押したら削除して上の欄にフォーカス
      e.preventDefault()
      setIsDeleting(true)
      setTimeout(() => {
        onDelete(item.id)
        onBackspaceEmpty?.()
      }, 200) // 200msのアニメーション後に削除
    } else if (e.key === 'Backspace' && !isEditing) {
      e.preventDefault()
      setIsDeleting(true)
      setTimeout(() => {
        onDelete(item.id)
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
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* チェックボタン（ドラッグハンドル兼用） */}
      <button
        {...(dragHandleProps || {})}
        onClick={handleToggle}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:scale-110 cursor-grab active:cursor-grabbing ${
          item.is_completed
            ? isDark
              ? 'bg-gray-700 text-white'
              : 'bg-gray-300 text-gray-700'
            : isDark
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {item.is_completed ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="text-sm font-bold transform -rotate-90">
            ▼
          </span>
        )}
      </button>

{isEditing ? (
        <>
          <input
            ref={inputRef}
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
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
          className={`flex-1 text-sm transition-all duration-200 cursor-text ${
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
