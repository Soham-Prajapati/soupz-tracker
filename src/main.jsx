import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import { AuthGate } from './Auth.jsx'
import './soupz.css'
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
    <InstallPrompt />
  </React.StrictMode>
)
