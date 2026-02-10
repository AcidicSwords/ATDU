import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { storage } from './storage.js'
import { registerSW } from 'virtual:pwa-register'

window.storage = storage
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
