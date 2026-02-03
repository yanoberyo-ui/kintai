import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import MinigameApp from './features/minigame/components/participant/MinigameApp'
import './styles/main.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 参加者用ミニゲーム画面（認証不要） */}
        <Route path="/minigame/:eventId" element={<MinigameApp />} />
        {/* メインアプリ */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
