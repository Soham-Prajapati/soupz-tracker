import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import './soupz.css'
createRoot(document.getElementById('root')).render(<React.StrictMode><App /><InstallPrompt /></React.StrictMode>)
