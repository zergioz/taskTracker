import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ToastContainer, ToastData } from '../components/Toast'
import { v4 as uuidv4 } from 'uuid'

interface ToastContextType {
  showToast: (message: string, type?: ToastData['type'], undoAction?: () => void) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const showToast = useCallback((
    message: string,
    type: ToastData['type'] = 'info',
    undoAction?: () => void
  ) => {
    const id = uuidv4()
    setToasts(prev => [...prev, { id, message, type, undoAction }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
