import { useEffect, useState } from 'react'

export interface ToastData {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  undoAction?: () => void
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

function Toast({ toast, onDismiss }: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true)
      setTimeout(() => onDismiss(toast.id), 200)
    }, 5000)

    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }

  const handleUndo = () => {
    if (toast.undoAction) {
      toast.undoAction()
    }
    handleDismiss()
  }

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  }[toast.type]

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${bgColor} ${
        isLeaving ? 'animate-slide-out' : 'animate-slide-in'
      }`}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.undoAction && (
        <button
          onClick={handleUndo}
          className="px-2 py-1 text-sm font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
        >
          Undo
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-white/20 rounded transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default Toast
