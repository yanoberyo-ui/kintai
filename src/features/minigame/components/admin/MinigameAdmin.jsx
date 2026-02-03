import React, { useState } from 'react'
import EventList from './EventList'
import EventCreate from './EventCreate'
import EventControl from './EventControl'

export default function MinigameAdmin({ isDark }) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState(null)

  // イベント選択時 → EventControlへ
  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId)
  }

  // 戻るボタン
  const handleBack = () => {
    setSelectedEventId(null)
  }

  // 選択中のイベントがあればEventControlを表示
  if (selectedEventId) {
    return (
      <EventControl
        eventId={selectedEventId}
        isDark={isDark}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ミニゲーム管理
          </h1>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            イベントの作成・管理
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
            isDark
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          + 新規イベント
        </button>
      </div>

      {/* イベント一覧 */}
      <EventList
        isDark={isDark}
        onSelectEvent={handleSelectEvent}
      />

      {/* 作成モーダル */}
      {showCreateModal && (
        <EventCreate
          isDark={isDark}
          onClose={() => setShowCreateModal(false)}
          onCreated={(event) => {
            setShowCreateModal(false)
            setSelectedEventId(event.id)
          }}
        />
      )}
    </div>
  )
}
