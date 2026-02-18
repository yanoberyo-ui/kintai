import React, { useState, useEffect } from 'react'
import { submitSurveyResponses } from '../../../features/survey/utils/healthSurvey'

// スコア選択肢の設定
const SCORE_OPTIONS = [
  { value: 1, emoji: '😢', label: '全くそう思わない', color: 'from-red-500 to-red-600' },
  { value: 2, emoji: '😕', label: 'あまりそう思わない', color: 'from-orange-400 to-orange-500' },
  { value: 3, emoji: '😐', label: 'どちらともいえない', color: 'from-yellow-400 to-yellow-500' },
  { value: 4, emoji: '🙂', label: 'ややそう思う', color: 'from-lime-400 to-lime-500' },
  { value: 5, emoji: '😊', label: 'とてもそう思う', color: 'from-green-400 to-green-500' }
]

// カテゴリごとのアイコン
const CATEGORY_ICONS = {
  '仕事': '💼',
  '人間関係': '🤝',
  '健康': '💚',
  '成長': '🌱',
  '承認': '⭐',
  '支援': '🤲',
  'フリー': '💬'
}

export default function SurveyModal({ survey, user, isDark, onClose, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState('next')

  const questions = survey?.questions || []
  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const progress = ((currentIndex + 1) / totalQuestions) * 100

  // 現在の質問への回答
  const currentResponse = responses[currentQuestion?.id]

  const handleScoreSelect = (score) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: { questionId: currentQuestion.id, score }
    }))

    // 自動的に次の質問へ（少し遅延）
    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => handleNext(), 300)
    }
  }

  const handleTextChange = (text) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: { questionId: currentQuestion.id, freeText: text }
    }))
  }

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setDirection('next')
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
        setAnimating(false)
      }, 200)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection('prev')
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1)
        setAnimating(false)
      }, 200)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      // 回答をフォーマット
      const formattedResponses = Object.values(responses).filter(r => r.score || r.freeText)

      await submitSurveyResponses(
        survey.id,
        formattedResponses,
        user.department,
        user.id,
        survey.frequency
      )

      onComplete?.()
    } catch (error) {
      console.error('Error submitting survey:', error)
      alert('回答の送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    // スキップ時は単に閉じる（完了扱いにしない）
    onClose?.()
  }

  // 必須質問（scale）がすべて回答されているか
  const isAllRequiredAnswered = questions
    .filter(q => q.question_type === 'scale')
    .every(q => responses[q.id]?.score)

  const isLastQuestion = currentIndex === totalQuestions - 1

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleSkip}
      />

      {/* モーダル本体 */}
      <div className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-white via-gray-50 to-white'
      }`}>
        {/* ヘッダー */}
        <div className={`px-6 py-5 border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
              }`}>
                <span className="text-xl">📊</span>
              </div>
              <div>
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {survey.title}
                </h2>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  回答は完全匿名です
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className={`p-2 rounded-xl transition-colors ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* プログレスバー */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {currentIndex + 1} / {totalQuestions}
              </span>
              <span className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 質問カード */}
        <div className="px-6 py-8 min-h-[320px]">
          <div className={`transition-all duration-200 ${
            animating 
              ? direction === 'next' 
                ? 'opacity-0 translate-x-4' 
                : 'opacity-0 -translate-x-4'
              : 'opacity-100 translate-x-0'
          }`}>
            {/* カテゴリバッジ */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{CATEGORY_ICONS[currentQuestion?.category] || '📝'}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isDark 
                  ? 'bg-gray-700 text-gray-300' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {currentQuestion?.category}
              </span>
            </div>

            {/* 質問文 */}
            <h3 className={`text-xl md:text-2xl font-bold mb-8 leading-relaxed ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {currentQuestion?.question_text}
            </h3>

            {/* 回答UI */}
            {currentQuestion?.question_type === 'scale' ? (
              <div className="space-y-4">
                {/* スコア選択ボタン */}
                <div className="flex justify-center gap-3 md:gap-4">
                  {SCORE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleScoreSelect(option.value)}
                      className={`group relative flex flex-col items-center gap-2 p-3 md:p-4 rounded-2xl transition-all duration-200 ${
                        currentResponse?.score === option.value
                          ? `bg-gradient-to-br ${option.color} shadow-lg scale-110`
                          : isDark
                            ? 'bg-gray-800 hover:bg-gray-700'
                            : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`text-3xl md:text-4xl transition-transform duration-200 ${
                        currentResponse?.score === option.value ? 'scale-110' : 'group-hover:scale-110'
                      }`}>
                        {option.emoji}
                      </span>
                      <span className={`text-[10px] md:text-xs font-medium ${
                        currentResponse?.score === option.value
                          ? 'text-white'
                          : isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {option.value}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 選択されたラベル */}
                {currentResponse?.score && (
                  <div className="text-center">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {SCORE_OPTIONS.find(o => o.value === currentResponse.score)?.label}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* テキスト入力 */
              <div className="space-y-3">
                <textarea
                  value={currentResponse?.freeText || ''}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="ご意見やご要望をお聞かせください（任意）"
                  rows={4}
                  className={`w-full px-4 py-3 rounded-xl border resize-none transition-colors ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                />
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ※ 回答内容から個人が特定されることはありません
                </p>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className={`px-6 py-5 border-t flex items-center justify-between ${
          isDark ? 'border-gray-700/50 bg-gray-800/50' : 'border-gray-200/50 bg-gray-50/50'
        }`}>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              currentIndex === 0
                ? 'opacity-30 cursor-not-allowed'
                : isDark
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            前へ
          </button>

          <div className="flex gap-3">
            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || !isAllRequiredAnswered}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
                  submitting || !isAllRequiredAnswered
                    ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-xl hover:scale-105'
                }`}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    送信中...
                  </>
                ) : (
                  <>
                    回答を送信
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={currentQuestion?.question_type === 'scale' && !currentResponse?.score}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                  currentQuestion?.question_type === 'scale' && !currentResponse?.score
                    ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:scale-105'
                }`}
              >
                次へ
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 匿名性の説明バッジ */}
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
          isDark ? 'bg-gray-700/80 text-gray-400' : 'bg-gray-100 text-gray-500'
        }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          完全匿名
        </div>
      </div>
    </div>
  )
}

// 完了時のサンクス画面
export function SurveyCompleteScreen({ isDark, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className={`relative w-full max-w-md rounded-3xl shadow-2xl p-8 text-center ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-white via-gray-50 to-white'
      }`}>
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center animate-bounce">
            <span className="text-4xl">✨</span>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ありがとうございました！
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            回答は匿名で集計され、<br />より良い職場環境づくりに活用されます。
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:scale-105 transition-all"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
