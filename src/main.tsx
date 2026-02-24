import React from 'react'
import ReactDOM from 'react-dom/client'
import { Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { TaskProvider } from './context/TaskContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router hook={useHashLocation}>
      <ThemeProvider>
        <ToastProvider>
          <TaskProvider>
            <App />
          </TaskProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>,
)
